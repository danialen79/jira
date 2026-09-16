import { EPIC_LENS_OPTIONS } from "@/lib/lens";
import { isCanceledStatus } from "@/lib/roadmap";
import type { OpsIssue } from "@/lib/issue-ops/types";

export type BacklogIncompleteness = {
  release: boolean;
  assign: boolean;
  lens: boolean;
  component: boolean;
};

export const DEFAULT_BACKLOG_INCOMPLETENESS: BacklogIncompleteness = {
  release: true,
  assign: true,
  lens: true,
  component: true,
};

/**
 * Backlog = independent Epic / Story / Bug / Task, excluding Done,
 * AND missing every active incompleteness field.
 *
 * Independent: Epic always; Story/Bug/Task only when Epic Link is empty.
 *
 * @param epicLinkJql — JQL field ref for Epic Link, e.g. `"Epic Link"` or `cf[10108]`
 */
export function backlogJqlFragment(
  epicLinkJql: string = '"Epic Link"',
  incompleteness: BacklogIncompleteness = DEFAULT_BACKLOG_INCOMPLETENESS
): string {
  const typeGate = `(issuetype = Epic OR (issuetype in (Story, Bug, Task) AND ${epicLinkJql} is EMPTY))`;

  const missing: string[] = [];
  if (incompleteness.release) {
    missing.push("fixVersion is EMPTY");
  }
  if (incompleteness.assign) {
    missing.push("assignee is EMPTY");
  }
  if (incompleteness.component) {
    missing.push("component is EMPTY");
  }
  if (incompleteness.lens) {
    const labels = EPIC_LENS_OPTIONS.map((o) => `"${o.jiraLabel}"`).join(", ");
    // Empty labels do not match `labels not in (...)` on Jira Server.
    missing.push(`(labels is EMPTY OR labels not in (${labels}))`);
  }

  // Done category covers Done + most Canceled workflows.
  const exclude = "statusCategory != Done";

  return `(${[typeGate, ...missing, exclude].join(" AND ")})`;
}

export function incompletenessFromFilters(values: {
  missRelease: string;
  missAssign: string;
  missLens: string;
  missComponent: string;
}): BacklogIncompleteness {
  return {
    release: values.missRelease === "1",
    assign: values.missAssign === "1",
    lens: values.missLens === "1",
    component: values.missComponent === "1",
  };
}

/** Client/server post-filter for active incompleteness chips. */
export function matchesIncompleteness(
  issue: Pick<
    OpsIssue,
    "fixVersionIds" | "assignee" | "components" | "lens"
  >,
  incompleteness: BacklogIncompleteness
): boolean {
  if (incompleteness.release && issue.fixVersionIds.length > 0) return false;
  if (incompleteness.assign && issue.assignee) return false;
  if (incompleteness.component && issue.components.length > 0) return false;
  if (incompleteness.lens && issue.lens) return false;
  return true;
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
