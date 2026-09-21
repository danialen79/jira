import { isBacklogExcludedStatus } from "@/lib/issue-ops/backlog";
import { resolveEpicKey, isSubtaskIssueType } from "@/lib/issue-ops/map";
import { parseLensFromLabels, type IssueLens } from "@/lib/lens";
import { resolveIssueStatusTone } from "@/lib/issue-status-badge";

export const PRODUCT_ORPHAN_KEY = "__orphan__";

export type ProductWorkSummary = {
  /** Component name, or `PRODUCT_ORPHAN_KEY` for no component. */
  key: string;
  name: string;
  id?: string;
  unfinished: number;
  todo: number;
  inProgress: number;
  /** Open issues with no Fix Version. */
  unplanned: number;
};

export type ProductIssue = {
  key: string;
  id: string;
  summary: string;
  status: string;
  statusCategoryKey?: string;
  issuetype: string;
  priority?: string;
  assignee?: string;
  assigneeDisplayName?: string;
  components: string[];
  lens?: IssueLens;
  epicKey?: string;
  epicSummary?: string;
  fixVersionIds: string[];
  fixVersionNames: string[];
  isEpic: boolean;
};

export type ProductGroupBy = "none" | "epic" | "status" | "type" | "version";

export function escapeJqlString(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Unfinished parents only — no version / lens gate. */
export function unfinishedProductJql(
  projectKey: string,
  opts?: { component?: string; orphan?: boolean }
): string {
  const clauses = [
    `project = '${escapeJqlString(projectKey)}'`,
    "statusCategory != Done",
    "issuetype not in subTaskIssueTypes()",
  ];
  if (opts?.orphan) {
    clauses.push("component is EMPTY");
  } else if (opts?.component) {
    clauses.push(`component = "${escapeJqlString(opts.component)}"`);
  }
  return `${clauses.join(" AND ")} ORDER BY priority DESC, updated DESC`;
}

export function emptyProductBucket(
  key: string,
  name: string,
  id?: string
): ProductWorkSummary {
  return {
    key,
    name,
    id,
    unfinished: 0,
    todo: 0,
    inProgress: 0,
    unplanned: 0,
  };
}

export function bumpProductBucket(
  bucket: ProductWorkSummary,
  statusName: string,
  statusCategoryKey: string | undefined,
  hasFixVersion: boolean
): void {
  if (isBacklogExcludedStatus(statusName, statusCategoryKey)) return;
  bucket.unfinished += 1;
  const tone = resolveIssueStatusTone(statusName, statusCategoryKey);
  if (tone === "inProgress") bucket.inProgress += 1;
  else if (tone !== "done" && tone !== "canceled") bucket.todo += 1;
  if (!hasFixVersion) bucket.unplanned += 1;
}

export function mapRawToProductIssue(
  issue: { key: string; id: string; fields?: Record<string, any> },
  epicLinkField: string,
  epicSummaries?: Map<string, string>
): ProductIssue | null {
  const fields = issue.fields || {};
  if (isSubtaskIssueType(fields)) return null;

  const statusName = fields.status?.name || "Unknown";
  const statusCategoryKey = fields.status?.statusCategory?.key as
    | string
    | undefined;
  if (isBacklogExcludedStatus(statusName, statusCategoryKey)) return null;

  const issuetype = fields.issuetype?.name || "Story";
  const isEpic = issuetype.toLowerCase() === "epic";
  const epicKey = isEpic ? issue.key : resolveEpicKey(fields, epicLinkField);
  const fixVersions = Array.isArray(fields.fixVersions)
    ? fields.fixVersions
    : [];
  const labels: string[] = Array.isArray(fields.labels) ? fields.labels : [];

  return {
    key: issue.key,
    id: String(issue.id),
    summary: fields.summary || "",
    status: statusName,
    statusCategoryKey,
    issuetype,
    priority: fields.priority?.name as string | undefined,
    assignee: fields.assignee?.name as string | undefined,
    assigneeDisplayName: fields.assignee?.displayName as string | undefined,
    components: ((fields.components as { name: string }[]) || []).map(
      (c) => c.name
    ),
    lens: parseLensFromLabels(labels),
    epicKey,
    epicSummary: epicKey
      ? epicSummaries?.get(epicKey) ||
        (isEpic ? fields.summary || epicKey : undefined)
      : undefined,
    fixVersionIds: fixVersions.map((v: { id: string }) => String(v.id)),
    fixVersionNames: fixVersions.map((v: { name: string }) => v.name as string),
    isEpic,
  };
}

export function productGroupKey(
  issue: ProductIssue,
  groupBy: ProductGroupBy
): string {
  switch (groupBy) {
    case "epic":
      return issue.epicKey || "__no_epic__";
    case "status":
      return issue.status || "Unknown";
    case "type":
      return issue.issuetype || "Unknown";
    case "version":
      return issue.fixVersionNames[0] || "__unplanned__";
    case "none":
    default:
      return "__all__";
  }
}

export function productGroupLabel(
  issue: ProductIssue,
  groupBy: ProductGroupBy,
  groupKey: string
): string {
  switch (groupBy) {
    case "epic":
      if (groupKey === "__no_epic__") return "بدون اپیک";
      return issue.epicSummary
        ? `${groupKey} — ${issue.epicSummary}`
        : groupKey;
    case "version":
      return groupKey === "__unplanned__" ? "بدون ورژن" : groupKey;
    case "none":
      return "";
    default:
      return groupKey;
  }
}
