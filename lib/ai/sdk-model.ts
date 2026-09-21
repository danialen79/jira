import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import {
  getAgentRoleModelId,
  getAiGenerationParams,
  getResolvedAiConfig,
  getResolvedDefaultProvider,
  isAIProvider,
  type AgentModelRole,
  type AIProvider,
} from "@/lib/db/repos/ai";

export function resolveChatProvider(provider?: string): AIProvider {
  return isAIProvider(provider) ? provider : getResolvedDefaultProvider();
}

export function getSdkLanguageModel(
  provider?: string,
  modelOverride?: string
): { model: LanguageModel; provider: AIProvider; modelId: string } {
  const id = resolveChatProvider(provider);
  const config = getResolvedAiConfig(id);
  const modelId = (modelOverride || config.defaultModel).trim();

  if (!config.apiKey) {
    throw new Error(`${id} API key is not configured`);
  }

  if (id === "gemini") {
    const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
    return {
      model: google(modelId),
      provider: id,
      modelId,
    };
  }

  if ((id === "arvan" || id === "omniroute") && !config.baseUrl) {
    throw new Error(`${id} base URL is not configured`);
  }

  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });

  return {
    model: openai.chat(modelId),
    provider: id,
    modelId,
  };
}

/** Language model for workshop orchestrator or subagents (from AI settings). */
export function getSdkAgentRoleModel(
  role: AgentModelRole,
  provider?: string,
  modelOverride?: string
): { model: LanguageModel; provider: AIProvider; modelId: string } {
  const id = resolveChatProvider(provider);
  const modelId = (modelOverride || getAgentRoleModelId(role, id)).trim();
  return getSdkLanguageModel(id, modelId);
}

export function getSdkGenerationOptions(): {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
} {
  const g = getAiGenerationParams();
  const out: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  } = {};
  if (g.temperature != null) out.temperature = g.temperature;
  if (g.topP != null) out.topP = g.topP;
  if (g.maxTokens != null) out.maxOutputTokens = g.maxTokens;
  return out;
}
