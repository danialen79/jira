import { ingestDocument } from "@/lib/knowledge/search";
import {
  getInterviewSession,
  listKnowledgeDocs,
  markDocsSuperseded,
  updateInterviewSession,
  type InterviewCoverage,
  type InterviewMessage,
  type KnowledgeDoc,
  type KnowledgeSession,
} from "@/lib/db/repos/knowledge";
import type { AIProvider } from "@/lib/ai-providers";
import { extractCanonicalFromText } from "@/lib/knowledge/extract";

export type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

function coverageLines(c: InterviewCoverage): string {
  const labels: Array<[keyof InterviewCoverage, string]> = [
    ["goal", "هدف"],
    ["user", "کاربر"],
    ["acceptance", "پذیرش"],
    ["outOfScope", "خارج از scope"],
    ["dependencies", "وابستگی"],
    ["risks", "ریسک"],
  ];
  return labels
    .map(([k, label]) => `- ${label}: ${c[k] ? "پوشش داده شد" : "ناقص"}`)
    .join("\n");
}

export function formatWorkshopKnowledgeText(session: KnowledgeSession): string {
  const parts: string[] = [];
  if (session.draftText.trim()) {
    parts.push(`## پیش‌نویس\n${session.draftText.trim()}`);
  }
  parts.push(`## پوشش مصاحبه\n${coverageLines(session.coverage)}`);
  if (session.messages.length) {
    const dialog = session.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => `${m.role === "user" ? "کاربر" : "AI"}: ${m.content}`)
      .join("\n\n");
    parts.push(`## گفتگوی مصاحبه\n${dialog}`);
  }
  if (session.output && typeof session.output === "object") {
    const out = session.output as { issues?: unknown; notes?: string };
    if (out.notes) parts.push(`## یادداشت\n${out.notes}`);
    if (Array.isArray(out.issues) && out.issues.length) {
      parts.push(
        `## خروجی استوری‌ها\n${JSON.stringify(out.issues, null, 2)}`
      );
    }
  }
  return parts.join("\n\n").trim();
}

function formatWorkshopExtractFallback(session: KnowledgeSession): string {
  const parts: string[] = [];
  if (session.draftText.trim()) {
    parts.push(`## پیش‌نویس\n${session.draftText.trim()}`);
  }
  parts.push(`## پوشش مصاحبه\n${coverageLines(session.coverage)}`);
  if (session.output && typeof session.output === "object") {
    const out = session.output as { issues?: unknown; notes?: string };
    if (out.notes) parts.push(`## یادداشت\n${out.notes}`);
    if (Array.isArray(out.issues) && out.issues.length) {
      parts.push(
        `## خروجی استوری‌ها\n${JSON.stringify(out.issues, null, 2)}`
      );
    }
  }
  return parts.join("\n\n").trim();
}

export function formatChatTranscript(messages: ChatTurn[]): string {
  return messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .map((m) => `${m.role === "user" ? "کاربر" : "AI"}: ${m.content.trim()}`)
    .join("\n\n");
}

function docsForSession(sessionId: string): KnowledgeDoc[] {
  return listKnowledgeDocs(500).filter((d) => {
    const meta = d.metadata as { sessionId?: string };
    return meta?.sessionId === sessionId;
  });
}

async function ingestExtractedCanonical(input: {
  title: string;
  source: "workshop" | "research" | "manual";
  fallbackText?: string;
  extractSource: string;
  provider?: string | AIProvider;
  metadata: Record<string, unknown>;
}): Promise<{ docId: string; chunkCount: number; skipped?: string } | null> {
  let title = input.title;
  let canonicalText = "";
  try {
    const extracted = await extractCanonicalFromText({
      title: input.title,
      text: input.extractSource,
      provider: input.provider,
    });
    if (extracted.skip || !extracted.canonicalText.trim()) {
      return null;
    }
    title = extracted.title.trim() || input.title;
    canonicalText = extracted.canonicalText.trim();
  } catch (err) {
    console.error("knowledge extract failed; using fallback", err);
    canonicalText = (input.fallbackText || "").trim();
  }

  if (!canonicalText || canonicalText.length < 40) return null;

  const result = await ingestDocument({
    title,
    source: input.source,
    rawText: canonicalText,
    provider: input.provider,
    layer: "canonical",
    metadata: input.metadata,
  });

  return {
    docId: result.doc.id,
    chunkCount: result.chunkCount,
    skipped: result.skipped,
  };
}

/**
 * Store the workshop transcript as raw archive, then extract+embed a canonical note.
 */
export async function ingestWorkshopSession(input: {
  sessionId: string;
  provider?: string | AIProvider;
  force?: boolean;
}): Promise<{ docId: string; chunkCount: number; skipped?: boolean } | null> {
  const session = getInterviewSession(input.sessionId);
  if (!session) return null;

  const existing = docsForSession(session.id);
  if (!input.force && existing.some((d) => d.layer === "canonical" && d.status === "active")) {
    return { docId: "", chunkCount: 0, skipped: true };
  }

  const rawText = formatWorkshopKnowledgeText(session);
  if (!rawText || rawText.length < 40) return null;

  const titleSeed =
    session.draftText.trim().split(/\n/)[0]?.slice(0, 60) ||
    `مصاحبه ${session.id.slice(0, 8)}`;

  const rawResult = await ingestDocument({
    title: `گفتگو: ${titleSeed}`,
    source: "workshop",
    rawText,
    provider: input.provider,
    layer: "raw",
    embed: false,
    metadata: {
      kind: "workshop-conversation",
      sessionId: session.id,
      status: session.status,
      ingestedAt: new Date().toISOString(),
    },
  });

  const fallback = formatWorkshopExtractFallback(session);
  const canonical = await ingestExtractedCanonical({
    title: `کارگاه: ${titleSeed}`,
    source: "workshop",
    fallbackText: fallback || undefined,
    extractSource: rawText,
    provider: input.provider,
    metadata: {
      kind: "workshop-extract",
      sessionId: session.id,
      extractedFrom: rawResult.doc.id,
      ingestedAt: new Date().toISOString(),
    },
  });

  if (input.force && canonical?.docId) {
    const oldCanonical = existing.filter(
      (d) =>
        d.id !== canonical.docId &&
        d.layer === "canonical" &&
        d.status === "active"
    );
    if (oldCanonical.length) {
      markDocsSuperseded(
        oldCanonical.map((d) => d.id),
        canonical.docId
      );
    }
  }

  const prev =
    session.output && typeof session.output === "object"
      ? (session.output as Record<string, unknown>)
      : {};
  updateInterviewSession(session.id, {
    output: {
      ...prev,
      knowledgeDocId: canonical?.docId || rawResult.doc.id,
      knowledgeRawDocId: rawResult.doc.id,
    },
    status: session.status === "ready" ? "written" : session.status,
  });

  return {
    docId: canonical?.docId || rawResult.doc.id,
    chunkCount: canonical?.chunkCount ?? 0,
    skipped: Boolean(canonical?.skipped),
  };
}

export async function ingestChatTranscript(input: {
  title: string;
  messages: ChatTurn[];
  source?: "research" | "manual" | "workshop";
  provider?: string | AIProvider;
  metadata?: Record<string, unknown>;
}): Promise<{ docId: string; chunkCount: number } | null> {
  const rawText = formatChatTranscript(input.messages);
  if (!rawText || rawText.length < 40) return null;

  const rawResult = await ingestDocument({
    title: `گفتگو: ${input.title}`,
    source: input.source || "research",
    rawText,
    provider: input.provider,
    layer: "raw",
    embed: false,
    metadata: {
      kind: "chat-transcript",
      ingestedAt: new Date().toISOString(),
      ...(input.metadata || {}),
    },
  });

  const canonical = await ingestExtractedCanonical({
    title: input.title,
    source: input.source || "research",
    extractSource: rawText,
    provider: input.provider,
    metadata: {
      kind: "chat-extract",
      extractedFrom: rawResult.doc.id,
      ingestedAt: new Date().toISOString(),
      ...(input.metadata || {}),
    },
  });

  return {
    docId: canonical?.docId || rawResult.doc.id,
    chunkCount: canonical?.chunkCount ?? 0,
  };
}

export function interviewMessagesToTurns(
  messages: InterviewMessage[]
): ChatTurn[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
