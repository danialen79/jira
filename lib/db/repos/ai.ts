import { getDb, nowIso } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/db/repos/settings";
import {
  AI_PROVIDER_IDS,
  DEFAULT_AI_MODELS,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_ORCHESTRATOR_MODELS,
  DEFAULT_SUBAGENT_MODELS,
  isAIProvider,
  OMNIROUTE_DEFAULT_BASE_URL,
  type AIProvider,
  type ProviderModelMap,
} from "@/lib/ai-providers";

export type { AIProvider };
export {
  AI_PROVIDER_IDS,
  isAIProvider,
  OMNIROUTE_DEFAULT_BASE_URL,
  DEFAULT_EMBEDDING_MODELS,
};

/** null = omit from API request (provider/model default). */
export type AiGenerationParams = {
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
};

export type AiDefaults = {
  defaultProvider: AIProvider;
  defaultModels: ProviderModelMap;
  embeddingModels: ProviderModelMap;
  /** Workshop interview orchestrator (stronger). */
  orchestratorModels: ProviderModelMap;
  /** Workshop subagents: knowledge / jira / web (cheaper). */
  subagentModels: ProviderModelMap;
  /** Web search (Tavily) for Research tools. */
  tavilyApiKey: string | null;
  generation: AiGenerationParams;
};

export type AiProviderRow = {
  id: AIProvider;
  apiKey: string | null;
  baseUrl: string | null;
  enabled: boolean;
  extraJson: string | null;
};

export type RedactedAiProvider = {
  id: AIProvider;
  configured: boolean;
  apiKeyLast4: string | null;
  baseUrl: string | null;
  enabled: boolean;
};

export type PublicAiSettings = {
  defaultProvider: AIProvider;
  defaultModels: AiDefaults["defaultModels"];
  embeddingModels: AiDefaults["embeddingModels"];
  orchestratorModels: AiDefaults["orchestratorModels"];
  subagentModels: AiDefaults["subagentModels"];
  tavilyConfigured: boolean;
  tavilyApiKeyLast4: string | null;
  generation: AiGenerationParams;
  providers: RedactedAiProvider[];
};

const AI_DEFAULTS_KEY = "ai.defaults";

/** Omit sampling params by default — some AvalAI models only allow temperature=1. */
export const DEFAULT_AI_GENERATION: AiGenerationParams = {
  temperature: null,
  topP: null,
  maxTokens: null,
};

export const DEFAULT_AI_DEFAULTS: AiDefaults = {
  defaultProvider: "gemini",
  defaultModels: {
    gemini: DEFAULT_AI_MODELS.gemini,
    avalai: DEFAULT_AI_MODELS.avalai,
    arvan: DEFAULT_AI_MODELS.arvan,
    omniroute: DEFAULT_AI_MODELS.omniroute,
  },
  embeddingModels: {
    gemini: DEFAULT_EMBEDDING_MODELS.gemini,
    avalai: DEFAULT_EMBEDDING_MODELS.avalai,
    arvan: DEFAULT_EMBEDDING_MODELS.arvan,
    omniroute: DEFAULT_EMBEDDING_MODELS.omniroute,
  },
  orchestratorModels: {
    gemini: DEFAULT_ORCHESTRATOR_MODELS.gemini,
    avalai: DEFAULT_ORCHESTRATOR_MODELS.avalai,
    arvan: DEFAULT_ORCHESTRATOR_MODELS.arvan,
    omniroute: DEFAULT_ORCHESTRATOR_MODELS.omniroute,
  },
  subagentModels: {
    gemini: DEFAULT_SUBAGENT_MODELS.gemini,
    avalai: DEFAULT_SUBAGENT_MODELS.avalai,
    arvan: DEFAULT_SUBAGENT_MODELS.arvan,
    omniroute: DEFAULT_SUBAGENT_MODELS.omniroute,
  },
  tavilyApiKey: null,
  generation: { ...DEFAULT_AI_GENERATION },
};

function normalizeModelMap(
  raw: Partial<ProviderModelMap> | null | undefined,
  fallback: ProviderModelMap
): ProviderModelMap {
  return {
    gemini: raw?.gemini?.trim() || fallback.gemini,
    avalai: raw?.avalai?.trim() || fallback.avalai,
    arvan: raw?.arvan?.trim() || fallback.arvan,
    omniroute: raw?.omniroute?.trim() || fallback.omniroute,
  };
}

function parseOptionalNumber(
  value: unknown,
  opts: { min?: number; max?: number; integer?: boolean }
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(
    opts.max ?? n,
    Math.max(opts.min ?? n, n)
  );
  return opts.integer ? Math.round(clamped) : clamped;
}

function normalizeGeneration(
  raw:
    | Partial<Record<keyof AiGenerationParams, unknown>>
    | null
    | undefined
): AiGenerationParams {
  return {
    temperature: parseOptionalNumber(raw?.temperature, { min: 0, max: 2 }),
    topP: parseOptionalNumber(raw?.topP, { min: 0, max: 1 }),
    maxTokens: parseOptionalNumber(raw?.maxTokens, {
      min: 1,
      max: 128000,
      integer: true,
    }),
  };
}

function maskLast4(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return apiKey;
  return apiKey.slice(-4);
}

export function getAiDefaults(): AiDefaults {
  const stored = getSetting<Partial<AiDefaults>>(AI_DEFAULTS_KEY);
  if (!stored) {
    const env = process.env.AI_PROVIDER;
    return {
      ...DEFAULT_AI_DEFAULTS,
      defaultProvider: isAIProvider(env) ? env : DEFAULT_AI_DEFAULTS.defaultProvider,
      defaultModels: {
        gemini:
          process.env.GEMINI_DEFAULT_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.defaultModels.gemini,
        avalai:
          process.env.AVALAI_DEFAULT_MODEL?.trim() ||
          process.env.OPENAI_DEFAULT_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.defaultModels.avalai,
        arvan:
          process.env.ARVAN_DEFAULT_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.defaultModels.arvan,
        omniroute:
          process.env.OMNIROUTE_DEFAULT_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.defaultModels.omniroute,
      },
      embeddingModels: {
        gemini:
          process.env.GEMINI_EMBEDDING_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.embeddingModels.gemini,
        avalai:
          process.env.AVALAI_EMBEDDING_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.embeddingModels.avalai,
        arvan:
          process.env.ARVAN_EMBEDDING_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.embeddingModels.arvan,
        omniroute:
          process.env.OMNIROUTE_EMBEDDING_MODEL?.trim() ||
          DEFAULT_AI_DEFAULTS.embeddingModels.omniroute,
      },
      orchestratorModels: { ...DEFAULT_AI_DEFAULTS.orchestratorModels },
      subagentModels: { ...DEFAULT_AI_DEFAULTS.subagentModels },
      tavilyApiKey: process.env.TAVILY_API_KEY?.trim() || null,
      generation: normalizeGeneration({
        temperature: process.env.AI_TEMPERATURE,
        topP: process.env.AI_TOP_P,
        maxTokens: process.env.AI_MAX_TOKENS,
      }),
    };
  }

  const defaultProvider = isAIProvider(stored.defaultProvider)
    ? stored.defaultProvider
    : DEFAULT_AI_DEFAULTS.defaultProvider;

  return {
    defaultProvider,
    defaultModels: normalizeModelMap(
      stored.defaultModels,
      DEFAULT_AI_DEFAULTS.defaultModels
    ),
    embeddingModels: normalizeModelMap(
      stored.embeddingModels,
      DEFAULT_AI_DEFAULTS.embeddingModels
    ),
    orchestratorModels: normalizeModelMap(
      stored.orchestratorModels,
      DEFAULT_AI_DEFAULTS.orchestratorModels
    ),
    subagentModels: normalizeModelMap(
      stored.subagentModels,
      DEFAULT_AI_DEFAULTS.subagentModels
    ),
    tavilyApiKey:
      typeof stored.tavilyApiKey === "string" && stored.tavilyApiKey.trim()
        ? stored.tavilyApiKey.trim()
        : process.env.TAVILY_API_KEY?.trim() || null,
    generation: normalizeGeneration(
      stored.generation ?? DEFAULT_AI_DEFAULTS.generation
    ),
  };
}

export function getAiGenerationParams(): AiGenerationParams {
  return getAiDefaults().generation;
}

export type AgentModelRole = "orchestrator" | "subagent";

/** Resolve model id for workshop orchestrator or subagents. */
export function getAgentRoleModelId(
  role: AgentModelRole,
  provider?: string
): string {
  const id: AIProvider = isAIProvider(provider)
    ? provider
    : getResolvedDefaultProvider();
  const defaults = getAiDefaults();
  if (role === "orchestrator") {
    return (
      defaults.orchestratorModels[id]?.trim() ||
      defaults.defaultModels[id]?.trim() ||
      DEFAULT_AI_DEFAULTS.orchestratorModels[id]
    );
  }
  return (
    defaults.subagentModels[id]?.trim() ||
    defaults.defaultModels[id]?.trim() ||
    DEFAULT_AI_DEFAULTS.subagentModels[id]
  );
}

export function setAiDefaults(defaults: AiDefaults): void {
  setSetting(AI_DEFAULTS_KEY, defaults);
}

export function getAiProviderRow(id: AIProvider): AiProviderRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, api_key, base_url, enabled, extra_json
       FROM ai_providers WHERE id = ?`
    )
    .get(id) as
    | {
        id: string;
        api_key: string | null;
        base_url: string | null;
        enabled: number;
        extra_json: string | null;
      }
    | undefined;

  if (!row || !isAIProvider(row.id)) return null;

  return {
    id: row.id,
    apiKey: row.api_key,
    baseUrl: row.base_url,
    enabled: row.enabled === 1,
    extraJson: row.extra_json,
  };
}

export function listAiProviderRows(): AiProviderRow[] {
  return AI_PROVIDER_IDS.map((id) => {
    const row = getAiProviderRow(id);
    return (
      row || {
        id,
        apiKey: null,
        baseUrl: null,
        enabled: true,
        extraJson: null,
      }
    );
  });
}

export function upsertAiProvider(
  id: AIProvider,
  patch: {
    apiKey?: string | null;
    clearApiKey?: boolean;
    baseUrl?: string | null;
    enabled?: boolean;
    extraJson?: string | null;
  }
): void {
  const existing = getAiProviderRow(id);
  let apiKey = existing?.apiKey ?? null;
  if (patch.clearApiKey) {
    apiKey = null;
  } else if (patch.apiKey !== undefined && patch.apiKey !== null) {
    const trimmed = patch.apiKey.trim();
    if (trimmed) apiKey = trimmed;
  }

  const baseUrl =
    patch.baseUrl !== undefined
      ? patch.baseUrl?.trim() || null
      : (existing?.baseUrl ?? null);

  const enabled =
    patch.enabled !== undefined ? patch.enabled : (existing?.enabled ?? true);

  const extraJson =
    patch.extraJson !== undefined
      ? patch.extraJson
      : (existing?.extraJson ?? null);

  getDb()
    .prepare(
      `INSERT INTO ai_providers (id, api_key, base_url, enabled, extra_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         api_key = excluded.api_key,
         base_url = excluded.base_url,
         enabled = excluded.enabled,
         extra_json = excluded.extra_json,
         updated_at = excluded.updated_at`
    )
    .run(id, apiKey, baseUrl, enabled ? 1 : 0, extraJson, nowIso());
}

export function getPublicAiSettings(): PublicAiSettings {
  const defaults = getAiDefaults();
  const providers = listAiProviderRows().map((row) => {
    const envConfigured = isProviderConfiguredInEnv(row.id);
    const configured = !!(row.apiKey && row.apiKey.trim()) || envConfigured;
    return {
      id: row.id,
      configured,
      apiKeyLast4: maskLast4(row.apiKey) || (envConfigured ? "env" : null),
      baseUrl: row.baseUrl,
      enabled: row.enabled,
    } satisfies RedactedAiProvider;
  });

  return {
    defaultProvider: defaults.defaultProvider,
    defaultModels: defaults.defaultModels,
    embeddingModels: defaults.embeddingModels,
    orchestratorModels: defaults.orchestratorModels,
    subagentModels: defaults.subagentModels,
    tavilyConfigured: !!(
      defaults.tavilyApiKey?.trim() || process.env.TAVILY_API_KEY?.trim()
    ),
    tavilyApiKeyLast4:
      maskLast4(defaults.tavilyApiKey) ||
      (process.env.TAVILY_API_KEY?.trim() ? "env" : null),
    generation: defaults.generation,
    providers,
  };
}

function isProviderConfiguredInEnv(id: AIProvider): boolean {
  if (id === "gemini") return !!process.env.GEMINI_API_KEY?.trim();
  if (id === "avalai") {
    return !!(
      process.env.AVALAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
    );
  }
  if (id === "omniroute") {
    return !!process.env.OMNIROUTE_API_KEY?.trim();
  }
  return !!(
    process.env.ARVAN_API_KEY?.trim() &&
    (process.env.ARVAN_BASE_URL?.trim() ||
      process.env.ARVAN_GATEWAY_URL?.trim())
  );
}

export type ResolvedAiConfig = {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
};

export function getResolvedDefaultProvider(): AIProvider {
  const defaults = getAiDefaults();
  if (defaults.defaultProvider) return defaults.defaultProvider;
  const env = process.env.AI_PROVIDER;
  if (isAIProvider(env)) return env;
  return "gemini";
}

export function getResolvedAiConfig(provider?: string): ResolvedAiConfig {
  const id: AIProvider = isAIProvider(provider)
    ? provider
    : getResolvedDefaultProvider();

  const defaults = getAiDefaults();
  const row = getAiProviderRow(id);

  if (id === "gemini") {
    const apiKey =
      row?.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || "";
    return {
      provider: id,
      apiKey,
      baseUrl: "",
      defaultModel: defaults.defaultModels.gemini,
    };
  }

  if (id === "avalai") {
    const apiKey =
      row?.apiKey?.trim() ||
      process.env.AVALAI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      "";
    const baseUrl =
      row?.baseUrl?.trim() ||
      "https://api.avalai.ir/v1";
    return {
      provider: id,
      apiKey,
      baseUrl: baseUrl.replace(/\/+$/, ""),
      defaultModel:
        defaults.defaultModels.avalai ||
        process.env.AVALAI_DEFAULT_MODEL ||
        process.env.OPENAI_DEFAULT_MODEL ||
        "gpt-4o-mini",
    };
  }

  if (id === "omniroute") {
    const apiKey =
      row?.apiKey?.trim() || process.env.OMNIROUTE_API_KEY?.trim() || "";
    const baseUrl = (
      row?.baseUrl?.trim() ||
      process.env.OMNIROUTE_BASE_URL?.trim() ||
      OMNIROUTE_DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    return {
      provider: id,
      apiKey,
      baseUrl,
      defaultModel:
        defaults.defaultModels.omniroute ||
        process.env.OMNIROUTE_DEFAULT_MODEL?.trim() ||
        "auto",
    };
  }

  const apiKey =
    row?.apiKey?.trim() || process.env.ARVAN_API_KEY?.trim() || "";
  const baseUrl = (
    row?.baseUrl?.trim() ||
    process.env.ARVAN_BASE_URL?.trim() ||
    process.env.ARVAN_GATEWAY_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");

  return {
    provider: id,
    apiKey,
    baseUrl,
    defaultModel:
      defaults.defaultModels.arvan ||
      process.env.ARVAN_DEFAULT_MODEL?.trim() ||
      "Gemini-3-Flash-Preview",
  };
}

export type UpdateAiSettingsInput = {
  defaultProvider?: AIProvider;
  defaultModels?: Partial<AiDefaults["defaultModels"]>;
  embeddingModels?: Partial<AiDefaults["embeddingModels"]>;
  orchestratorModels?: Partial<AiDefaults["orchestratorModels"]>;
  subagentModels?: Partial<AiDefaults["subagentModels"]>;
  tavilyApiKey?: string | null;
  clearTavilyApiKey?: boolean;
  generation?: Partial<AiGenerationParams> | null;
  providers?: Array<{
    id: AIProvider;
    apiKey?: string | null;
    clearApiKey?: boolean;
    baseUrl?: string | null;
    enabled?: boolean;
  }>;
};

export function updateAiSettings(input: UpdateAiSettingsInput): PublicAiSettings {
  const current = getAiDefaults();
  let tavilyApiKey = current.tavilyApiKey;
  if (input.clearTavilyApiKey) {
    tavilyApiKey = null;
  } else if (input.tavilyApiKey !== undefined && input.tavilyApiKey !== null) {
    const trimmed = input.tavilyApiKey.trim();
    if (trimmed) tavilyApiKey = trimmed;
  }

  const next: AiDefaults = {
    defaultProvider: isAIProvider(input.defaultProvider)
      ? input.defaultProvider
      : current.defaultProvider,
    defaultModels: normalizeModelMap(
      {
        ...current.defaultModels,
        ...input.defaultModels,
      },
      DEFAULT_AI_DEFAULTS.defaultModels
    ),
    embeddingModels: normalizeModelMap(
      {
        ...current.embeddingModels,
        ...input.embeddingModels,
      },
      DEFAULT_AI_DEFAULTS.embeddingModels
    ),
    orchestratorModels: normalizeModelMap(
      {
        ...current.orchestratorModels,
        ...input.orchestratorModels,
      },
      DEFAULT_AI_DEFAULTS.orchestratorModels
    ),
    subagentModels: normalizeModelMap(
      {
        ...current.subagentModels,
        ...input.subagentModels,
      },
      DEFAULT_AI_DEFAULTS.subagentModels
    ),
    tavilyApiKey,
    generation:
      input.generation !== undefined
        ? normalizeGeneration({
            ...current.generation,
            ...input.generation,
          })
        : current.generation,
  };
  setAiDefaults(next);

  if (input.providers?.length) {
    for (const p of input.providers) {
      if (!isAIProvider(p.id)) continue;
      upsertAiProvider(p.id, {
        apiKey: p.apiKey,
        clearApiKey: p.clearApiKey,
        baseUrl: p.baseUrl,
        enabled: p.enabled,
      });
    }
  }

  return getPublicAiSettings();
}

export function getResolvedTavilyApiKey(): string {
  const fromSettings = getAiDefaults().tavilyApiKey?.trim();
  if (fromSettings) return fromSettings;
  return process.env.TAVILY_API_KEY?.trim() || "";
}
