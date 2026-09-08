/**
 * Product rule: Fix Version lives on Epics (and orphan Stories/Bugs).
 * Issues linked to an Epic inherit release via the Epic — they must not carry FV.
 */

export function isEpicIssueType(issuetype: string): boolean {
  return issuetype.toLowerCase() === "epic";
}

export function isStoryOrBug(issuetype: string): boolean {
  const t = issuetype.toLowerCase();
  return t === "story" || t === "bug";
}

/** True when the issue should own a Fix Version itself. */
export function issueOwnsFixVersion(
  issuetype: string,
  hasEpicLink: boolean
): boolean {
  if (isEpicIssueType(issuetype)) return true;
  if (isStoryOrBug(issuetype)) return !hasEpicLink;
  return false;
}

/**
 * Resolve what Fix Version to send to Jira.
 * - Under epic → always clear
 * - Owner without a value → null (caller may treat as validation error)
 * - Owner with value → that id/name
 */
export function resolveFixVersionForWrite(opts: {
  issuetype: string;
  hasEpicLink: boolean;
  selectedRelease?: string | null;
}): { clear: boolean; value: string | null; owns: boolean } {
  const owns = issueOwnsFixVersion(opts.issuetype, opts.hasEpicLink);
  if (!owns) {
    return { clear: true, value: null, owns: false };
  }
  const value = (opts.selectedRelease || "").trim() || null;
  return { clear: !value, value, owns: true };
}

export function fixVersionValidationError(opts: {
  issuetype: string;
  hasEpicLink: boolean;
  selectedRelease?: string | null;
  language?: "en" | "fa";
}): string | null {
  const { owns, value } = resolveFixVersionForWrite(opts);
  if (!owns || value) return null;
  const fa = opts.language === "fa";
  if (isEpicIssueType(opts.issuetype)) {
    return fa
      ? "اپیک باید ریلیز (Fix Version) داشته باشد."
      : "Epic requires a Fix Version (release).";
  }
  return fa
    ? "استوری/باگ بدون اپیک باید ریلیز داشته باشد."
    : "Story/Bug without an Epic requires a Fix Version.";
}
