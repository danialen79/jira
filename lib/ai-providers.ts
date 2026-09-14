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

export function isAIProvider(value: unknown): value is AIProvider {
  return (
    value === "gemini" ||
    value === "avalai" ||
    value === "arvan" ||
    value === "omniroute"
  );
}
