export type AIProvider = "gemini" | "avalai" | "arvan" | "omniroute";

export const AI_PROVIDER_IDS: AIProvider[] = [
  "gemini",
  "avalai",
  "arvan",
  "omniroute",
];

export const OMNIROUTE_DEFAULT_BASE_URL = "https://omniroute.smartx.ir/v1";

export const DEFAULT_AI_MODELS = {
  gemini: "gemini-3.5-flash",
  avalai: "gpt-4o-mini",
  arvan: "Gemini-3-Flash-Preview",
  omniroute: "auto",
} as const;

/** Stronger models for workshop interview orchestrator. */
export const DEFAULT_ORCHESTRATOR_MODELS = {
  gemini: "gemini-3.1-pro-preview",
  avalai: "gpt-4o",
  arvan: "Gemini-3-Flash-Preview",
  omniroute: "auto/coding",
} as const;

/** Cheaper/faster models for knowledge / Jira / web subagents. */
export const DEFAULT_SUBAGENT_MODELS = {
  gemini: "gemini-3.5-flash",
  avalai: "gpt-4o-mini",
  arvan: "Gemini-3-Flash-Preview",
  omniroute: "auto/cheap",
} as const;

/** Embedding models per chat provider (same API key / base URL). */
export const DEFAULT_EMBEDDING_MODELS = {
  gemini: "text-embedding-004",
  avalai: "text-embedding-3-small",
  arvan: "text-embedding-004",
  omniroute: "text-embedding-3-small",
} as const;

export type ProviderModelMap = {
  gemini: string;
  avalai: string;
  arvan: string;
  omniroute: string;
};

export function isAIProvider(value: unknown): value is AIProvider {
  return (
    value === "gemini" ||
    value === "avalai" ||
    value === "arvan" ||
    value === "omniroute"
  );
}
