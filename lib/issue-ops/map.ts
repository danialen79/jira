import { parseLensFromLabels } from "@/lib/lens";
import { issueOwnsFixVersion } from "@/lib/fix-version-policy";
import type { OpsIssue } from "@/lib/issue-ops/types";

export function resolveEpicKey(
  fields: Record<string, unknown>,
  epicLinkField: string
): string | undefined {
  const epicLink = fields[epicLinkField];
  if (typeof epicLink === "string" && epicLink.trim()) return epicLink.trim();
  if (epicLink && typeof epicLink === "object" && "key" in epicLink) {
    const k = (epicLink as { key?: string }).key;
    if (k) return k;
  }
  const epic = fields.epic as { key?: string } | undefined;
  if (epic?.key) return epic.key;
  const parent = fields.parent as
    | { key?: string; fields?: { issuetype?: { name?: string } } }
    | undefined;
  if (
    parent?.key &&
    parent.fields?.issuetype?.name?.toLowerCase() === "epic"
  ) {
    return parent.key;
  }
  return undefined;
}

export function isSubtaskIssueType(fields: {
  issuetype?: { name?: string; subtask?: boolean };
}): boolean {
  if (fields.issuetype?.subtask) return true;
  const name = (fields.issuetype?.name || "").toLowerCase();
  return name === "sub-task" || name === "subtask";
}

/** Parents that can own sub-tasks in the Ops list (not Epic / Sub-task). */
export function canHaveSubtasks(issuetype: string): boolean {
  const t = issuetype.toLowerCase();
  if (t === "epic" || t === "sub-task" || t === "subtask") return false;
  return t === "story" || t === "bug" || t === "task";
}

export function mapRawToOpsIssue(
  issue: {
    key: string;
    id: string;
    fields?: Record<string, any>;
  },
  epicLinkField: string
): OpsIssue {
  const fields = issue.fields || {};
  const epicKey = resolveEpicKey(fields, epicLinkField);
  const issuetype = fields.issuetype?.name || "Story";
  const hasEpicLink = Boolean(epicKey);
  const owns = issueOwnsFixVersion(issuetype, hasEpicLink);
  const fixVersions = Array.isArray(fields.fixVersions)
    ? fields.fixVersions
    : [];
  const fixVersionIds = fixVersions.map((v: { id: string }) => String(v.id));
  const fixVersionNames = fixVersions.map(
    (v: { name: string }) => v.name as string
  );
  const labels: string[] = Array.isArray(fields.labels) ? fields.labels : [];
  const parentKey =
    typeof fields.parent?.key === "string" ? fields.parent.key : undefined;
  const isSubtask = isSubtaskIssueType(fields);

  return {
    key: issue.key,
    id: String(issue.id),
    summary: fields.summary || "",
    issuetype,
    status: fields.status?.name || "Unknown",
    statusCategoryKey: fields.status?.statusCategory?.key as string | undefined,
    priority: fields.priority?.name as string | undefined,
    assignee: fields.assignee?.name as string | undefined,
    assigneeDisplayName: fields.assignee?.displayName as string | undefined,
    components: ((fields.components as { name: string }[]) || []).map(
      (c) => c.name
    ),
    lens: parseLensFromLabels(labels),
    epicKey,
    parentKey,
    isSubtask,
    fixVersionIds,
    fixVersionNames,
    ownsFixVersion: owns,
    effectiveFixVersionId: owns ? fixVersionIds[0] : undefined,
    effectiveFixVersionName: owns ? fixVersionNames[0] : undefined,
    effectiveFixVersionFromEpic: false,
  };
}

export const OPS_ISSUE_SEARCH_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "components",
  "labels",
  "fixVersions",
  "parent",
] as const;
