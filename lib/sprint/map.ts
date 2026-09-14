import type { JiraSprint, SprintIssue } from "@/lib/types";

export function mapAgileSprint(
  s: Record<string, unknown>,
  board?: { id: number; name: string }
): JiraSprint {
  const stateRaw = String(s.state || "future").toLowerCase();
  const state =
    stateRaw === "active" || stateRaw === "closed" || stateRaw === "future"
      ? stateRaw
      : "future";

  return {
    id: Number(s.id),
    name: String(s.name || ""),
    state,
    boardId: board?.id,
    boardName: board?.name,
    goal: typeof s.goal === "string" ? s.goal : undefined,
    startDate: typeof s.startDate === "string" ? s.startDate : undefined,
    endDate: typeof s.endDate === "string" ? s.endDate : undefined,
    completeDate:
      typeof s.completeDate === "string" ? s.completeDate : undefined,
  };
}

export function mapSprintIssue(issue: Record<string, unknown>): SprintIssue {
  const fields = (issue.fields || {}) as Record<string, any>;
  const parentKey =
    typeof fields.parent?.key === "string" ? fields.parent.key : undefined;
  const parentSummary =
    typeof fields.parent?.fields?.summary === "string"
      ? fields.parent.fields.summary
      : undefined;
  const isSubtask = Boolean(fields.issuetype?.subtask);

  return {
    key: String(issue.key || ""),
    id: String(issue.id || ""),
    summary: String(fields.summary || ""),
    status: String(fields.status?.name || ""),
    statusCategoryKey: fields.status?.statusCategory?.key as string | undefined,
    issuetype: String(fields.issuetype?.name || ""),
    priority: fields.priority?.name as string | undefined,
    assignee: fields.assignee?.name as string | undefined,
    assigneeDisplayName: fields.assignee?.displayName as string | undefined,
    timeoriginalestimate: Number(fields.timeoriginalestimate || 0) || 0,
    timeestimate: Number(fields.timeestimate || 0) || 0,
    timespent: Number(fields.timespent || 0) || 0,
    parentKey,
    parentSummary,
    isSubtask,
  };
}

/** Nest sub-tasks under their parent story; orphan parents become placeholders. */
export function nestSprintIssues(issues: SprintIssue[]): SprintIssue[] {
  const byKey = new Map(issues.map((i) => [i.key, { ...i, children: [] as SprintIssue[] }]));
  const roots: SprintIssue[] = [];
  const attached = new Set<string>();

  for (const issue of issues) {
    if (!issue.isSubtask || !issue.parentKey) continue;
    const parent = byKey.get(issue.parentKey);
    const child = byKey.get(issue.key);
    if (!child) continue;

    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(child);
      attached.add(issue.key);
    } else {
      // Parent not in sprint — synthetic group header
      let placeholder = byKey.get(issue.parentKey);
      if (!placeholder) {
        placeholder = {
          key: issue.parentKey,
          id: `placeholder-${issue.parentKey}`,
          summary: issue.parentSummary || issue.parentKey,
          status: "",
          issuetype: "Story",
          placeholder: true,
          children: [],
        };
        byKey.set(issue.parentKey, placeholder);
        roots.push(placeholder);
      } else if (
        placeholder.placeholder &&
        issue.parentSummary &&
        placeholder.summary === placeholder.key
      ) {
        placeholder.summary = issue.parentSummary;
      }
      placeholder.children = placeholder.children || [];
      placeholder.children.push(child);
      attached.add(issue.key);
    }
  }

  for (const issue of issues) {
    if (attached.has(issue.key)) continue;
    const node = byKey.get(issue.key);
    if (node) roots.push(node);
  }

  for (const node of byKey.values()) {
    if (node.children?.length) {
      node.children.sort(compareIssuesByWorkflow);
    }
  }
  roots.sort(compareIssuesByWorkflow);
  return roots;
}

export function flattenSprintTree(nodes: SprintIssue[]): SprintIssue[] {
  const out: SprintIssue[] = [];
  for (const n of nodes) {
    if (!n.placeholder) out.push(n);
    if (n.children?.length) out.push(...flattenSprintTree(n.children));
  }
  return out;
}

export function statusBucket(
  categoryKey?: string
): "todo" | "inProgress" | "done" {
  const key = (categoryKey || "").toLowerCase();
  if (key === "done") return "done";
  if (key === "indeterminate") return "inProgress";
  return "todo";
}

/** Workflow order: To Do → In Progress → Done (not JQL `ORDER BY status`, which is name/workflow-id based). */
const BUCKET_RANK = { todo: 0, inProgress: 1, done: 2 } as const;

export function statusSortRank(categoryKey?: string): number {
  return BUCKET_RANK[statusBucket(categoryKey)];
}

/** Placeholders rank by their most-open child so incomplete work stays near the top. */
export function issueWorkflowRank(issue: SprintIssue): number {
  if (issue.placeholder) {
    const kids = issue.children || [];
    if (kids.length === 0) return BUCKET_RANK.todo;
    return Math.min(...kids.map((c) => statusSortRank(c.statusCategoryKey)));
  }
  return statusSortRank(issue.statusCategoryKey);
}

export function compareIssuesByWorkflow(a: SprintIssue, b: SprintIssue): number {
  const byStatus = issueWorkflowRank(a) - issueWorkflowRank(b);
  if (byStatus !== 0) return byStatus;
  return a.key.localeCompare(b.key, undefined, { numeric: true });
}

export function secondsToHours(seconds: number): number {
  if (!seconds || !Number.isFinite(seconds)) return 0;
  return Math.round((seconds / 3600) * 10) / 10;
}

export async function fetchAllSprintIssues(
  jiraUrl: string,
  headers: Record<string, string>,
  boardId: number,
  sprintId: number
): Promise<SprintIssue[]> {
  const issues: SprintIssue[] = [];
  let startAt = 0;
  const maxResults = 50;

  for (;;) {
    const url = `${jiraUrl}/rest/agile/1.0/board/${boardId}/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=summary,status,issuetype,priority,assignee,timeoriginalestimate,timeestimate,timespent,parent`;
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to fetch sprint issues (${res.status}): ${text || res.statusText}`
      );
    }
    const data = await res.json();
    const batch = ((data.issues || []) as Array<Record<string, unknown>>).map(
      mapSprintIssue
    );
    issues.push(...batch);
    const total = Number(data.total ?? issues.length);
    startAt += batch.length;
    if (batch.length === 0 || startAt >= total) break;
  }

  return issues;
}

export function chunkKeys(keys: string[], size = 50): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < keys.length; i += size) {
    out.push(keys.slice(i, i + size));
  }
  return out;
}
