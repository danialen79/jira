import type { UIMessage } from "ai";
import type { KnowledgeHit } from "@/lib/knowledge/search";

export type KnowledgeCitation = {
  docId: string;
  title: string;
  source: string;
  score: number;
};

export function serializeKnowledgeCitations(
  hits: KnowledgeHit[]
): KnowledgeCitation[] {
  const byDoc = new Map<string, KnowledgeCitation>();
  for (const h of hits) {
    const prev = byDoc.get(h.docId);
    if (!prev || h.score > prev.score) {
      byDoc.set(h.docId, {
        docId: h.docId,
        title: h.title,
        source: h.source,
        score: Number(h.score.toFixed(3)),
      });
    }
  }
  return [...byDoc.values()].sort((a, b) => b.score - a.score);
}

function citationsFromToolOutput(output: unknown): KnowledgeCitation[] {
  if (!output || typeof output !== "object") return [];
  const hits = (output as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];
  const out: KnowledgeCitation[] = [];
  for (const h of hits) {
    if (!h || typeof h !== "object") continue;
    const row = h as Record<string, unknown>;
    if (typeof row.title !== "string") continue;
    out.push({
      docId: typeof row.docId === "string" ? row.docId : "",
      title: row.title,
      source: typeof row.source === "string" ? row.source : "manual",
      score:
        typeof row.score === "number"
          ? Number(row.score.toFixed(3))
          : 0,
    });
  }
  return out;
}

/** Deduplicate by docId (or title if no id), keep highest score. */
export function mergeCitations(
  ...lists: KnowledgeCitation[][]
): KnowledgeCitation[] {
  const map = new Map<string, KnowledgeCitation>();
  for (const list of lists) {
    for (const c of list) {
      const key = c.docId || c.title;
      const prev = map.get(key);
      if (!prev || c.score > prev.score) map.set(key, c);
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

export function extractKnowledgeCitations(
  message: UIMessage
): KnowledgeCitation[] {
  const fromMeta = (
    message.metadata as { knowledgeCitations?: KnowledgeCitation[] } | null
  )?.knowledgeCitations;

  const fromData: KnowledgeCitation[] = [];
  const fromTools: KnowledgeCitation[] = [];

  for (const part of message.parts || []) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "data-knowledge"
    ) {
      const data = (part as { data?: unknown }).data;
      if (Array.isArray(data)) {
        fromData.push(...(data as KnowledgeCitation[]));
      }
    }

    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "tool-searchKnowledge" &&
      "state" in part &&
      (part as { state?: string }).state === "output-available" &&
      "output" in part
    ) {
      fromTools.push(
        ...citationsFromToolOutput((part as { output?: unknown }).output)
      );
    }

    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "dynamic-tool" &&
      "toolName" in part &&
      (part as { toolName?: string }).toolName === "searchKnowledge" &&
      "state" in part &&
      (part as { state?: string }).state === "output-available"
    ) {
      fromTools.push(
        ...citationsFromToolOutput((part as { output?: unknown }).output)
      );
    }
  }

  return mergeCitations(fromMeta || [], fromData, fromTools);
}
