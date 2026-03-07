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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export interface AiNoteSummary {
  headline: string;
  summary: string;
  keyPoints: string[];
  nextSteps: string[];
}

export interface SummarizeNoteResult {
  summary: AiNoteSummary | null;
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
  onThinkingFallback?: () => void;
  onToolCall: (
    name: string,
    args: Record<string, unknown>,
  ) => string | Promise<string>;
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

function coerceStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseNoteSummary(text: string, title: string): AiNoteSummary | null {
  try {
    const parsed = JSON.parse(
      stripMarkdownCodeFence(text),
    ) as Partial<AiNoteSummary>;
    const headline = parsed.headline?.trim() || title.trim() || "Note summary";
    const summary = parsed.summary?.trim();
    if (!summary) return null;

    return {
      headline,
      summary,
      keyPoints: coerceStringList(parsed.keyPoints, 5),
      nextSteps: coerceStringList(parsed.nextSteps, 4),
    };
  } catch {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const bulletLines = lines
      .filter((line) => /^[-*•]|^\d+[.)]\s/.test(line))
      .map(cleanSubTaskCandidate)
      .slice(0, 5);

    return {
      headline: title.trim() || "Note summary",
      summary: lines[0] ?? trimmed,
      keyPoints: bulletLines,
      nextSteps: [],
    };
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
  _apiKey?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
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

export async function summarizeNote(
  title: string,
  content: string | null | undefined,
  _apiKey?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<SummarizeNoteResult> {
  const prompt = [
    "You are Luna, the AI assistant inside a notes app.",
    "Summarize the following note for a quick, polished in-app summary view.",
    "Respond with raw JSON only. No markdown fences. No commentary outside the JSON.",
    "",
    'Required JSON shape: {"headline":"string","summary":"string","keyPoints":["string"],"nextSteps":["string"]}',
    "",
    "Rules:",
    "- headline: 3-8 words, sharp and descriptive, not identical to the note title unless needed",
    "- summary: 2-4 concise sentences that capture the essence, context, and why it matters",
    "- keyPoints: 2-5 short bullets with concrete facts, decisions, themes, or constraints from the note",
    "- nextSteps: 0-4 brief action suggestions only when the note implies obvious follow-up actions; otherwise return []",
    "- Avoid filler, repetition, and generic productivity advice",
    "- Stay faithful to the note. Do not invent facts",
    "",
    "=== INPUT NOTE ===",
    `Title: ${title}`,
    `Content: ${content || "(empty)"}`,
  ].join("\n");

  const result = await requestAiText(prompt, 450);
  if (!result.text) {
    return { summary: null, model: result.model, error: result.error };
  }

  const summary = parseNoteSummary(result.text, title);
  if (!summary) {
    return {
      summary: null,
      model: result.model,
      error: `Luna returned an invalid summary payload: ${result.text.slice(0, 180)}`,
    };
  }

  return { summary, model: result.model, error: null };
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
        "Create a new task for the user. Use when the user asks to create, add, or schedule a task. Call this multiple times when the user requests multiple tasks or combined task-plus-note workflows.",
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
        "Create a new note for the user. Use when the user asks to write down, save, remember, or jot something. Call this multiple times when the user requests multiple notes or a note alongside another action.",
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
    "- If the user asks for multiple deliverables or actions in one message, complete all of them in the same turn before giving your final reply.",
    "- Use tools as many times as needed. Do not stop after the first tool call if the user asked for additional tasks, notes, or other creations.",
    "- Before your final reply, verify that every explicit create, add, save, or schedule request from the latest user message has been handled.",
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

function shouldRetryWithoutThinking(status: number, bodyText: string): boolean {
  if (!bodyText) return false;
  if (status !== 400 && status !== 422) return false;

  const normalized = bodyText.toLowerCase();
  return (
    normalized.includes("thinking") ||
    normalized.includes("reasoning") ||
    normalized.includes("unsupported") ||
    normalized.includes("invalid_parameter") ||
    normalized.includes("max_tokens")
  );
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
      // Local type for messages sent to the API (superset of ChatMessage).
      // tool/assistant-with-tool_calls messages are only added in follow-up rounds.
      type ApiMessage =
        | { role: "system" | "user"; content: string }
        | {
            role: "assistant";
            content: string | null;
            tool_calls?: {
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }[];
          }
        | { role: "tool"; content: string; tool_call_id: string };

      let currentMessages: ApiMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      let accumText = "";
      let accumReasoning = "";
      let modelFailed = false;
      let allowThinking = thinkingEnabled;
      let announcedThinkingFallback = false;

      // Agentic loop: keep going until model responds with text (no tool calls)
      // or we hit the round cap. Each round may call tools and loop back.
      for (let round = 0; round < 5; round++) {
        const body: Record<string, unknown> = {
          model,
          messages: currentMessages,
          tools: LUNA_TOOLS,
          stream: true,
        };

        if (allowThinking) {
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
          const errText = await res.text();
          if (
            isDeepSeek &&
            allowThinking &&
            shouldRetryWithoutThinking(res.status, errText)
          ) {
            allowThinking = false;
            if (!announcedThinkingFallback) {
              callbacks.onThinkingFallback?.();
              announcedThinkingFallback = true;
            }
            round -= 1;
            continue;
          }
          if (res.status === 400 && errText.includes("stream")) {
            return await nonStreamingFallback(
              messages,
              baseUrl,
              headers,
              model,
              callbacks,
              signal,
              allowThinking,
            );
          }
          modelFailed = true;
          break;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          callbacks.onError("No response stream available.");
          return model;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let roundText = "";
        let roundReasoning = "";
        const toolCalls: Record<
          number,
          { id: string; name: string; arguments: string }
        > = {};

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
                      id?: string;
                      function?: { name?: string; arguments?: string };
                    }[];
                  };
                }[];
                usage?: {
                  prompt_cache_hit_tokens?: number;
                  prompt_cache_miss_tokens?: number;
                };
              };

              // Extract cache info (DeepSeek returns this in the final chunk)
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

              if (delta.reasoning_content && callbacks.onReasoningToken) {
                roundReasoning += delta.reasoning_content;
                callbacks.onReasoningToken(delta.reasoning_content);
              }

              if (delta.content) {
                roundText += delta.content;
                callbacks.onToken(delta.content);
              }

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index;
                  if (!toolCalls[idx])
                    toolCalls[idx] = { id: "", name: "", arguments: "" };
                  // id only arrives on the first chunk for each tool call
                  if (tc.id) toolCalls[idx].id = tc.id;
                  if (tc.function?.name)
                    toolCalls[idx].name += tc.function.name;
                  if (tc.function?.arguments)
                    toolCalls[idx].arguments += tc.function.arguments;
                }
              }
            } catch {
              // skip malformed SSE chunk
            }
          }
        }

        accumText += roundText;
        accumReasoning += roundReasoning;

        const toolCallEntries = Object.values(toolCalls).filter(
          (tc) => tc.name,
        );

        if (toolCallEntries.length === 0) {
          // No tool calls — the model produced its final text response
          callbacks.onDone(accumText, accumReasoning || undefined);
          return model;
        }

        // Execute all tool calls in parallel and collect result strings.
        // The results are sent back to the model so it can continue (calling
        // more tools or generating its final summary response).
        const toolResultPairs = await Promise.all(
          toolCallEntries.map(async (tc) => {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.arguments) as Record<string, unknown>;
            } catch {
              /* use empty args */
            }
            const result = await Promise.resolve(
              callbacks.onToolCall(tc.name, args),
            );
            return { tc, result };
          }),
        );

        // Append the assistant's tool-call turn and the tool results to the
        // conversation, then loop for the model's follow-up response.
        currentMessages = [
          ...currentMessages,
          {
            role: "assistant" as const,
            content: roundText || null,
            tool_calls: toolCallEntries.map((tc) => ({
              id: tc.id || `call_${tc.name}_${round}`,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          },
          ...toolResultPairs.map(({ tc, result }) => ({
            role: "tool" as const,
            content: result,
            tool_call_id: tc.id || `call_${tc.name}_${round}`,
          })),
        ];

        // After tools run, force the follow-up conclusion round to be plain
        // generation rather than another reasoning pass.
        allowThinking = false;
      }

      if (modelFailed) continue;

      // Exhausted max rounds — return accumulated text
      callbacks.onDone(accumText, accumReasoning || undefined);
      return model;
    } catch {
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
  type ApiMessage =
    | { role: "system" | "user"; content: string }
    | {
        role: "assistant";
        content: string | null;
        tool_calls?: {
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }[];
      }
    | { role: "tool"; content: string; tool_call_id: string };

  const buildBody = (msgs: ApiMessage[]) => {
    const body: Record<string, unknown> = {
      model,
      messages: msgs,
      tools: LUNA_TOOLS,
    };
    if (thinkingEnabled) {
      body.thinking = { type: "enabled" };
      body.max_tokens = 8192;
    } else {
      body.temperature = 0.5;
      body.max_tokens = 1024;
    }
    return body;
  };

  let currentMessages: ApiMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  let accumText = "";
  let accumReasoning = "";
  let allowThinking = !!thinkingEnabled;
  let announcedThinkingFallback = false;

  for (let round = 0; round < 5; round++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(
        (() => {
          const body = buildBody(currentMessages);
          if (!allowThinking) {
            delete body.thinking;
            body.temperature = 0.5;
            body.max_tokens = 1024;
          }
          return body;
        })(),
      ),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      if (allowThinking && shouldRetryWithoutThinking(res.status, errText)) {
        allowThinking = false;
        if (!announcedThinkingFallback) {
          callbacks.onThinkingFallback?.();
          announcedThinkingFallback = true;
        }
        round -= 1;
        continue;
      }
      if (accumText || accumReasoning) {
        callbacks.onDone(accumText, accumReasoning || undefined);
        return model;
      }
      callbacks.onError(`${model} failed (${res.status}).`);
      return null;
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: {
        message?: {
          content?: string;
          reasoning_content?: string;
          tool_calls?: {
            id?: string;
            function: { name: string; arguments: string };
          }[];
        };
      }[];
      usage?: {
        prompt_cache_hit_tokens?: number;
        prompt_cache_miss_tokens?: number;
      };
    };

    if (data.usage) {
      const hit = data.usage.prompt_cache_hit_tokens ?? 0;
      const miss = data.usage.prompt_cache_miss_tokens ?? 0;
      if (hit > 0 || miss > 0) {
        callbacks.onCacheInfo?.({
          cacheHitTokens: hit,
          cacheMissTokens: miss,
        });
      }
    }

    const msg = data.choices?.[0]?.message;
    const roundText = msg?.content?.trim() ?? "";
    const roundReasoning = msg?.reasoning_content?.trim() ?? "";

    if (roundReasoning) {
      accumReasoning += roundReasoning;
      callbacks.onReasoningToken?.(roundReasoning);
    }

    if (roundText) {
      accumText += roundText;
      callbacks.onToken(roundText);
    }

    if (!msg?.tool_calls?.length) {
      callbacks.onDone(accumText, accumReasoning || undefined);
      return data.model ?? model;
    }

    const toolResultPairs = await Promise.all(
      msg.tool_calls.map(async (tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          /* ignore */
        }
        const result = await Promise.resolve(
          callbacks.onToolCall(tc.function.name, args),
        );
        return { tc, result };
      }),
    );

    currentMessages = [
      ...currentMessages,
      {
        role: "assistant" as const,
        content: msg.content ?? null,
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id ?? `call_${tc.function.name}_${round}`,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      ...toolResultPairs.map(({ tc, result }) => ({
        role: "tool" as const,
        content: result,
        tool_call_id: tc.id ?? `call_${tc.function.name}_${round}`,
      })),
    ];

    // After tools run, force the follow-up conclusion round to be plain
    // generation rather than another reasoning pass.
    allowThinking = false;
  }

  callbacks.onDone(accumText, accumReasoning || undefined);
  return model;
}
