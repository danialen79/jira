export type TextChunk = {
  text: string;
  heading: string;
};

const ARABIC_SCRIPT =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Persian-script chars are ~2.2 chars/token; Latin stays ~4. */
export function estimateTokens(text: string): number {
  let arabic = 0;
  let other = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    if (ARABIC_SCRIPT.test(ch)) arabic += 1;
    else other += 1;
  }
  return Math.max(1, Math.ceil(arabic / 2.2 + other / 4));
}

function charsForTokens(sample: string, tokens: number): number {
  const est = estimateTokens(sample);
  const ratio = sample.length / est;
  return Math.max(1, Math.floor(tokens * ratio));
}

type Unit = { text: string; heading: string };

function splitUnits(text: string): Unit[] {
  const lines = text.split("\n");
  let heading = "";
  const units: Unit[] = [];
  let buf: string[] = [];

  const flushBuf = () => {
    const block = buf.join("\n").trim();
    buf = [];
    if (!block) return;
    const sentences = block
      .split(/(?<=[.!?؟])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of sentences.length ? sentences : [block]) {
      units.push({ text: part, heading });
    }
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(\S.*)$/.exec(line.trim());
    if (headingMatch) {
      flushBuf();
      heading = headingMatch[2]!.trim();
      continue;
    }
    if (!line.trim()) {
      flushBuf();
      continue;
    }
    buf.push(line.trim());
  }
  flushBuf();
  return units;
}

/**
 * Split text into overlapping chunks. Display text stays original;
 * `heading` is the latest markdown heading for the embed prefix.
 */
export function chunkText(
  text: string,
  opts?: { targetTokens?: number; overlapTokens?: number }
): TextChunk[] {
  const target = opts?.targetTokens ?? 600;
  const overlap = opts?.overlapTokens ?? 80;
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const units = splitUnits(cleaned);
  if (!units.length) return [{ text: cleaned, heading: "" }];

  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentHeading = units[0]!.heading;
  let currentTokens = 0;

  const flush = (keepOverlap: boolean) => {
    const body = current.join("\n\n").trim();
    const heading = currentHeading;
    current = [];
    currentTokens = 0;
    if (!body) return;
    chunks.push({ text: body, heading });
    if (!keepOverlap || overlap <= 0) return;
    const tail = body.slice(-charsForTokens(body, overlap)).trim();
    if (!tail || tail === body) return;
    current = [tail];
    currentTokens = estimateTokens(tail);
  };

  for (const unit of units) {
    if (current.length && unit.heading !== currentHeading) {
      flush(false);
    }
    currentHeading = unit.heading;

    if (estimateTokens(unit.text) > target * 1.5) {
      if (current.length) flush(true);
      currentHeading = unit.heading;
      const budget = charsForTokens(unit.text, target);
      const step = Math.max(1, budget - charsForTokens(unit.text, overlap));
      for (let i = 0; i < unit.text.length; i += step) {
        const slice = unit.text.slice(i, i + budget).trim();
        if (slice) chunks.push({ text: slice, heading: unit.heading });
      }
      current = [];
      currentTokens = 0;
      continue;
    }

    const unitTokens = estimateTokens(unit.text);
    if (current.length && currentTokens + unitTokens > target) {
      flush(true);
      currentHeading = unit.heading;
    }
    current.push(unit.text);
    currentTokens = estimateTokens(current.join("\n\n"));
  }
  flush(false);
  return chunks;
}

/** Text sent to the embedding model: title, heading, normalized body. */
export function buildEmbedText(
  title: string,
  chunk: TextChunk,
  normalizedBody: string
): string {
  return [title.trim(), chunk.heading.trim(), normalizedBody.trim()]
    .filter(Boolean)
    .join("\n");
}
