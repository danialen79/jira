import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge/search";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body?.query || "").trim();
    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }
    const outcome = await searchKnowledge(query, {
      k: typeof body?.k === "number" ? body.k : 8,
      provider: body?.provider,
    });
    return NextResponse.json({ hits: outcome.hits, stale: outcome.stale });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Search failed" },
      { status: 500 }
    );
  }
}
