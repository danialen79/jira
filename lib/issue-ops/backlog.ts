import { isCanceledStatus } from "@/lib/roadmap";

/**
 * Backlog preset (OR), excluding Done / Canceled:
 * - unassigned
 * - not started (To Do category)
 * - no Fix Version on issues that own it (Epic or orphan Story/Bug)
 *
 * Stories/Bugs under an Epic keep fixVersion EMPTY by product rule —
 * those must NOT count as no-version via fixVersion alone.
 *
 * @param epicLinkJql — JQL field ref for Epic Link, e.g. `"Epic Link"` or `cf[10108]`
 */
export function backlogJqlFragment(
  epicLinkJql: string = '"Epic Link"'
): string {
  const include = [
    "assignee is EMPTY",
    'statusCategory = "To Do"',
    `(fixVersion is EMPTY AND ${epicLinkJql} is EMPTY)`,
  ].join(" OR ");

  // Done category covers Done + most Canceled workflows.
  // Do not list status names in JQL — they vary per project and 400 if missing.
  const exclude = "statusCategory != Done";

  return `((${include}) AND ${exclude})`;
}

/** True when an issue should never appear under the Backlog scope. */
export function isBacklogExcludedStatus(
  statusName: string,
  statusCategoryKey?: string
): boolean {
  if (isCanceledStatus(statusName)) return true;
  const cat = (statusCategoryKey || "").toLowerCase();
  if (cat === "done") return true;
  const s = (statusName || "").trim().toLowerCase();
  return s === "done" || s === "canceled" || s === "cancelled";
}

/** Build Epic Link JQL token from customfield id or display name. */
export function epicLinkJqlToken(epicLinkField: string): string {
  const raw = (epicLinkField || "").trim();
  const cf = raw.match(/^customfield_(\d+)$/i);
  if (cf) return `cf[${cf[1]}]`;
  if (raw.toLowerCase() === "epic link" || raw === "") return '"Epic Link"';
  return `"${raw.replace(/"/g, '\\"')}"`;
}
