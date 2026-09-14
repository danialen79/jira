import { isCanceledStatus } from "@/lib/roadmap";

/**
 * Shared colors for Jira issue-status badges.
 * Soft tinted background + strong text (matches Badge success/destructive pattern).
 */

export type IssueStatusTone = "todo" | "inProgress" | "done" | "canceled";

function normalizeCategory(statusCategory?: string): string {
  return (statusCategory || "").trim().toLowerCase();
}

/**
 * Resolve tone from Jira statusCategory key/name (`new` | `indeterminate` | `done`
 * or "To Do" / "In Progress" / "Done") with cancel override by status name.
 */
export function resolveIssueStatusTone(
  statusName: string,
  statusCategory?: string
): IssueStatusTone {
  if (isCanceledStatus(statusName)) return "canceled";

  const cat = normalizeCategory(statusCategory);
  if (
    cat === "done" ||
    cat.includes("complete") ||
    (cat.includes("done") && !cat.includes("to do"))
  ) {
    return "done";
  }
  if (
    cat === "indeterminate" ||
    cat.includes("progress") ||
    cat === "in progress"
  ) {
    return "inProgress";
  }
  if (cat === "new" || cat.includes("to do") || cat === "todo") {
    return "todo";
  }

  // No usable category — light name heuristics
  const s = (statusName || "").trim().toLowerCase();
  if (!s) return "todo";
  if (/\b(done|completed|closed|resolved)\b/.test(s)) return "done";
  if (
    /\b(progress|review|qa|develop|pending|pend|design|product|support|code)\b/.test(
      s
    )
  ) {
    return "inProgress";
  }
  return "todo";
}

/** Tailwind classes that paint the badge (override default Badge variant colors). */
export function getIssueStatusBadgeClass(
  statusName: string,
  statusCategory?: string
): string {
  const tone = resolveIssueStatusTone(statusName, statusCategory);
  switch (tone) {
    case "canceled":
      return "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/25 dark:bg-destructive/25";
    case "done":
      return "border-transparent bg-success/15 text-success hover:bg-success/25";
    case "inProgress":
      return "border-transparent bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300";
    case "todo":
    default:
      return "border-transparent bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 dark:text-slate-300";
  }
}
