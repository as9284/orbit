import {
  getActiveApiKey,
  getAiSettings,
  PROVIDERS,
  type ProviderId,
} from "./ai";

// ── Re-exports for backward compat ──────────────────────────────────────────

/** @deprecated Use getActiveApiKey() from ai.ts */
export function getOpenRouterKey(): string {
  return getActiveApiKey();
}

/** @deprecated No longer needed — use Settings UI */
export function setOpenRouterKey(_key: string): void {
  // no-op; keys are managed via ai.ts saveAiSettings now
}

export const AI_MODEL = "deepseek-chat"; // informational only

// ── Types ────────────────────────────────────────────────────────────────────

export interface CategorizeTaskResult {
  category: string | null;
  model: string | null;
  error: string | null;
}

export interface AiTaskDraft {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  subTasks: string[];
}

export interface ConvertNoteToTaskResult {
  draft: AiTaskDraft | null;
  model: string | null;
  error: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CacheInfo {
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onReasoningToken?: (token: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onDone: (fullText: string, reasoning?: string) => void;
  onError: (error: string) => void;
  onCacheInfo?: (info: CacheInfo) => void;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function getRequestHeaders(
  apiKey: string,
  provider: ProviderId,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Orbit";
  }
  return headers;
}

function getOpenRouterFallbackModels(): string[] {
  const settings = getAiSettings();
  const primary = settings.model.openrouter;
  const allFree = PROVIDERS.openrouter.models
    .filter((m) => m.free)
    .map((m) => m.id);
  // put selected model first, then remaining free models as fallbacks
  return [primary, ...allFree.filter((id) => id !== primary)];
}

async function requestAiText(
  prompt: string,
  maxTokens = 300,
): Promise<{
  text: string | null;
  model: string | null;
  error: string | null;
}> {
  const settings = getAiSettings();
  const apiKey = settings.keys[settings.provider]?.trim();
  if (!apiKey)
    return {
      text: null,
      model: null,
      error: "No API key configured. Go to Settings → Luna.",
    };

  const baseUrl = PROVIDERS[settings.provider].baseUrl;
  const headers = getRequestHeaders(apiKey, settings.provider);

  const models =
    settings.provider === "openrouter"
      ? getOpenRouterFallbackModels()
      : [settings.model.deepseek];

  let lastError: string | null = null;

  for (const model of models) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        lastError = `${model} failed (${res.status}): ${body.slice(0, 180)}`;
        continue;
      }

      const data = (await res.json()) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (text) return { text, model: data.model ?? model, error: null };

      lastError = `${model} returned an empty response.`;
    } catch (error) {
      lastError = `${model} request failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { text: null, model: null, error: lastError };
}

// ── Text helpers ─────────────────────────────────────────────────────────────

function normalizeCategoryLabel(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[.!?,:;]+$/g, "")
    .replace(/\s+/g, " ");
}

function matchExistingCategory(
  candidate: string,
  existingCategories: readonly string[],
): string | null {
  const norm = normalizeCategoryLabel(candidate).toLowerCase();
  if (!norm) return null;
  for (const existing of existingCategories) {
    if (normalizeCategoryLabel(existing).toLowerCase() === norm)
      return existing;
  }
  return null;
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseTaskDraft(text: string): AiTaskDraft | null {
  try {
    const parsed = JSON.parse(
      stripMarkdownCodeFence(text),
    ) as Partial<AiTaskDraft>;
    const title = parsed.title?.trim();
    if (!title) return null;
    const priority =
      parsed.priority === "low" ||
      parsed.priority === "medium" ||
      parsed.priority === "high"
        ? parsed.priority
        : "medium";
    const description = parsed.description?.trim() ?? "";
    const subTasks = Array.isArray(parsed.subTasks)
      ? parsed.subTasks
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];
    return { title, description, priority, subTasks };
  } catch {
    return null;
  }
}

function cleanSubTaskCandidate(value: string): string {
  return value
    .trim()
    .replace(/^[-*•\s]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^\[[ xX]\]\s*/, "")
    .replace(/[;:,.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function inferSubTasksFromNote(content: string | null | undefined): string[] {
  if (!content) return [];
  const candidates = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^([-*•]|\d+[.)]|\[[ xX]\])\s+/.test(line))
    .map(cleanSubTaskCandidate)
    .filter((line) => line.length >= 3 && line.length <= 90);
  return [...new Set(candidates)].slice(0, 6);
}

// ── Categorize Task ──────────────────────────────────────────────────────────

export async function categorizeTask(
  title: string,
  description: string | null | undefined,
  _apiKey?: string,
  existingCategories: readonly string[] = [],
): Promise<CategorizeTaskResult> {
  const cleanedExisting = existingCategories
    .map(normalizeCategoryLabel)
    .filter(Boolean);

  const prompt = [
    "You are an expert productivity assistant. Categorize the following task into a single concise category.",
    "",
    "Rules:",
    "1. Return ONLY the category label — no explanation, reasoning, quotes, or punctuation.",
    "2. Use Title Case, 1-3 words maximum.",
    "3. Think about the domain, context, and intent behind the task — not just keywords.",
    "4. Consider these broad categories: Work, Personal, Health & Fitness, Finance, Learning, Shopping, Home & Household, Social, Creative, Admin & Errands, Travel, Career, Relationships, Self-Care, Technology, Meals & Cooking, Events & Planning.",
    cleanedExisting.length > 0
      ? `5. Existing categories: [${cleanedExisting.join(", ")}]. Strongly prefer reusing one of these if the task fits. Only create a new category when no existing one reasonably applies.`
      : "5. No existing categories yet — pick the most fitting general category.",
    "",
    `Task title: ${title}`,
    description ? `Task description: ${description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await requestAiText(prompt);
  if (!result.text) {
    return { category: null, model: result.model, error: result.error };
  }

  const rawCategory = normalizeCategoryLabel(result.text.split("\n")[0] ?? "");
  const existingMatch = matchExistingCategory(rawCategory, cleanedExisting);
  const category = existingMatch ?? rawCategory;

  return {
    category: category || null,
    model: result.model,
    error: category ? null : "Luna returned an empty category.",
  };
}

// ── Convert Note to Task ─────────────────────────────────────────────────────

export async function convertNoteToTaskDraft(
  title: string,
  content: string | null | undefined,
  _apiKey?: string,
): Promise<ConvertNoteToTaskResult> {
  const prompt = [
    "You are a productivity expert. Convert the following note into a single well-structured, actionable task.",
    "Respond with raw JSON only — no markdown fences, no commentary.",
    "",
    'Required JSON shape: {"title":"string","description":"string","priority":"low|medium|high","subTasks":["string"]}',
    "",
    "=== TITLE ===",
    "- Start with an imperative action verb: Build, Research, Schedule, Review, Draft, Fix, Organize, etc.",
    "- Concisely capture the primary goal (max 80 characters)",
    "- Never begin with 'I need to', 'I should', or 'Task to'",
    "- Make it specific enough to be actionable on its own",
    "",
    "=== DESCRIPTION ===",
    "- 1-3 sentences capturing context, constraints, acceptance criteria, or the 'why'",
    "- Include deadlines, dependencies, or key requirements from the note",
    "- Do NOT restate the title or list procedural steps",
    '- Use "" (empty string) when the title is fully self-explanatory',
    "",
    "=== PRIORITY ===",
    "- high: explicit urgency, near deadline, blocks other work, or marked important/urgent in the note",
    "- medium: clearly important but not time-critical or blocking",
    "- low: nice-to-have, someday/maybe, no pressure or deadline",
    "- When in doubt, pick medium",
    "",
    "=== SUB-TASKS ===",
    "- Extract sub-tasks when the note lists distinct, independently completable actions (checklists, steps, errands)",
    "- Each sub-task should be a clear action phrase (3-80 characters)",
    "- Aim for 0-6 sub-tasks depending on note complexity:",
    "  * 0: single-action note, vague idea, reminder, or pure reference material",
    "  * 1-3: note describes a short sequence of clearly distinct steps",
    "  * 4-6: note outlines a detailed multi-step process with many actionable items",
    "- Do NOT create artificial sub-tasks by splitting one continuous action",
    "- Context, motivation, reference links, and 'why' belong in the description, not as sub-tasks",
    "",
    "=== INPUT NOTE ===",
    `Title: ${title}`,
    `Content: ${content || "(empty)"}`,
  ].join("\n");

  const result = await requestAiText(prompt, 500);
  if (!result.text) {
    return { draft: null, model: result.model, error: result.error };
  }

  const draft = parseTaskDraft(result.text);
  if (!draft) {
    return {
      draft: null,
      model: result.model,
      error: `Luna returned invalid JSON: ${result.text.slice(0, 180)}`,
    };
  }

  if (draft.subTasks.length === 0) {
    const inferred = inferSubTasksFromNote(content);
    if (inferred.length > 0) draft.subTasks = inferred;
  }

  return { draft, model: result.model, error: null };
}

// ── Luna Chat ────────────────────────────────────────────────────────────────

interface LunaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const LUNA_TOOLS: LunaTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Create a new task for the user. Use when the user asks to create, add, or schedule a task.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Task title — start with an action verb",
          },
          description: {
            type: "string",
            description: "Optional context or details",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Task priority (default medium)",
          },
          due_date: {
            type: "string",
            description: "Optional due date in YYYY-MM-DD format",
          },
          sub_tasks: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of sub-task titles",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description:
        "Create a new note for the user. Use when the user asks to write down, save, remember, or jot something.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Note title" },
          content: { type: "string", description: "Note body in markdown" },
        },
        required: ["title"],
      },
    },
  },
];

export function buildLunaSystemPrompt(context: {
  tasks: {
    title: string;
    priority: string;
    due_date?: string | null;
    completed: boolean;
  }[];
  notes: { title: string }[];
}): string {
  const taskLines = context.tasks
    .slice(0, 30)
    .map(
      (t) =>
        `- [${t.completed ? "x" : " "}] ${t.title} (${t.priority}${t.due_date ? `, due ${t.due_date}` : ""})`,
    )
    .join("\n");

  const noteLines = context.notes
    .slice(0, 20)
    .map((n) => `- ${n.title}`)
    .join("\n");

  return [
    "You are Luna, the smart and friendly AI assistant built into Orbit — a personal productivity app for managing tasks and notes.",
    "",
    "Your capabilities:",
    "- Answer questions about the user's tasks, notes, priorities, and schedule",
    "- Create new tasks and notes using the provided tool functions",
    "- Give productivity advice: help prioritize, suggest time management strategies, break down large goals",
    "- Summarize, analyze, and find patterns across the user's data",
    "- Help with brainstorming, planning, and organizing ideas",
    "- Chat freely on any topic the user brings up",
    "",
    "Guidelines:",
    "- Be concise but thorough. Use markdown formatting (bold, lists, headers) when it helps readability.",
    "- When creating tasks, write clear action-oriented titles starting with verbs. Set appropriate priorities and due dates when context allows.",
    "- When creating notes, use markdown formatting for the content body.",
    "- After using a tool, briefly confirm what was created.",
    "- If the user's request is ambiguous, ask a clarifying question rather than guessing.",
    "- Be warm and encouraging but not overly verbose.",
    "",
    `The user currently has ${context.tasks.length} task(s) and ${context.notes.length} note(s).`,
    context.tasks.length > 0 ? `\nCurrent tasks:\n${taskLines}` : "",
    context.notes.length > 0 ? `\nCurrent notes:\n${noteLines}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface StreamLunaChatOptions {
  thinkingEnabled?: boolean;
}

export async function streamLunaChat(
  messages: ChatMessage[],
  _apiKey: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  options?: StreamLunaChatOptions,
): Promise<string | null> {
  const settings = getAiSettings();
  const apiKey = settings.keys[settings.provider]?.trim();
  if (!apiKey) {
    callbacks.onError("No API key configured. Go to Settings → Luna.");
    return null;
  }

  const baseUrl = PROVIDERS[settings.provider].baseUrl;
  const headers = getRequestHeaders(apiKey, settings.provider);

  const models =
    settings.provider === "openrouter"
      ? getOpenRouterFallbackModels()
      : [settings.model.deepseek];

  const isDeepSeek = settings.provider === "deepseek";
  const thinkingEnabled = isDeepSeek && !!options?.thinkingEnabled;

  for (const model of models) {
    try {
      // Build request body
      const body: Record<string, unknown> = {
        model,
        messages,
        tools: LUNA_TOOLS,
        stream: true,
      };

      if (thinkingEnabled) {
        // Thinking mode: no temperature/top_p, higher max_tokens for CoT
        body.thinking = { type: "enabled" };
        body.max_tokens = 8192;
      } else {
        body.temperature = 0.5;
        body.max_tokens = 1024;
        if (isDeepSeek) {
          body.thinking = { type: "disabled" };
        }
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 400 && body.includes("stream")) {
          return await nonStreamingFallback(
            messages,
            baseUrl,
            headers,
            model,
            callbacks,
            signal,
            options?.thinkingEnabled,
          );
        }
        continue;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError("No response stream available.");
        return model;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let fullReasoning = "";
      const toolCalls: Record<number, { name: string; arguments: string }> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as {
              choices?: {
                delta?: {
                  content?: string;
                  reasoning_content?: string;
                  tool_calls?: {
                    index: number;
                    function?: { name?: string; arguments?: string };
                  }[];
                };
              }[];
              usage?: {
                prompt_cache_hit_tokens?: number;
                prompt_cache_miss_tokens?: number;
              };
            };

            // Extract cache info from usage (DeepSeek returns this in the final chunk)
            if (parsed.usage && callbacks.onCacheInfo) {
              const hit = parsed.usage.prompt_cache_hit_tokens ?? 0;
              const miss = parsed.usage.prompt_cache_miss_tokens ?? 0;
              if (hit > 0 || miss > 0) {
                callbacks.onCacheInfo({
                  cacheHitTokens: hit,
                  cacheMissTokens: miss,
                });
              }
            }

            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Handle reasoning_content (DeepSeek thinking mode)
            if (delta.reasoning_content && callbacks.onReasoningToken) {
              fullReasoning += delta.reasoning_content;
              callbacks.onReasoningToken(delta.reasoning_content);
            }

            if (delta.content) {
              fullText += delta.content;
              callbacks.onToken(delta.content);
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls[idx])
                  toolCalls[idx] = { name: "", arguments: "" };
                if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                if (tc.function?.arguments)
                  toolCalls[idx].arguments += tc.function.arguments;
              }
            }
          } catch {
            // skip malformed SSE chunk
          }
        }
      }

      for (const tc of Object.values(toolCalls)) {
        if (tc.name) {
          try {
            callbacks.onToolCall(
              tc.name,
              JSON.parse(tc.arguments) as Record<string, unknown>,
            );
          } catch {
            callbacks.onToolCall(tc.name, {});
          }
        }
      }

      callbacks.onDone(fullText, fullReasoning || undefined);
      return model;
    } catch (err) {
      if (signal?.aborted) {
        callbacks.onError("Request cancelled.");
        return null;
      }
      continue;
    }
  }

  callbacks.onError(
    "All models failed. Check your API key in Settings → Luna.",
  );
  return null;
}

async function nonStreamingFallback(
  messages: ChatMessage[],
  baseUrl: string,
  headers: Record<string, string>,
  model: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  thinkingEnabled?: boolean,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    model,
    messages,
    tools: LUNA_TOOLS,
  };

  if (thinkingEnabled) {
    body.thinking = { type: "enabled" };
    body.max_tokens = 8192;
  } else {
    body.temperature = 0.5;
    body.max_tokens = 1024;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    callbacks.onError(`${model} failed (${res.status}).`);
    return null;
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: {
      message?: {
        content?: string;
        reasoning_content?: string;
        tool_calls?: { function: { name: string; arguments: string } }[];
      };
    }[];
    usage?: {
      prompt_cache_hit_tokens?: number;
      prompt_cache_miss_tokens?: number;
    };
  };

  const msg = data.choices?.[0]?.message;
  if (msg?.tool_calls) {
    for (const tc of msg.tool_calls) {
      try {
        callbacks.onToolCall(
          tc.function.name,
          JSON.parse(tc.function.arguments) as Record<string, unknown>,
        );
      } catch {
        callbacks.onToolCall(tc.function.name, {});
      }
    }
  }

  if (
    data.usage &&
    (data.usage.prompt_cache_hit_tokens || data.usage.prompt_cache_miss_tokens)
  ) {
    callbacks.onCacheInfo?.({
      cacheHitTokens: data.usage.prompt_cache_hit_tokens ?? 0,
      cacheMissTokens: data.usage.prompt_cache_miss_tokens ?? 0,
    });
  }

  const text = msg?.content?.trim() ?? "";
  const reasoning = msg?.reasoning_content?.trim() || undefined;
  if (reasoning) callbacks.onReasoningToken?.(reasoning);
  if (text) callbacks.onToken(text);
  callbacks.onDone(text, reasoning);
  return data.model ?? model;
}
