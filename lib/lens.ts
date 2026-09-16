export type StoryLens = "strategy" | "vision" | "customer" | "business";
/** Story lenses plus epic-only `mixed` (no shared child lens). */
export type IssueLens = StoryLens | "mixed";

export const LENS_PREFIX = "lens-";

export const LENS_OPTIONS: ReadonlyArray<{
  value: StoryLens;
  labelEn: string;
  labelFa: string;
  jiraLabel: string;
}> = [
  {
    value: "strategy",
    labelEn: "Strategy",
    labelFa: "استراتژی",
    jiraLabel: "lens-strategy",
  },
  {
    value: "vision",
    labelEn: "Vision",
    labelFa: "چشم‌انداز",
    jiraLabel: "lens-vision",
  },
  {
    value: "customer",
    labelEn: "Customer",
    labelFa: "مشتری",
    jiraLabel: "lens-customer",
  },
  {
    value: "business",
    labelEn: "Business",
    labelFa: "کسب‌وکار",
    jiraLabel: "lens-business",
  },
] as const;

export const MIXED_LENS_OPTION = {
  value: "mixed" as const,
  labelEn: "Mixed",
  labelFa: "مختلط",
  jiraLabel: "lens-mixed",
};

/** Epic may use any story lens or mixed. */
export const EPIC_LENS_OPTIONS: ReadonlyArray<{
  value: IssueLens;
  labelEn: string;
  labelFa: string;
  jiraLabel: string;
}> = [...LENS_OPTIONS, MIXED_LENS_OPTION];

const ALL_LENS_OPTIONS = EPIC_LENS_OPTIONS;

const LENS_BY_VALUE = new Map(
  ALL_LENS_OPTIONS.map((o) => [o.value, o] as const)
);
const LENS_BY_JIRA = new Map(
  ALL_LENS_OPTIONS.map((o) => [o.jiraLabel, o] as const)
);

export function isStoryLens(value: unknown): value is StoryLens {
  return (
    value === "strategy" ||
    value === "vision" ||
    value === "customer" ||
    value === "business"
  );
}

export function isIssueLens(value: unknown): value is IssueLens {
  return isStoryLens(value) || value === "mixed";
}

export function lensToLabel(lens: IssueLens): string {
  return LENS_BY_VALUE.get(lens)!.jiraLabel;
}

export function lensDisplayLabel(
  lens: IssueLens,
  _language?: "fa"
): string {
  const opt = LENS_BY_VALUE.get(lens)!;
  return opt.labelFa;
}

/** First valid lens-* label wins when multiple are present. */
export function parseLensFromLabels(
  labels: string[] | null | undefined
): IssueLens | undefined {
  if (!labels?.length) return undefined;
  for (const raw of labels) {
    const label = String(raw || "").trim().toLowerCase();
    const hit = LENS_BY_JIRA.get(label);
    if (hit) return hit.value;
  }
  return undefined;
}

export function isLensLabel(label: string): boolean {
  return String(label || "")
    .trim()
    .toLowerCase()
    .startsWith(LENS_PREFIX);
}

/** Strip all lens-* labels, then optionally add the selected lens. */
export function applyLensToLabels(
  existing: string[] | null | undefined,
  lens: IssueLens | null | undefined
): string[] {
  const base = (existing || [])
    .map((l) => String(l || "").trim())
    .filter((l) => l.length > 0 && !isLensLabel(l));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of base) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }

  if (lens && isIssueLens(lens)) {
    const jira = lensToLabel(lens);
    if (!seen.has(jira.toLowerCase())) {
      out.push(jira);
    }
  }

  return out;
}
