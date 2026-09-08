import { NextResponse } from "next/server";
import {
  createCustomPrompt,
  listCustomPrompts,
  replaceAllCustomPrompts,
} from "@/lib/db/repos/prompts";

export async function GET() {
  try {
    return NextResponse.json({ prompts: listCustomPrompts() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to list prompts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (Array.isArray(body?.prompts)) {
      const prompts = replaceAllCustomPrompts(
        body.prompts.map((p: any) => ({
          id: String(p.id || crypto.randomUUID()),
          name: String(p.name || ""),
          prompt: String(p.prompt || ""),
          description: String(p.desc || p.description || ""),
        }))
      );
      return NextResponse.json({ prompts });
    }

    if (!body?.name || !body?.prompt) {
      return NextResponse.json(
        { error: "name and prompt are required" },
        { status: 400 }
      );
    }

    const prompt = createCustomPrompt({
      id: body.id,
      name: String(body.name),
      prompt: String(body.prompt),
      description: String(body.desc || body.description || ""),
    });
    return NextResponse.json({ prompt });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save prompt" },
      { status: 500 }
    );
  }
}
