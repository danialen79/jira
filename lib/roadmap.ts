import type { JiraVersion } from "@/lib/types";
import { formatJalaliDate, toJalaliParts } from "@/lib/jalali";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_PADDING_DAYS = 14;

const CANCEL_STATUS_RE = /cancel|cancelled|canceled|لغو/i;

/**
 * Product from Fix Version names.
 * Old: `Release Q2.3-Club2.6` → Club
 * New: `Q2.3-Club2.6` → Club (no Release prefix)
 */
export function parseProductFromVersionName(name: string): string {
  const trimmed = name.trim();

  // Optional "Release ", then Q{quarter}.{monthInQuarter}-{Product}{version}
  const withQuarterAndVer = trimmed.match(
    /^(?:Release\s+)?Q\d+(?:\.\d+)?-(.+?)(\d+(?:\.\d+)*)\s*$/i
  );
  if (withQuarterAndVer?.[1]) {
    const product = withQuarterAndVer[1].replace(/[-_\s]+$/g, "").trim();
    if (product) return product;
  }

  // Same pattern without a trailing product version: `Q2.3-Club`
  const withQuarter = trimmed.match(
    /^(?:Release\s+)?Q\d+(?:\.\d+)?-(.+)\s*$/i
  );
  if (withQuarter?.[1]) {
    const product = withQuarter[1].replace(/[-_\s]+$/g, "").trim();
    if (product) return product;
  }

  // Legacy: `Release-Club2.6` / `Release Club2.6`
  const plainWithVer = trimmed.match(
    /^Release[-\s]+(.+?)(\d+(?:\.\d+)*)\s*$/i
  );
  if (plainWithVer?.[1]) {
    const product = plainWithVer[1]
      .replace(/^-+/, "")
      .replace(/[-_\s]+$/g, "")
      .trim();
    if (product) return product;
  }

  const plain = trimmed.match(/^Release[-\s]+(.+)\s*$/i);
  if (plain?.[1]) {
    const product = plain[1].replace(/^-+/, "").trim();
    if (product) return product;
  }

  const dash = trimmed.lastIndexOf("-");
  if (dash > 0) {
    const after = trimmed
      .slice(dash + 1)
      .replace(/\d+(?:\.\d+)*$/, "")
      .trim();
    if (after) return after;
  }
  return "Other";
}

/**
 * Short Gantt label: product + product version (drop quarter / month-in-quarter).
 * `Q2.3-Club2.6` → `Club2.6`
 * `Release Q2.3-Club2.6` → `Club2.6`
 * `Q2.3-Club` → `Club`
 */
export function formatVersionProductLabel(name: string): string {
  const trimmed = name.trim();
  const withQuarter = trimmed.match(
    /^(?:Release\s+)?Q\d+(?:\.\d+)?-(.+)\s*$/i
  );
  if (withQuarter?.[1]) {
    const label = withQuarter[1].replace(/^-+/, "").trim();
    if (label) return label;
  }
  const plain = trimmed.match(/^Release[-\s]+(.+)\s*$/i);
  if (plain?.[1]) {
    const label = plain[1].replace(/^-+/, "").trim();
    if (label) return label;
  }
  return trimmed;
}

/** Split `Club2.6` → product `Club`, version `2.6`. */
export function parseProductVersionParts(name: string): {
  product: string;
  version: string | null;
} {
  const label = formatVersionProductLabel(name);
  const m = label.match(/^(.+?)(\d+(?:\.\d+)*)\s*$/);
  if (m?.[1] && m[2]) {
    const product = m[1].replace(/[-_\s]+$/g, "").trim();
    if (product) return { product, version: m[2] };
  }
  return {
    product: parseProductFromVersionName(name),
    version: null,
  };
}

/** Jalali Q + month-in-quarter from a Gregorian calendar day (Farvardin = 1). */
export function jalaliQuarterMonthFromDate(date: Date): {
  quarter: number;
  monthInQuarter: number;
} {
  const { jm } = toJalaliParts(date);
  return {
    quarter: Math.ceil(jm / 3),
    monthInQuarter: ((jm - 1) % 3) + 1,
  };
}

const PRODUCT_VERSION_RE = /^\d+(?:\.\d+)*$/;
const PRODUCT_NAME_RE = /^[A-Za-z][A-Za-z0-9]*$/;

/** Normalize product for Fix Version names (`Club`, not `club `). */
export function normalizeVersionProduct(product: string): string {
  return product.trim().replace(/\s+/g, "");
}

export function isValidProductVersion(version: string): boolean {
  return PRODUCT_VERSION_RE.test(version.trim());
}

export function isValidVersionProduct(product: string): boolean {
  return PRODUCT_NAME_RE.test(normalizeVersionProduct(product));
}

/**
 * New naming: `Q{quarter}.{monthInQuarter}-{Product}{version}` from start date.
 * Example: start in Shahrivar → `Q2.3-Club2.6`
 */
export function buildVersionName(opts: {
  startDate: string;
  product: string;
  version: string;
}): string | null {
  const start = opts.startDate.trim();
  const product = normalizeVersionProduct(opts.product);
  const version = opts.version.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  if (!isValidVersionProduct(product) || !isValidProductVersion(version)) {
    return null;
  }
  const { quarter, monthInQuarter } = jalaliQuarterMonthFromDate(
    toDateOnly(start)
  );
  return `Q${quarter}.${monthInQuarter}-${product}${version}`;
}

/** Distinct product names from existing Fix Versions (excludes `Other`). */
export function listProductsFromVersions(
  versions: Pick<JiraVersion, "name">[]
): string[] {
  const set = new Set<string>();
  for (const v of versions) {
    const product = parseProductFromVersionName(v.name);
    if (product && product !== "Other") set.add(product);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function toDateOnly(isoOrDate: string | Date): Date {
  if (isoOrDate instanceof Date) {
    return new Date(
      isoOrDate.getFullYear(),
      isoOrDate.getMonth(),
      isoOrDate.getDate()
    );
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoOrDate);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(isoOrDate);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatRoadmapDate(
  iso: string | undefined,
  language: "en" | "fa"
): string {
  if (!iso) return "—";
  try {
    const d = toDateOnly(iso);
    if (language === "fa") {
      return formatJalaliDate(d, "fa");
    }
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/**
 * Current = unreleased, not archived, and today in [startDate || -∞, releaseDate].
 * Versions without releaseDate are never "current".
 */
export function isCurrentVersion(
  v: Pick<JiraVersion, "released" | "archived" | "startDate" | "releaseDate">,
  today: Date = new Date()
): boolean {
  if (v.released || v.archived) return false;
  if (!v.releaseDate) return false;
  const todayOnly = toDateOnly(today);
  const end = toDateOnly(v.releaseDate);
  if (todayOnly.getTime() > end.getTime()) return false;
  if (v.startDate) {
    const start = toDateOnly(v.startDate);
    if (todayOnly.getTime() < start.getTime()) return false;
  }
  return true;
}

export function isCanceledStatus(statusName: string): boolean {
  return CANCEL_STATUS_RE.test(statusName);
}

export type VersionProgress = {
  todo: number;
  inProgress: number;
  done: number;
  canceled: number;
  /** Done / (todo + inProgress + done); canceled excluded. 0–100. */
  percent: number;
  activeTotal: number;
};

export type ProgressIssueInput = {
  status: string;
  statusCategoryKey?: string;
};

export function computeVersionProgress(
  issues: ProgressIssueInput[]
): VersionProgress {
  let todo = 0;
  let inProgress = 0;
  let done = 0;
  let canceled = 0;

  for (const issue of issues) {
    if (isCanceledStatus(issue.status)) {
      canceled += 1;
      continue;
    }
    const key = (issue.statusCategoryKey || "").toLowerCase();
    if (key === "done") {
      done += 1;
    } else if (key === "indeterminate") {
      inProgress += 1;
    } else {
      todo += 1;
    }
  }

  const activeTotal = todo + inProgress + done;
  const percent =
    activeTotal === 0 ? 0 : Math.round((done / activeTotal) * 100);

  return { todo, inProgress, done, canceled, percent, activeTotal };
}

export type TimelineRange = {
  startMs: number;
  endMs: number;
  todayMs: number;
  todayPercent: number;
};

export function buildTimelineRange(
  versions: Pick<JiraVersion, "startDate" | "releaseDate" | "archived">[],
  today: Date = new Date(),
  includeArchived = false
): TimelineRange | null {
  const pool = includeArchived
    ? versions
    : versions.filter((v) => !v.archived);

  const dated = pool.filter((v) => v.startDate || v.releaseDate);
  if (dated.length === 0) return null;

  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const v of dated) {
    if (v.startDate) {
      const t = toDateOnly(v.startDate).getTime();
      if (t < minMs) minMs = t;
      if (t > maxMs) maxMs = t;
    }
    if (v.releaseDate) {
      const t = toDateOnly(v.releaseDate).getTime();
      if (t < minMs) minMs = t;
      if (t > maxMs) maxMs = t;
    }
  }

  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return null;

  const pad = RANGE_PADDING_DAYS * DAY_MS;
  const startMs = minMs - pad;
  const endMs = Math.max(maxMs + pad, startMs + DAY_MS);
  const todayMs = toDateOnly(today).getTime();
  const span = endMs - startMs;
  const todayPercent = Math.min(
    100,
    Math.max(0, ((todayMs - startMs) / span) * 100)
  );

  return { startMs, endMs, todayMs, todayPercent };
}

export function versionBarPercents(
  version: Pick<JiraVersion, "startDate" | "releaseDate">,
  range: TimelineRange
): { left: number; width: number } | null {
  const span = range.endMs - range.startMs;
  if (span <= 0) return null;

  const start = version.startDate
    ? toDateOnly(version.startDate).getTime()
    : version.releaseDate
      ? toDateOnly(version.releaseDate).getTime() - 7 * DAY_MS
      : null;
  const end = version.releaseDate
    ? toDateOnly(version.releaseDate).getTime()
    : version.startDate
      ? toDateOnly(version.startDate).getTime() + 7 * DAY_MS
      : null;

  if (start == null || end == null) return null;

  const left = ((start - range.startMs) / span) * 100;
  const right = ((end - range.startMs) / span) * 100;
  const width = Math.max(0.8, right - left);
  return {
    left: Math.min(100, Math.max(0, left)),
    width: Math.min(100, Math.max(0.8, width)),
  };
}

export function groupVersionsByProduct(
  versions: JiraVersion[]
): { product: string; versions: JiraVersion[] }[] {
  const map = new Map<string, JiraVersion[]>();
  for (const v of versions) {
    const product = parseProductFromVersionName(v.name);
    const list = map.get(product) || [];
    list.push(v);
    map.set(product, list);
  }

  const groups = Array.from(map.entries()).map(([product, vers]) => ({
    product,
    versions: [...vers].sort((a, b) => {
      const aDate = a.startDate || a.releaseDate || "";
      const bDate = b.startDate || b.releaseDate || "";
      return aDate.localeCompare(bDate);
    }),
  }));

  groups.sort((a, b) => a.product.localeCompare(b.product));
  return groups;
}

export function getVersionStatusLabel(
  v: Pick<JiraVersion, "released" | "archived" | "overdue" | "releaseDate">,
  today: Date = new Date()
): "archived" | "released" | "overdue" | "unreleased" {
  if (v.archived) return "archived";
  if (v.released) return "released";
  if (
    v.overdue ||
    (v.releaseDate && toDateOnly(v.releaseDate).getTime() < toDateOnly(today).getTime())
  ) {
    return "overdue";
  }
  return "unreleased";
}

export function sortIssuesForRoadmap<
  T extends { issuetype: string; status: string },
>(issues: T[]): T[] {
  return [...issues].sort((a, b) => {
    const aEpic = a.issuetype.toLowerCase() === "epic" ? 0 : 1;
    const bEpic = b.issuetype.toLowerCase() === "epic" ? 0 : 1;
    if (aEpic !== bEpic) return aEpic - bEpic;
    return a.status.localeCompare(b.status) || a.issuetype.localeCompare(b.issuetype);
  });
}
