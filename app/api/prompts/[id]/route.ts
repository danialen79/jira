import { NextResponse } from "next/server";
import { deleteCustomPrompt } from "@/lib/db/repos/prompts";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const ok = deleteCustomPrompt(id);
    if (!ok) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete prompt" },
      { status: 500 }
    );
  }
}
