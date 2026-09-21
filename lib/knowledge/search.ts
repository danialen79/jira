import { getDb, nowIso } from "@/lib/db";
import {
  bufferToFloat32,
  cosineSimilarity,
  embedText,
  embedTexts,
  embeddingToBlob,
  resolveEmbeddingModel,
} from "@/lib/embeddings";
import {
  createKnowledgeDoc,
  findDocByContentHash,
  ftsSearchChunkIds,
  getDocTitlesByIds,
  getKnowledgeDoc,
  listKnowledgeDocs,
  listSearchableChunks,
  replaceDocChunks,
  type KnowledgeDoc,
  type KnowledgeLayer,
  type KnowledgeSource,
} from "@/lib/db/repos/knowledge";
import { chunkText, estimateTokens } from "@/lib/knowledge/chunk";
import { hashKnowledgeText } from "@/lib/knowledge/hash";
import { mmrRerank } from "@/lib/knowledge/mmr";

export type KnowledgeHit = {
  chunkId: string;
  docId: string;
  title: string;
  source: KnowledgeSource;
  text: string;
  score: number;
};

const NEAR_DUP_THRESHOLD = 0.92;

export async function ingestDocument(input: {
  title: string;
  source: KnowledgeSource;
  rawText: string;
  metadata?: Record<string, unknown>;
  provider?: string;
  docId?: string;
  layer?: KnowledgeLayer;
  embed?: boolean;
}): Promise<{
  doc: KnowledgeDoc;
  chunkCount: number;
  model: string;
  skipped?: "hash" | "near-dup";
}> {
  const text = input.rawText.trim();
  if (!text) throw new Error("Document text is empty");

  const layer = input.layer ?? "canonical";
  const shouldEmbed = input.embed ?? layer !== "raw";
  const contentHash = hashKnowledgeText(text);

  if (!input.docId && layer === "canonical") {
    const existing = findDocByContentHash(contentHash, {
      layer: "canonical",
      status: "active",
    });
    if (existing) {
      return {
        doc: existing,
        chunkCount: existing.chunkCount ?? 0,
        model: resolveEmbeddingModel(input.provider).model,
        skipped: "hash",
      };
    }
  }

  const { provider, model } = resolveEmbeddingModel(input.provider);

  let pieces: string[] = [];
  let vectors: number[][] = [];
  if (shouldEmbed) {
    pieces = chunkText(text);
    if (!pieces.length) throw new Error("No chunks produced");

    const batchSize = 8;
    for (let i = 0; i < pieces.length; i += batchSize) {
      const batch = pieces.slice(i, i + batchSize);
      const result = await embedTexts(batch, provider);
      vectors.push(...result.vectors);
    }

    if (!input.docId && layer === "canonical" && vectors[0]) {
      const dup = findNearDuplicateFromVector(vectors[0], model);
      if (dup) {
        return {
          doc: dup,
          chunkCount: dup.chunkCount ?? 0,
          model,
          skipped: "near-dup",
        };
      }
    }
  }

  let doc: KnowledgeDoc;
  if (input.docId) {
    const existing = getKnowledgeDoc(input.docId);
    if (!existing) throw new Error("Document not found");
    getDb()
      .prepare(
        `UPDATE knowledge_docs
         SET title = ?, raw_text = ?, metadata_json = ?, content_hash = ?,
             layer = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.title.trim() || existing.title,
        text,
        JSON.stringify(input.metadata ?? existing.metadata),
        contentHash,
        layer,
        nowIso(),
        input.docId
      );
    doc = getKnowledgeDoc(input.docId)!;
  } else {
    doc = createKnowledgeDoc({
      title: input.title,
      source: input.source,
      rawText: text,
      metadata: input.metadata,
      layer,
      contentHash,
    });
  }

  if (shouldEmbed) {
    replaceDocChunks(
      doc.id,
      pieces.map((piece, i) => ({
        text: piece,
        embedding: embeddingToBlob(vectors[i]!),
        embeddingModel: model,
        dims: vectors[i]!.length,
        tokenEst: estimateTokens(piece),
      }))
    );
  }

  const refreshed = getKnowledgeDoc(doc.id)!;
  return { doc: refreshed, chunkCount: pieces.length, model };
}

function findNearDuplicateFromVector(
  vector: number[],
  model: string
): KnowledgeDoc | null {
  const pool = listSearchableChunks(model);
  let best: { docId: string; score: number } | null = null;
  for (const chunk of pool) {
    const vec = bufferToFloat32(chunk.embedding);
    if (vec.length !== vector.length) continue;
    const score = cosineSimilarity(vector, vec);
    if (!best || score > best.score) best = { docId: chunk.docId, score };
  }
  if (!best || best.score < NEAR_DUP_THRESHOLD) return null;
  return getKnowledgeDoc(best.docId);
}

export async function reembedAllDocuments(provider?: string): Promise<{
  docs: number;
  chunks: number;
  model: string;
}> {
  const { provider: id, model } = resolveEmbeddingModel(provider);
  const docs = listKnowledgeDocs(1000, {
    layer: "canonical",
    status: "active",
  });
  let chunks = 0;
  for (const doc of docs) {
    const result = await ingestDocument({
      title: doc.title,
      source: doc.source,
      rawText: doc.rawText,
      metadata: doc.metadata,
      provider: id,
      docId: doc.id,
      layer: "canonical",
      embed: true,
    });
    chunks += result.chunkCount;
  }
  return { docs: docs.length, chunks, model };
}

export async function searchKnowledge(
  query: string,
  opts?: { k?: number; provider?: string; alpha?: number; mmrLambda?: number }
): Promise<KnowledgeHit[]> {
  const q = query.trim();
  if (!q) return [];

  const k = opts?.k ?? 8;
  const alpha = opts?.alpha ?? 0.7;
  const mmrLambda = opts?.mmrLambda ?? 0.7;
  const { model } = resolveEmbeddingModel(opts?.provider);

  const queryEmb = await embedText(q, opts?.provider);
  const pool = listSearchableChunks(model);
  if (!pool.length) return [];

  const ftsIds = new Set(ftsSearchChunkIds(q, 50));
  const scored = pool.map((chunk) => {
    const vec = bufferToFloat32(chunk.embedding);
    const cos =
      vec.length === queryEmb.vector.length
        ? cosineSimilarity(queryEmb.vector, vec)
        : 0;
    const ftsBoost = ftsIds.has(chunk.id) ? 1 : 0;
    const score = alpha * cos + (1 - alpha) * ftsBoost;
    return { chunk, score, vector: vec };
  });

  scored.sort((a, b) => b.score - a.score);
  const candidateCap = Math.max(k * 4, 24);
  const reranked = mmrRerank(
    scored.slice(0, candidateCap).map((s) => ({
      item: s,
      score: s.score,
      vector: s.vector,
    })),
    k,
    mmrLambda
  );

  const docMeta = getDocTitlesByIds(reranked.map((t) => t.chunk.docId));

  return reranked.map(({ chunk, score }) => {
    const meta = docMeta.get(chunk.docId);
    return {
      chunkId: chunk.id,
      docId: chunk.docId,
      title: meta?.title || "Untitled",
      source: meta?.source || "manual",
      text: chunk.text,
      score,
    };
  });
}

export function formatHitsForPrompt(hits: KnowledgeHit[]): string {
  if (!hits.length) return "(no knowledge hits)";
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title} (${h.source}, score=${h.score.toFixed(3)})\n${h.text}`
    )
    .join("\n\n");
}
