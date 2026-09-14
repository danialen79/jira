import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getResolvedAiConfig,
  isAIProvider,
} from "@/lib/db/repos/ai";
import { getGeminiClient } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = body?.provider;
    if (!isAIProvider(provider)) {
      return NextResponse.json(
        { error: "provider must be gemini, avalai, arvan, or omniroute" },
        { status: 400 }
      );
    }

    const config = getResolvedAiConfig(provider);

    if (provider === "gemini") {
      if (!config.apiKey) {
        return NextResponse.json(
          { success: false, error: "GEMINI API key is not configured" },
          { status: 400 }
        );
      }
      const ai = getGeminiClient(config.apiKey);
      const response = await ai.models.generateContent({
        model: config.defaultModel || "gemini-3.5-flash",
        contents: "Reply with the single word: ok",
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

    const resp = await openai.chat.completions.create({
      model: config.defaultModel,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      max_tokens: 16,
    } as any);

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
