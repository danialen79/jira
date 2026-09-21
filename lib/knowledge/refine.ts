import { bufferToFloat32, cosineSimilarity } from "@/lib/embeddings";
import {
  listKnowledgeDocs,
  listSearchableChunksAll,
  markDocsMerged,
  markDocsSuperseded,
  type KnowledgeDoc,
} from "@/lib/db/repos/knowledge";
import { mergeCanonicalCluster } from "@/lib/knowledge/extract";
import { ingestDocument } from "@/lib/knowledge/search";

const CLUSTER_THRESHOLD = 0.82;
const MAX_CLUSTERS_PER_RUN = 8;
const MAX_DOCS_PER_CLUSTER = 8;

export type RefineResult = {
  considered: number;
  clusters: number;
  merged: number;
  created: number;
  skipped: number;
  conflicts: string[];
};

type DocCentroid = {
  doc: KnowledgeDoc;
  centroid: number[];
};

function meanVector(vectors: number[][]): number[] | null {
  if (!vectors.length) return null;
  const dims = vectors[0]!.length;
  const acc = new Array(dims).fill(0);
  let n = 0;
  for (const v of vectors) {
    if (v.length !== dims) continue;
    for (let i = 0; i < dims; i++) acc[i] += v[i]!;
    n += 1;
  }
  if (!n) return null;
  return acc.map((x) => x / n);
}

function clusterBySimilarity(
  items: DocCentroid[],
  threshold: number
): DocCentroid[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < items.length; i++) {
    const a = items[i]!.centroid;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j]!.centroid;
      if (a.length !== b.length) continue;
      if (cosineSimilarity(a, b) >= threshold) union(i, j);
    }
  }

  const groups = new Map<number, DocCentroid[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    const list = groups.get(root) || [];
    list.push(items[i]!);
    groups.set(root, list);
  }
  return [...groups.values()];
}

export async function refineKnowledge(opts?: {
  provider?: string;
  threshold?: number;
}): Promise<RefineResult> {
  const threshold = opts?.threshold ?? CLUSTER_THRESHOLD;
  const docs = listKnowledgeDocs(1000, {
    layer: "canonical",
    status: "active",
  });
  if (docs.length < 2) {
    return {
      considered: docs.length,
      clusters: 0,
      merged: 0,
      created: 0,
      skipped: 0,
      conflicts: [],
    };
  }

  const allChunks = listSearchableChunksAll();
  const byDoc = new Map<string, number[][]>();
  for (const chunk of allChunks) {
    const vec = bufferToFloat32(chunk.embedding);
    const list = byDoc.get(chunk.docId) || [];
    list.push(vec);
    byDoc.set(chunk.docId, list);
  }

  const centroids: DocCentroid[] = [];
  for (const doc of docs) {
    const vecs = byDoc.get(doc.id);
    if (!vecs?.length) continue;
    const centroid = meanVector(vecs);
    if (!centroid) continue;
    centroids.push({ doc, centroid });
  }

  const clusters = clusterBySimilarity(centroids, threshold)
    .filter((c) => c.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CLUSTERS_PER_RUN);

  let merged = 0;
  let created = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (const cluster of clusters) {
    const slice = cluster
      .sort(
        (a, b) =>
          new Date(b.doc.updatedAt).getTime() -
          new Date(a.doc.updatedAt).getTime()
      )
      .slice(0, MAX_DOCS_PER_CLUSTER);

    try {
      const proposal = await mergeCanonicalCluster({
        provider: opts?.provider,
        docs: slice.map((c) => ({
          id: c.doc.id,
          title: c.doc.title,
          text: c.doc.rawText,
          updatedAt: c.doc.updatedAt,
        })),
      });

      const clusterIds = new Set(slice.map((c) => c.doc.id));
      const mergeIds = proposal.mergeIds.filter((id) => clusterIds.has(id));
      const supersedeIds = proposal.supersedeIds.filter(
        (id) => clusterIds.has(id) && !mergeIds.includes(id)
      );
      const leftover = [...clusterIds].filter(
        (id) => !mergeIds.includes(id) && !supersedeIds.includes(id)
      );
      const absorb = [...new Set([...mergeIds, ...supersedeIds, ...leftover])];

      const text = proposal.canonicalText.trim();
      if (!text || absorb.length < 2) {
        skipped += 1;
        continue;
      }

      const result = await ingestDocument({
        title: proposal.title.trim() || slice[0]!.doc.title,
        source: slice[0]!.doc.source,
        rawText: text,
        provider: opts?.provider,
        layer: "canonical",
        metadata: {
          kind: "refined-canonical",
          mergedFrom: absorb,
          unresolvedConflicts: proposal.unresolvedConflicts,
          refinedAt: new Date().toISOString(),
        },
      });

      const others = absorb.filter((id) => id !== result.doc.id);
      markDocsMerged(
        mergeIds.filter((id) => id !== result.doc.id),
        result.doc.id
      );
      markDocsSuperseded(
        supersedeIds.filter((id) => id !== result.doc.id),
        result.doc.id
      );
      const stillActive = leftover.filter((id) => id !== result.doc.id);
      if (stillActive.length) markDocsMerged(stillActive, result.doc.id);

      if (result.skipped) skipped += 1;
      else created += 1;
      merged += others.length;
      conflicts.push(...proposal.unresolvedConflicts);
    } catch (err) {
      console.error("knowledge refine cluster failed", err);
      skipped += 1;
    }
  }

  return {
    considered: centroids.length,
    clusters: clusters.length,
    merged,
    created,
    skipped,
    conflicts: conflicts.filter(Boolean).slice(0, 12),
  };
}
