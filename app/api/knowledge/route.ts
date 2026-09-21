import { NextResponse } from "next/server";
import {
  deleteKnowledgeDoc,
  getKnowledgeDoc,
  knowledgeStats,
  listKnowledgeDocs,
} from "@/lib/db/repos/knowledge";
import {
  ingestChatTranscript,
  ingestWorkshopSession,
} from "@/lib/knowledge/conversation-ingest";
import { ingestDocument, reembedAllDocuments } from "@/lib/knowledge/search";
import { refineKnowledge } from "@/lib/knowledge/refine";

export const maxDuration = 120;

export async function GET() {
  try {
    const docs = listKnowledgeDocs(500);
    const stats = knowledgeStats();
    return NextResponse.json({ docs, stats });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to list knowledge" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action || "ingest";

    if (action === "reembed") {
      const result = await reembedAllDocuments(body?.provider);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "refine") {
      const result = await refineKnowledge({ provider: body?.provider });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "conversation") {
      const kind = body?.kind;
      if (kind === "workshop") {
        const sessionId = String(body?.sessionId || "").trim();
        if (!sessionId) {
          return NextResponse.json(
            { error: "sessionId required" },
            { status: 400 }
          );
        }
        const result = await ingestWorkshopSession({
          sessionId,
          provider: body?.provider,
          force: !!body?.force,
        });
        if (!result) {
          return NextResponse.json(
            { error: "جلسه خالی یا پیدا نشد" },
            { status: 400 }
          );
        }
        if (result.skipped) {
          return NextResponse.json({
            success: true,
            skipped: true,
            message: "قبلاً در دانش ذخیره شده",
          });
        }
        return NextResponse.json({
          success: true,
          docId: result.docId,
          chunkCount: result.chunkCount,
        });
      }

      if (kind === "research" || kind === "chat") {
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const turns = messages
          .map((m: any) => {
            let content = "";
            if (typeof m?.content === "string") content = m.content;
            else if (Array.isArray(m?.parts)) {
              content = m.parts
                .filter((p: any) => p?.type === "text")
                .map((p: any) => p.text)
                .join("");
            }
            const role =
              m?.role === "assistant" ||
              m?.role === "user" ||
              m?.role === "system"
                ? m.role
                : null;
            if (!role || !content.trim()) return null;
            return { role, content: content.trim() };
          })
          .filter(Boolean) as Array<{
          role: "user" | "assistant" | "system";
          content: string;
        }>;

        const title =
          String(body?.title || "").trim() ||
          `گفتگو ${new Date().toLocaleDateString("fa-IR")}`;
        const result = await ingestChatTranscript({
          title,
          messages: turns,
          source: "research",
          provider: body?.provider,
          metadata: body?.metadata,
        });
        if (!result) {
          return NextResponse.json(
            { error: "گفتگو برای ذخیره کافی نیست" },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          docId: result.docId,
          chunkCount: result.chunkCount,
        });
      }

      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }

    const title = String(body?.title || "").trim();
    const rawText = String(body?.rawText || body?.text || "").trim();
    const source = body?.source || "manual";
    if (!title || !rawText) {
      return NextResponse.json(
        { error: "title and text are required" },
        { status: 400 }
      );
    }
    if (
      source !== "manual" &&
      source !== "research" &&
      source !== "workshop" &&
      source !== "jira"
    ) {
      return NextResponse.json({ error: "invalid source" }, { status: 400 });
    }

    const result = await ingestDocument({
      title,
      rawText,
      source,
      provider: body?.provider,
      metadata: body?.metadata,
      layer: "canonical",
    });

    return NextResponse.json({
      success: true,
      doc: result.doc,
      chunkCount: result.chunkCount,
      model: result.model,
      skipped: result.skipped,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Ingest failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (!getKnowledgeDoc(id)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    deleteKnowledgeDoc(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
