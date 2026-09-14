/**
 * Jira Server/DC worklog `started` format:
 * yyyy-MM-dd'T'HH:mm:ss.SSSZ  e.g. 2026-09-12T09:24:00.000+0330
 */

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function formatOffset(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = pad(Math.floor(abs / 60));
  const mm = pad(abs % 60);
  return `${sign}${hh}${mm}`;
}

/** Current local time as Jira worklog `started`. */
export function formatJiraWorklogStarted(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${formatOffset(date)}`
  );
}

/**
 * Normalize various client datetime strings into Jira worklog `started`.
 * Returns null if empty / unparseable.
 */
export function toJiraWorklogStarted(
  input: string | null | undefined
): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Already Jira-like with offset without colon: +0330 / -0500
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?[+-]\d{4}$/.test(raw)) {
    return raw.replace(
      /(\.\d{1,2})([+-]\d{4})$/,
      (_, frac: string, off: string) => `.${frac.slice(1).padEnd(3, "0")}${off}`
    );
  }

  // datetime-local style: 2026-09-12T09:24 or with seconds
  const localMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/
  );
  if (localMatch) {
    const [, y, mo, d, h, mi, s = "0", ms = "0"] = localMatch;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s),
      Number(ms.padEnd(3, "0"))
    );
    if (Number.isNaN(date.getTime())) return null;
    return formatJiraWorklogStarted(date);
  }

  // ISO with Z or +00:00
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatJiraWorklogStarted(parsed);
}
