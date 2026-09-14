import { getDb, nowIso } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/db/repos/settings";
import {
  AI_PROVIDER_IDS,
  DEFAULT_AI_MODELS,
  isAIProvider,
  OMNIROUTE_DEFAULT_BASE_URL,
  type AIProvider,
} from "@/lib/ai-providers";

export type { AIProvider };
export {
  AI_PROVIDER_IDS,
  isAIProvider,
  OMNIROUTE_DEFAULT_BASE_URL,
};

export type AiDefaults = {
  defaultProvider: AIProvider;
  defaultModels: {
    gemini: string;
    avalai: string;
    arvan: string;
    omniroute: string;
  };
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
  providers: RedactedAiProvider[];
};

const AI_DEFAULTS_KEY = "ai.defaults";

export const DEFAULT_AI_DEFAULTS: AiDefaults = {
  defaultProvider: "gemini",
  defaultModels: {
    gemini: DEFAULT_AI_MODELS.gemini,
    avalai: DEFAULT_AI_MODELS.avalai,
    arvan: DEFAULT_AI_MODELS.arvan,
    omniroute: DEFAULT_AI_MODELS.omniroute,
  },
};

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
    };
  }

  const defaultProvider = isAIProvider(stored.defaultProvider)
    ? stored.defaultProvider
    : DEFAULT_AI_DEFAULTS.defaultProvider;

  return {
    defaultProvider,
    defaultModels: {
      gemini:
        stored.defaultModels?.gemini || DEFAULT_AI_DEFAULTS.defaultModels.gemini,
      avalai:
        stored.defaultModels?.avalai || DEFAULT_AI_DEFAULTS.defaultModels.avalai,
      arvan:
        stored.defaultModels?.arvan || DEFAULT_AI_DEFAULTS.defaultModels.arvan,
      omniroute:
        stored.defaultModels?.omniroute ||
        DEFAULT_AI_DEFAULTS.defaultModels.omniroute,
    },
  };
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
  const next: AiDefaults = {
    defaultProvider: isAIProvider(input.defaultProvider)
      ? input.defaultProvider
      : current.defaultProvider,
    defaultModels: {
      gemini: input.defaultModels?.gemini || current.defaultModels.gemini,
      avalai: input.defaultModels?.avalai || current.defaultModels.avalai,
      arvan: input.defaultModels?.arvan || current.defaultModels.arvan,
      omniroute:
        input.defaultModels?.omniroute || current.defaultModels.omniroute,
    },
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
