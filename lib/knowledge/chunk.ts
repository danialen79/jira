/** Rough token estimate: ~4 chars per token for mixed FA/EN. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Split text into overlapping chunks by approximate token budget.
 */
export function chunkText(
  text: string,
  opts?: { targetTokens?: number; overlapTokens?: number }
): string[] {
  const target = opts?.targetTokens ?? 600;
  const overlap = opts?.overlapTokens ?? 80;
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const units =
    paragraphs.length > 1
      ? paragraphs
      : cleaned.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  let currentTokens = 0;

  const flush = () => {
    const t = current.trim();
    if (t) chunks.push(t);
    current = "";
    currentTokens = 0;
  };

  for (const unit of units) {
    const unitTokens = estimateTokens(unit);
    if (unitTokens > target * 1.5) {
      // Hard-split long unit by characters
      const charBudget = target * 4;
      for (let i = 0; i < unit.length; i += charBudget - overlap * 4) {
        const slice = unit.slice(i, i + charBudget).trim();
        if (slice) chunks.push(slice);
      }
      continue;
    }
    if (currentTokens + unitTokens > target && current) {
      flush();
      // overlap: keep last portion of previous chunk
      if (chunks.length && overlap > 0) {
        const prev = chunks[chunks.length - 1]!;
        const overlapChars = overlap * 4;
        const tail = prev.slice(-overlapChars);
        current = tail;
        currentTokens = estimateTokens(tail);
      }
    }
    current = current ? `${current}\n\n${unit}` : unit;
    currentTokens = estimateTokens(current);
  }
  flush();
  return chunks;
}
