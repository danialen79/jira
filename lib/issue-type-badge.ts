/**
 * Shared colors for issue-type badges across the app.
 * Epic purple · Story green · Task navy · Sub-* sky · Bug red · else gray
 */

export function normalizeIssueTypeName(issuetype: string): string {
  return (issuetype || "").trim().toLowerCase();
}

export function isSubIssueType(issuetype: string): boolean {
  const t = normalizeIssueTypeName(issuetype);
  return t === "subtask" || t === "sub-task" || t.startsWith("sub-");
}

/** Tailwind classes that paint the badge (override default Badge variant colors). */
export function getIssueTypeBadgeClass(issuetype: string): string {
  const t = normalizeIssueTypeName(issuetype);

  if (t === "epic") {
    return "border-transparent bg-purple-600 text-white hover:bg-purple-600/90 dark:bg-purple-500 dark:hover:bg-purple-500/90";
  }
  if (t === "story") {
    return "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90";
  }
  if (t === "task") {
    return "border-transparent bg-slate-800 text-white hover:bg-slate-800/90 dark:bg-slate-700 dark:hover:bg-slate-700/90";
  }
  if (t === "bug") {
    return "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/25 dark:bg-destructive/25";
  }
  if (isSubIssueType(t)) {
    return "border-transparent bg-sky-500 text-white hover:bg-sky-500/90 dark:bg-sky-400 dark:text-slate-900 dark:hover:bg-sky-400/90";
  }

  return "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80";
}
