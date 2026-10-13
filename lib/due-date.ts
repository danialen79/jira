/** Local Y/M/D from `YYYY-MM-DD` — avoids UTC midnight shifting the day. */
function isoDateToLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function localDateToIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calendar-day remaining until due (`YYYY-MM-DD`). Positive = future. */
export function daysUntilDue(
  dueIso: string,
  today: Date = new Date()
): number | null {
  const due = isoDateToLocalDate(dueIso);
  if (!due) return null;
  const start = isoDateToLocalDate(localDateToIsoDate(today));
  if (!start) return null;
  const ms = due.getTime() - start.getTime();
  return Math.round(ms / 86_400_000);
}

export type DueTone = "ok" | "soon" | "overdue" | "today";

export type DueRemaining = {
  days: number;
  tone: DueTone;
  /** Short FA label for dense cards: «۳ روز» / «امروز» / «۲ روز گذشته» */
  label: string;
};

const SOON_DAYS = 3;

export function dueTone(days: number): DueTone {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

/** Format remaining days for issue cards (Persian numerals via Intl). */
export function formatDueRemaining(
  dueIso: string,
  opts?: { today?: Date; statusCategoryKey?: string }
): DueRemaining | null {
  const days = daysUntilDue(dueIso, opts?.today);
  if (days == null) return null;

  // Done issues: skip card noise
  if ((opts?.statusCategoryKey || "").toLowerCase() === "done") {
    return null;
  }

  const tone = dueTone(days);
  const n = new Intl.NumberFormat("fa-IR").format(Math.abs(days));

  let label: string;
  if (days > 0) label = `${n} روز`;
  else if (days === 0) label = "امروز";
  else label = `${n} روز گذشته`;

  return { days, tone, label };
}

/** Normalize Jira `duedate` field to `YYYY-MM-DD` or undefined. */
export function parseJiraDueDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return m?.[1];
}

/** Accept set/clear payloads for writes. Empty string → clear. */
export function normalizeDueDateWrite(
  value: unknown
): { ok: true; dueDate: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, dueDate: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "dueDate must be YYYY-MM-DD or empty." };
  }
  const parsed = parseJiraDueDate(value);
  if (!parsed) {
    return { ok: false, error: "dueDate must be YYYY-MM-DD or empty." };
  }
  return { ok: true, dueDate: parsed };
}
