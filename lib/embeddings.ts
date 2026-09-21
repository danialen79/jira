import OpenAI from "openai";
import {
  DEFAULT_EMBEDDING_MODELS,
  type AIProvider,
} from "@/lib/ai-providers";
import {
  getAiDefaults,
  getResolvedAiConfig,
  getResolvedDefaultProvider,
  isAIProvider,
} from "@/lib/db/repos/ai";
import { getGeminiClient } from "@/lib/gemini";

export type EmbedResult = {
  vectors: number[][];
  model: string;
  dims: number;
  provider: AIProvider;
};

function float32ToBuffer(vector: number[]): Buffer {
  const buf = Buffer.alloc(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buf.writeFloatLE(vector[i]!, i * 4);
  }
  return buf;
}

export function bufferToFloat32(buf: Buffer): number[] {
  const out: number[] = [];
  for (let i = 0; i + 3 < buf.length; i += 4) {
    out.push(buf.readFloatLE(i));
  }
  return out;
}

export function embeddingToBlob(vector: number[]): Buffer {
  return float32ToBuffer(vector);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function resolveEmbeddingModel(provider?: string): {
  provider: AIProvider;
  model: string;
} {
  const id: AIProvider = isAIProvider(provider)
    ? provider
    : getResolvedDefaultProvider();
  const defaults = getAiDefaults();
  const model =
    defaults.embeddingModels?.[id]?.trim() ||
    DEFAULT_EMBEDDING_MODELS[id];
  return { provider: id, model };
}

async function embedWithGemini(
  apiKey: string,
  model: string,
  texts: string[]
): Promise<number[][]> {
  const ai = getGeminiClient(apiKey);
  const vectors: number[][] = [];
  for (const text of texts) {
    const res = await ai.models.embedContent({
      model,
      contents: text,
    });
    const values =
      res.embeddings?.[0]?.values ||
      (res as { embedding?: { values?: number[] } }).embedding?.values;
    if (!values?.length) {
      throw new Error(`Gemini embedding returned empty vector (model=${model})`);
    }
    vectors.push(Array.from(values));
  }
  return vectors;
}

async function embedWithOpenAICompat(
  apiKey: string,
  baseUrl: string,
  model: string,
  texts: string[],
  providerLabel: string
): Promise<number[][]> {
  const openai = new OpenAI({
    apiKey,
    baseURL: baseUrl || undefined,
  });
  const resp = await openai.embeddings.create({
    model,
    input: texts.length === 1 ? texts[0]! : texts,
  });
  const sorted = [...(resp.data || [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );
  if (sorted.length !== texts.length) {
    throw new Error(
      `${providerLabel} embedding count mismatch: expected ${texts.length}, got ${sorted.length}`
    );
  }
  return sorted.map((row) => {
    const emb = row.embedding;
    if (!emb?.length) {
      throw new Error(`${providerLabel} embedding returned empty vector`);
    }
    return emb;
  });
}

export async function embedTexts(
  texts: string[],
  provider?: string
): Promise<EmbedResult> {
  const cleaned = texts.map((t) => t.trim()).filter(Boolean);
  if (!cleaned.length) {
    throw new Error("No text to embed");
  }

  const { provider: id, model } = resolveEmbeddingModel(provider);
  const config = getResolvedAiConfig(id);

  if (!config.apiKey) {
    throw new Error(`${id} API key is not configured for embeddings`);
  }

  let vectors: number[][];
  if (id === "gemini") {
    vectors = await embedWithGemini(config.apiKey, model, cleaned);
  } else {
    if ((id === "arvan" || id === "omniroute") && !config.baseUrl) {
      throw new Error(`${id} base URL is not configured for embeddings`);
    }
    vectors = await embedWithOpenAICompat(
      config.apiKey,
      config.baseUrl,
      model,
      cleaned,
      id
    );
  }

  const dims = vectors[0]?.length ?? 0;
  if (!dims) throw new Error("Embedding dimension is 0");

  return { vectors, model, dims, provider: id };
}

export async function embedText(
  text: string,
  provider?: string
): Promise<{ vector: number[]; model: string; dims: number; provider: AIProvider }> {
  const result = await embedTexts([text], provider);
  return {
    vector: result.vectors[0]!,
    model: result.model,
    dims: result.dims,
    provider: result.provider,
  };
}
