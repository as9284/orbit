// ── AI Provider & Settings Module ─────────────────────────────────────────────

const STORAGE_KEY = "orbit:ai:settings";

export type ProviderId = "openrouter" | "deepseek";

export interface ModelConfig {
  id: string;
  label: string;
  free?: boolean;
  supportsThinking?: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  description: string;
  keyPlaceholder: string;
  keyPrefix: string;
  docsUrl: string;
  docsSteps: string[];
  baseUrl: string;
  models: ModelConfig[];
  defaultModel: string;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    description: "Access many models via OpenRouter — free tier available",
    keyPlaceholder: "sk-or-…",
    keyPrefix: "sk-or-",
    docsUrl: "https://openrouter.ai",
    docsSteps: [
      "Go to openrouter.ai and create a free account",
      "Open Keys in the left sidebar",
      "Click Create key, give it any name",
      "Copy the key and paste it above",
    ],
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "openrouter/free", label: "Free (auto-select)", free: true },
      {
        id: "qwen/qwen3-30b-a3b-04-28:free",
        label: "Qwen 3 30B",
        free: true,
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        label: "Llama 3.3 70B",
        free: true,
      },
      {
        id: "google/gemma-3-4b-it:free",
        label: "Gemma 3 4B",
        free: true,
      },
      {
        id: "deepseek/deepseek-chat-v3-0324:free",
        label: "DeepSeek V3 (free)",
        free: true,
      },
    ],
    defaultModel: "openrouter/free",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    description: "Use DeepSeek models directly — bring your own API key",
    keyPlaceholder: "sk-…",
    keyPrefix: "sk-",
    docsUrl: "https://platform.deepseek.com",
    docsSteps: [
      "Go to platform.deepseek.com and create an account",
      "Navigate to API Keys in your dashboard",
      "Create a new API key",
      "Copy the key and paste it above",
    ],
    baseUrl: "https://api.deepseek.com",
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3.2", supportsThinking: true },
    ],
    defaultModel: "deepseek-chat",
  },
};

export const PROVIDER_LIST: ProviderConfig[] = [
  PROVIDERS.openrouter,
  PROVIDERS.deepseek,
];

// ── Feature toggles ──────────────────────────────────────────────────────────

export interface AiFeatures {
  /** Auto-categorize tasks in background */
  autoCategorize: boolean;
  /** Note-specific AI actions like summary and task conversion */
  noteTools: boolean;
  /** Luna chat page */
  lunaChat: boolean;
}

const DEFAULT_FEATURES: AiFeatures = {
  autoCategorize: false,
  noteTools: false,
  lunaChat: false,
};

// ── Settings shape ───────────────────────────────────────────────────────────

export interface AiSettings {
  provider: ProviderId;
  keys: Record<ProviderId, string>;
  model: Record<ProviderId, string>;
  features: AiFeatures;
}

function defaultSettings(): AiSettings {
  return {
    provider: "openrouter",
    keys: { openrouter: "", deepseek: "" },
    model: {
      openrouter: PROVIDERS.openrouter.defaultModel,
      deepseek: PROVIDERS.deepseek.defaultModel,
    },
    features: { ...DEFAULT_FEATURES },
  };
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function getAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateFromLegacy();
    const parsed = JSON.parse(raw) as Partial<AiSettings> & {
      features?: Partial<AiFeatures> & {
        noteSummary?: boolean;
        noteToTask?: boolean;
      };
    };
    const defaults = defaultSettings();
    const legacyNoteTools =
      parsed.features?.noteTools ??
      parsed.features?.noteSummary ??
      parsed.features?.noteToTask ??
      false;

    return {
      provider: parsed.provider ?? defaults.provider,
      keys: { ...defaults.keys, ...parsed.keys },
      model: { ...defaults.model, ...parsed.model },
      features: {
        ...defaults.features,
        ...parsed.features,
        noteTools: legacyNoteTools,
      },
    };
  } catch {
    return defaultSettings();
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("orbit:ai:changed"));
}

/** Migrate legacy OpenRouter key from old storage format */
function migrateFromLegacy(): AiSettings {
  const settings = defaultSettings();
  const legacyKey = localStorage.getItem("orbit:openrouter:apikey");
  if (legacyKey) {
    settings.keys.openrouter = legacyKey;
    localStorage.removeItem("orbit:openrouter:apikey");
    saveAiSettings(settings);
  }
  return settings;
}

// ── Convenience getters ──────────────────────────────────────────────────────

export function getActiveApiKey(): string {
  const s = getAiSettings();
  return s.keys[s.provider]?.trim() ?? "";
}

export function getActiveProvider(): ProviderConfig {
  const s = getAiSettings();
  return PROVIDERS[s.provider];
}

export function getActiveModel(): string {
  const s = getAiSettings();
  return s.model[s.provider] ?? PROVIDERS[s.provider].defaultModel;
}

export function getActiveBaseUrl(): string {
  return getActiveProvider().baseUrl;
}

export function hasApiKey(): boolean {
  return !!getActiveApiKey();
}

export function getFeatures(): AiFeatures {
  return getAiSettings().features;
}

/** Check if a specific AI feature is enabled AND has an API key configured */
export function isFeatureReady(feature: keyof AiFeatures): boolean {
  const s = getAiSettings();
  return s.features[feature] && !!s.keys[s.provider]?.trim();
}

/** Check if the currently selected model supports thinking mode */
export function activeModelSupportsThinking(): boolean {
  const s = getAiSettings();
  const provider = PROVIDERS[s.provider];
  const model = s.model[s.provider] ?? provider.defaultModel;
  return provider.models.find((m) => m.id === model)?.supportsThinking ?? false;
}
