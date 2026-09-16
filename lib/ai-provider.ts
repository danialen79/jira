import OpenAI from "openai";
import {
  aiWorklogResponseSchema,
  buildRefineModelQueue,
  buildRefineSingleModelQueue,
  getGeminiClient,
  mattermostRefineResponseSchema,
  refineIssuesResponseSchema,
  refineSingleResponseSchema,
} from "@/lib/gemini";
import {
  getResolvedAiConfig,
  getResolvedDefaultProvider,
  type AIProvider,
} from "@/lib/db/repos/ai";
import { isAIProvider } from "@/lib/ai-providers";

export type { AIProvider };
export type AIResponseKind =
  | "refineIssues"
  | "refineSingle"
  | "aiWorklogPlan"
  | "mattermostRefine";

function normalizeProvider(provider?: string): AIProvider {
  if (isAIProvider(provider)) return provider;
  return getResolvedDefaultProvider();
}

function getAvalaiDefaultModel(): string {
  return getResolvedAiConfig("avalai").defaultModel;
}

function getOmnirouteDefaultModel(): string {
  return getResolvedAiConfig("omniroute").defaultModel || "auto";
}

function getArvanBaseURL(): string {
  return getResolvedAiConfig("arvan").baseUrl;
}

/** Extract model slug from Arvan gateway URLs like .../gateway/models/{Model}/.../v1 */
function extractArvanModelFromBaseURL(baseURL: string): string | null {
  const match = baseURL.match(/\/gateway\/models\/([^/]+)\//i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function getArvanDefaultModel(): string {
  const resolved = getResolvedAiConfig("arvan");
  if (resolved.defaultModel) return resolved.defaultModel;
  const fromUrl = extractArvanModelFromBaseURL(resolved.baseUrl);
  if (fromUrl) return fromUrl;
  return "Gemini-3-Flash-Preview";
}

function resolveArvanModel(requested?: string): string {
  const fallback = getArvanDefaultModel();
  const model = (requested || "").trim();
  // Legacy UI default that does not match Arvan Gemini gateways
  if (!model || model === "gpt-4o-mini") return fallback;
  return model;
}

function extractChatContent(message: any): string {
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        if (part?.type === "text" && part?.text) return part.text;
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }
  if (typeof message?.refusal === "string" && message.refusal.trim()) {
    throw new Error(`Model refused the request: ${message.refusal}`);
  }
  return "";
}

function formatOpenAICompatError(providerLabel: string, err: any): Error {
  const cause = err?.cause;
  const code = cause?.code || err?.code;
  const hostname = cause?.hostname || "";
  if (code === "EAI_AGAIN" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    return new Error(
      `${providerLabel} network/DNS error (${code}${hostname ? ` for ${hostname}` : ""}). Check internet/DNS/VPN and retry.`
    );
  }
  if (err?.message === "Connection error." || cause?.message === "fetch failed") {
    return new Error(
      `${providerLabel} connection failed${hostname ? ` (${hostname})` : ""}. ${cause?.message || err?.message || "Unknown network error"}`
    );
  }
  const apiMsg =
    err?.error?.message ||
    err?.message ||
    (typeof err === "string" ? err : "Unknown API error");
  return new Error(`${providerLabel}: ${apiMsg}`);
}

function getGeminiDefaultModel(_kind: AIResponseKind): string {
  return "gemini-3.5-flash";
}

function getOpenAIJsonGuidance(kind: AIResponseKind): string {
  switch (kind) {
    case "refineIssues":
      return `Return ONLY a valid JSON object with this shape:
{
  "issues": [
    {
      "id": "string",
      "summary": "string",
      "description": "string",
      "issuetype": "Story" | "Epic" | "Bug",
      "epicReference": "string" | null,
      "suggestedPriority": "Highest" | "High" | "Medium" | "Low" | "Lowest",
      "suggestedComponent": "string"
    }
  ]
}`;
    case "refineSingle":
      return `Return ONLY a valid JSON object with this shape:
{
  "summary": "string",
  "description": "string",
  "suggestedPriority": "Highest" | "High" | "Medium" | "Low" | "Lowest",
  "suggestedComponent": "string"
}`;
    case "aiWorklogPlan":
      return `Return ONLY a valid JSON object with this shape:
{
  "proposals": [
    {
      "parentType": "existing" | "new",
      "parentKey": "string",
      "candidateParentKeys": ["string"],
      "proposedParentStory": { "summary": "string", "description": "string" },
      "subTaskSummary": "string",
      "timeSpent": "string",
      "comment": "string"
    }
  ]
}`;
    case "mattermostRefine":
      return `Return ONLY a valid JSON object with this shape:
{
  "issues": [
    {
      "id": "string",
      "summary": "string",
      "description": "string",
      "issuetype": "Story" | "Epic" | "Bug",
      "epicReference": "string" | null,
      "suggestedPriority": "Highest" | "High" | "Medium" | "Low" | "Lowest",
      "suggestedComponent": "string"
    }
  ]
}`;
    default:
      return "Return ONLY valid JSON.";
  }
}

function parseJsonLoose(text: string): any {
  const raw = (text || "").trim();
  if (!raw) throw new Error("Empty response from AI.");

  const withoutFences = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const firstBrace = withoutFences.indexOf("{");
    const lastBrace = withoutFences.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const maybeJson = withoutFences.slice(firstBrace, lastBrace + 1);
      return JSON.parse(maybeJson);
    }
    throw new Error("Failed to parse AI JSON response.");
  }
}

function getModelQueue(params: {
  provider: AIProvider;
  kind: AIResponseKind;
  model?: string;
}): string[] {
  const { provider, kind, model } = params;

  if (provider === "gemini") {
    if (kind === "refineSingle") return buildRefineSingleModelQueue(model);
    if (kind === "refineIssues") return buildRefineModelQueue(model);
    const selectedModel = model || getGeminiDefaultModel(kind);
    return [selectedModel];
  }

  if (provider === "arvan") {
    return [resolveArvanModel(model)];
  }

  if (provider === "omniroute") {
    return [model || getOmnirouteDefaultModel()];
  }

  return [model || getAvalaiDefaultModel()];
}

async function generateWithGemini(params: {
  model: string;
  kind: AIResponseKind;
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
}): Promise<any> {
  const resolved = getResolvedAiConfig("gemini");
  const ai = getGeminiClient(resolved.apiKey || undefined);
  const responseSchema =
    params.kind === "refineIssues"
      ? refineIssuesResponseSchema
      : params.kind === "refineSingle"
        ? refineSingleResponseSchema
        : params.kind === "aiWorklogPlan"
          ? aiWorklogResponseSchema
          : mattermostRefineResponseSchema;

  const aiResponse = await ai.models.generateContent({
    model: params.model,
    contents: params.userPrompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  if (!aiResponse || !aiResponse.text) {
    throw new Error("No response returned from Gemini API.");
  }

  return parseJsonLoose(aiResponse.text);
}

async function generateWithOpenAICompatible(params: {
  provider: "avalai" | "arvan" | "omniroute";
  model: string;
  kind: AIResponseKind;
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
}): Promise<any> {
  const resolved = getResolvedAiConfig(params.provider);
  const apiKey = resolved.apiKey;
  const baseURL = resolved.baseUrl;
  const providerLabel =
    params.provider === "avalai"
      ? "AvalAI"
      : params.provider === "omniroute"
        ? "OmniRoute"
        : "Arvan AIaaS";

  if (params.provider === "avalai") {
    if (!apiKey) {
      throw new Error(
        "AVALAI_API_KEY is not defined. Add it in Settings or environment variables."
      );
    }
  } else if (params.provider === "omniroute") {
    if (!apiKey) {
      throw new Error(
        "OMNIROUTE_API_KEY is not defined. Add it in Settings or environment variables."
      );
    }
    if (!baseURL) {
      throw new Error(
        "OMNIROUTE_BASE_URL is not defined. Set your OmniRoute URL in Settings."
      );
    }
  } else {
    if (!apiKey) {
      throw new Error(
        "ARVAN_API_KEY is not defined. Add it in Settings or environment variables."
      );
    }
    if (!baseURL) {
      throw new Error(
        "ARVAN_BASE_URL is not defined. Set your Arvan Gateway URL in Settings or environment."
      );
    }
  }

  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

  const model =
    params.provider === "arvan"
      ? resolveArvanModel(params.model)
      : params.model;

  const systemMsg =
    params.systemInstruction +
    "\n\nCRITICAL: Return JSON only (no Markdown, no extra text).\n" +
    getOpenAIJsonGuidance(params.kind);

  let resp: any;
  try {
    resp = await openai.chat.completions.create({
      model,
      temperature: params.temperature,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: params.userPrompt },
      ],
    } as any);
  } catch (err: any) {
    throw formatOpenAICompatError(providerLabel, err);
  }

  const choice = resp?.choices?.[0];
  const content = extractChatContent(choice?.message);
  if (!content) {
    const finishReason = choice?.finish_reason || "unknown";
    console.error(
      `[${providerLabel}] Empty content. model=${model} finish_reason=${finishReason}`,
      JSON.stringify(resp)?.slice(0, 2000)
    );
    throw new Error(
      `No content returned from ${providerLabel} API (model=${model}, finish_reason=${finishReason}). Check ARVAN_BASE_URL / ARVAN_DEFAULT_MODEL match your panel endpoint.`
    );
  }
  return parseJsonLoose(content);
}

export async function generateAIJson(params: {
  provider?: AIProvider | string;
  kind: AIResponseKind;
  model?: string;
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
}): Promise<{ data: any; successfulModel: string; provider: AIProvider }> {
  const provider = normalizeProvider(params.provider as string | undefined);
  const modelQueue = getModelQueue({
    provider,
    kind: params.kind,
    model: params.model,
  });

  let lastError: any = null;
  for (const currentModel of modelQueue) {
    try {
      const data =
        provider === "gemini"
          ? await generateWithGemini({
              model: currentModel,
              kind: params.kind,
              systemInstruction: params.systemInstruction,
              userPrompt: params.userPrompt,
              temperature: params.temperature,
            })
          : await generateWithOpenAICompatible({
              provider: provider as "avalai" | "arvan" | "omniroute",
              model: currentModel,
              kind: params.kind,
              systemInstruction: params.systemInstruction,
              userPrompt: params.userPrompt,
              temperature: params.temperature,
            });
      return { data, successfulModel: currentModel, provider };
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError || new Error("AI generation failed.");
}
