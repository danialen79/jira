import { NextResponse } from "next/server";
import {
  getPublicAiSettings,
  updateAiSettings,
  type AIProvider,
  type UpdateAiSettingsInput,
} from "@/lib/db/repos/ai";

function isAIProvider(value: unknown): value is AIProvider {
  return value === "gemini" || value === "avalai" || value === "arvan";
}

export async function GET() {
  try {
    return NextResponse.json(getPublicAiSettings());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load AI settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as UpdateAiSettingsInput;
    if (body.defaultProvider && !isAIProvider(body.defaultProvider)) {
      return NextResponse.json(
        { error: "Invalid defaultProvider" },
        { status: 400 }
      );
    }
    if (body.providers) {
      for (const p of body.providers) {
        if (!isAIProvider(p.id)) {
          return NextResponse.json(
            { error: `Invalid provider id: ${p.id}` },
            { status: 400 }
          );
        }
      }
    }
    const settings = updateAiSettings(body);
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save AI settings" },
      { status: 500 }
    );
  }
}
