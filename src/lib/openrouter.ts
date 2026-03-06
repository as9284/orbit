export const OPENROUTER_KEY_STORAGE = "orbit:openrouter:apikey";

/**
 * Prefer the free router so OpenRouter can select an available free provider,
 * then fall back to known free models if the router is temporarily unavailable.
 */
export const AI_MODEL = "openrouter/free";
export const AI_FALLBACK_MODELS = [
  AI_MODEL,
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-4b-it:free",
] as const;

export interface CategorizeTaskResult {
  category: string | null;
  model: string | null;
  error: string | null;
}

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
  const normalizedCandidate = normalizeCategoryLabel(candidate).toLowerCase();
  if (!normalizedCandidate) return null;

  for (const existing of existingCategories) {
    if (
      normalizeCategoryLabel(existing).toLowerCase() === normalizedCandidate
    ) {
      return existing;
    }
  }

  return null;
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

export function getOpenRouterKey(): string {
  return localStorage.getItem(OPENROUTER_KEY_STORAGE) ?? "";
}

export function setOpenRouterKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(OPENROUTER_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(OPENROUTER_KEY_STORAGE);
  }
}

async function requestOpenRouterText(
  prompt: string,
  apiKey: string,
): Promise<{
  text: string | null;
  model: string | null;
  error: string | null;
}> {
  let lastError: string | null = null;

  for (const model of AI_FALLBACK_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Orbit",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
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
      if (text) {
        return { text, model: data.model ?? model, error: null };
      }

      lastError = `${model} returned an empty response.`;
    } catch (error) {
      lastError = `${model} request failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { text: null, model: null, error: lastError };
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
          .slice(0, 4)
      : [];
    return { title, description, priority, subTasks };
  } catch {
    return null;
  }
}

/**
 * Ask OpenRouter to categorise a single task.
 * Returns a Title-Case label (1-3 words) or null on any failure.
 */
export async function categorizeTask(
  title: string,
  description: string | null | undefined,
  apiKey: string,
  existingCategories: readonly string[] = [],
): Promise<CategorizeTaskResult> {
  const cleanedExisting = existingCategories
    .map((category) => normalizeCategoryLabel(category))
    .filter(Boolean);
  const prompt = [
    "Categorize this task.",
    "Return exactly one short category label in Title Case (1-3 words).",
    "Examples: Work, Personal, Health, Finance, Learning, Shopping, Home, Social, Creative, Admin, Travel.",
    cleanedExisting.length > 0
      ? `Existing categories: ${cleanedExisting.join(", ")}. Reuse one of these exactly if it fits.`
      : "There are no existing categories yet.",
    "Only invent a new concise label when none of the existing categories fit.",
    "Respond with only the category label. No explanation. No punctuation.",
    `Title: ${title}`,
    `Description: ${description || "none"}`,
  ].join("\n");
  const result = await requestOpenRouterText(prompt, apiKey);
  if (!result.text) {
    return { category: null, model: result.model, error: result.error };
  }

  const rawCategory = normalizeCategoryLabel(result.text.split("\n")[0] ?? "");
  const existingMatch = matchExistingCategory(rawCategory, cleanedExisting);
  const category = existingMatch ?? rawCategory;

  return {
    category: category || null,
    model: result.model,
    error: category ? null : "AI returned an empty category.",
  };
}

export async function convertNoteToTaskDraft(
  title: string,
  content: string | null | undefined,
  apiKey: string,
): Promise<ConvertNoteToTaskResult> {
  const prompt = [
    "Convert this note into exactly one primary actionable task.",
    "Respond with valid JSON only.",
    'Use this exact shape: {"title":"string","description":"string","priority":"low|medium|high","subTasks":["string"]}',
    "Rules:",
    "- Produce one task only, not a project breakdown or task list",
    "- title: concise actionable task title, max 80 chars",
    "- description: short cleaned summary of the next concrete outcome",
    "- priority: choose low, medium, or high",
    "- subTasks: 0 to 4 concrete steps only",
    "- Prefer 0 to 2 subTasks unless the note clearly describes a short sequence that must happen",
    "- Do not expand brainstorming, meeting notes, or reference material into many tasks",
    "- If the note already looks like a task, preserve its intent and keep subTasks minimal",
    "- Keep subTasks tightly scoped to the same primary task",
    `Note title: ${title}`,
    `Note content: ${content || "none"}`,
  ].join("\n");

  const result = await requestOpenRouterText(prompt, apiKey);
  if (!result.text) {
    return { draft: null, model: result.model, error: result.error };
  }

  const draft = parseTaskDraft(result.text);
  if (!draft) {
    return {
      draft: null,
      model: result.model,
      error: `AI returned invalid task JSON: ${result.text.slice(0, 180)}`,
    };
  }

  return { draft, model: result.model, error: null };
}
