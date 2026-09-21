import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getAiGenerationParams,
  getResolvedAiConfig,
  isAIProvider,
} from "@/lib/db/repos/ai";
import { embedText } from "@/lib/embeddings";
import { getGeminiClient } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = body?.provider;
    const mode = body?.mode === "embed" ? "embed" : "chat";

    if (!isAIProvider(provider)) {
      return NextResponse.json(
        { error: "provider must be gemini, avalai, arvan, or omniroute" },
        { status: 400 }
      );
    }

    if (mode === "embed") {
      const result = await embedText("knowledge embed test", provider);
      return NextResponse.json({
        success: true,
        mode: "embed",
        provider: result.provider,
        model: result.model,
        dims: result.dims,
        preview: `dims=${result.dims}`,
      });
    }

    const config = getResolvedAiConfig(provider);
    const generation = getAiGenerationParams();

    if (provider === "gemini") {
      if (!config.apiKey) {
        return NextResponse.json(
          { success: false, error: "GEMINI API key is not configured" },
          { status: 400 }
        );
      }
      const ai = getGeminiClient(config.apiKey);
      const geminiConfig: Record<string, unknown> = {};
      if (generation.temperature != null) {
        geminiConfig.temperature = generation.temperature;
      }
      if (generation.topP != null) geminiConfig.topP = generation.topP;
      if (generation.maxTokens != null) {
        geminiConfig.maxOutputTokens = generation.maxTokens;
      }
      const response = await ai.models.generateContent({
        model: config.defaultModel || "gemini-3.5-flash",
        contents: "Reply with the single word: ok",
        ...(Object.keys(geminiConfig).length
          ? { config: geminiConfig }
          : {}),
      });
      const text = response?.text?.trim() || "";
      return NextResponse.json({
        success: true,
        provider,
        model: config.defaultModel,
        preview: text.slice(0, 80),
      });
    }

    if (!config.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: `${provider} API key is not configured`,
        },
        { status: 400 }
      );
    }
    if (
      (provider === "arvan" || provider === "omniroute") &&
      !config.baseUrl
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `${provider === "omniroute" ? "OmniRoute" : "Arvan"} base URL is not configured`,
        },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });

    const payload: Record<string, unknown> = {
      model: config.defaultModel,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
    };
    if (generation.temperature != null) {
      payload.temperature = generation.temperature;
    }
    if (generation.topP != null) payload.top_p = generation.topP;
    if (generation.maxTokens != null) {
      payload.max_tokens = generation.maxTokens;
    } else {
      payload.max_tokens = 16;
    }

    const resp = await openai.chat.completions.create(payload as any);

    const preview =
      resp?.choices?.[0]?.message?.content?.toString?.()?.slice(0, 80) || "";

    return NextResponse.json({
      success: true,
      provider,
      model: config.defaultModel,
      preview,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "AI connection test failed",
      },
      { status: 500 }
    );
  }
}
