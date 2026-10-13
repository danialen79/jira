import { issueOwnsFixVersion } from "@/lib/fix-version-policy";

export const IMPACT_EFFORT_MIN = 1;
export const IMPACT_EFFORT_MAX = 10;

export type ImpactEffortScore = number;

export function ownsImpactEffort(
  issuetype: string,
  hasEpicLink: boolean
): boolean {
  return issueOwnsFixVersion(issuetype, hasEpicLink);
}

/**
 * Parse Jira Select option / number / string into 1..10, else null.
 * Select fields return `{ id, value }` (value is "1"…"10").
 */
export function parseScore(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  let candidate: unknown = raw;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { value?: unknown; id?: unknown };
    if (obj.value != null && obj.value !== "") {
      candidate = obj.value;
    } else {
      return null;
    }
  }
  const n =
    typeof candidate === "number"
      ? candidate
      : Number(String(candidate).trim());
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < IMPACT_EFFORT_MIN || rounded > IMPACT_EFFORT_MAX) return null;
  return rounded;
}

/** Jira Select payload: `{ value: "N" }` or `null` to clear. */
export function toSelectFieldValue(
  score: number | null
): { value: string } | null {
  if (score == null) return null;
  return { value: String(score) };
}

/** Validate write input: integer 1..10, or null to clear. */
export function normalizeScoreWrite(
  raw: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: false, error: "Score is required (use null to clear)." };
  }
  if (raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: "Score must be an integer from 1 to 10." };
  }
  if (n < IMPACT_EFFORT_MIN || n > IMPACT_EFFORT_MAX) {
    return { ok: false, error: "Score must be from 1 to 10." };
  }
  return { ok: true, value: n };
}

export function valueRatio(
  impact: number | null | undefined,
  effort: number | null | undefined
): number | null {
  if (
    impact == null ||
    effort == null ||
    impact < IMPACT_EFFORT_MIN ||
    effort < IMPACT_EFFORT_MIN
  ) {
    return null;
  }
  return impact / effort;
}

/** Red → amber → green across [min, max]. Single point → mid green. */
export function valueColor(
  ratio: number,
  min: number,
  max: number
): string {
  let t = 0.5;
  if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
    t = Math.min(1, Math.max(0, (ratio - min) / (max - min)));
  }
  // hue: 0 red → 45 amber → 142 green
  const h =
    t <= 0.5
      ? 0 + (45 - 0) * (t / 0.5)
      : 45 + (142 - 45) * ((t - 0.5) / 0.5);
  return `hsl(${Math.round(h)} 70% 42%)`;
}

export type ImpactHistogram = {
  counts: Record<number, number>;
  missing: number;
  scored: number;
  meanValue: number | null;
};

export function impactHistogram(
  items: ReadonlyArray<{
    impact?: number | null;
    effort?: number | null;
  }>
): ImpactHistogram {
  const counts: Record<number, number> = {};
  for (let i = IMPACT_EFFORT_MIN; i <= IMPACT_EFFORT_MAX; i++) {
    counts[i] = 0;
  }
  let missing = 0;
  let scored = 0;
  let valueSum = 0;
  let valueCount = 0;

  for (const item of items) {
    const impact = parseScore(item.impact);
    const effort = parseScore(item.effort);
    if (impact == null) {
      missing += 1;
      continue;
    }
    counts[impact] = (counts[impact] || 0) + 1;
    scored += 1;
    const v = valueRatio(impact, effort);
    if (v != null) {
      valueSum += v;
      valueCount += 1;
    }
  }

  return {
    counts,
    missing,
    scored,
    meanValue: valueCount > 0 ? valueSum / valueCount : null,
  };
}

export function scoreSelectItems(): { value: string; label: string }[] {
  const items: { value: string; label: string }[] = [];
  for (let i = IMPACT_EFFORT_MIN; i <= IMPACT_EFFORT_MAX; i++) {
    items.push({
      value: String(i),
      label: new Intl.NumberFormat("fa-IR").format(i),
    });
  }
  return items;
}
