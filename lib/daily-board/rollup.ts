import { isSubIssueType } from "@/lib/issue-type-badge";
import type {
  BoardColumnDef,
  DailyBoardIssue,
  KanbanColumn,
} from "./types";

const CATEGORY_ORDER: Record<string, number> = {
  new: 0,
  indeterminate: 1,
  defined: 0,
  "to do": 0,
  "in progress": 1,
  done: 2,
  complete: 2,
  undefined: 1,
};

function categoryRank(category: string): number {
  const key = (category || "").toLowerCase().trim();
  if (key in CATEGORY_ORDER) return CATEGORY_ORDER[key];
  if (key.includes("progress")) return 1;
  if (key.includes("done") || key.includes("complete")) return 2;
  return 0;
}

/**
 * Hide sub-tasks as cards. If a sub-task matches the assignee filter,
 * surface its parent (when present in the set) instead.
 * Test PM stories/bugs are always included (shared queue), never as sub-tasks.
 */
export function rollupBoardIssues(
  issues: DailyBoardIssue[],
  matchesAssignee: (issue: DailyBoardIssue) => boolean
): DailyBoardIssue[] {
  const byKey = new Map(issues.map((i) => [i.key, i]));
  const matchingSubtasksByParent = new Map<string, number>();
  const parentsToInclude = new Set<string>();
  const directMatches: DailyBoardIssue[] = [];

  const isTestPm = (issue: DailyBoardIssue) =>
    (issue.status || "").trim().toLowerCase() === "test pm";

  for (const issue of issues) {
    if (issue.issuetype === "Epic") continue;

    if (isSubIssueType(issue.issuetype)) {
      // Never surface Test PM sub-tasks on the daily board.
      if (isTestPm(issue)) continue;
      if (!matchesAssignee(issue)) continue;
      const parentKey = issue.parentKey;
      if (parentKey) {
        matchingSubtasksByParent.set(
          parentKey,
          (matchingSubtasksByParent.get(parentKey) || 0) + 1
        );
        parentsToInclude.add(parentKey);
      }
      continue;
    }

    if (matchesAssignee(issue) || isTestPm(issue)) {
      directMatches.push(issue);
    }
  }

  const resultMap = new Map<string, DailyBoardIssue>();

  for (const issue of directMatches) {
    resultMap.set(issue.key, {
      ...issue,
      rolledUpSubtaskCount: matchingSubtasksByParent.get(issue.key) || 0,
    });
  }

  for (const parentKey of parentsToInclude) {
    if (resultMap.has(parentKey)) continue;
    const parent = byKey.get(parentKey);
    if (
      !parent ||
      isSubIssueType(parent.issuetype) ||
      parent.issuetype === "Epic"
    ) {
      continue;
    }
    resultMap.set(parentKey, {
      ...parent,
      rolledUpSubtaskCount: matchingSubtasksByParent.get(parentKey) || 0,
    });
  }

  return Array.from(resultMap.values());
}

function sortIssues(a: DailyBoardIssue, b: DailyBoardIssue) {
  return (a.key || "").localeCompare(b.key || "", undefined, { numeric: true });
}

/**
 * Build kanban columns from Jira Product board config when provided,
 * always including empty columns. Falls back to statuses present on issues.
 */
export function buildKanbanColumns(
  issues: DailyBoardIssue[],
  boardColumns?: BoardColumnDef[] | null
): KanbanColumn[] {
  if (boardColumns && boardColumns.length > 0) {
    const buckets = boardColumns.map((col) => ({
      status: col.name,
      category: col.category,
      statusNames: col.statusNames,
      dropStatusName: col.dropStatusName,
      issues: [] as DailyBoardIssue[],
      nameSet: new Set(col.statusNames.map((n) => n.toLowerCase())),
    }));

    const other: DailyBoardIssue[] = [];

    for (const issue of issues) {
      const key = (issue.status || "").toLowerCase();
      const bucket = buckets.find((b) => b.nameSet.has(key));
      if (bucket) bucket.issues.push(issue);
      else other.push(issue);
    }

    const columns: KanbanColumn[] = buckets.map((b) => ({
      status: b.status,
      category: b.category,
      statusNames: b.statusNames,
      dropStatusName: b.dropStatusName,
      issues: b.issues.sort(sortIssues),
    }));

    if (other.length > 0) {
      columns.push({
        status: "Other",
        category: "indeterminate",
        statusNames: Array.from(
          new Set(other.map((i) => i.status).filter(Boolean))
        ),
        dropStatusName: other[0]?.status || null,
        issues: other.sort(sortIssues),
      });
    }

    return columns;
  }

  const byStatus = new Map<string, DailyBoardIssue[]>();
  const categoryByStatus = new Map<string, string>();

  for (const issue of issues) {
    const status = issue.status || "Todo";
    if (!byStatus.has(status)) byStatus.set(status, []);
    byStatus.get(status)!.push(issue);
    if (!categoryByStatus.has(status)) {
      categoryByStatus.set(status, issue.statusCategory || "new");
    }
  }

  return Array.from(byStatus.entries())
    .map(([status, colIssues]) => ({
      status,
      category: categoryByStatus.get(status) || "new",
      statusNames: [status],
      dropStatusName: status,
      issues: colIssues.sort(sortIssues),
    }))
    .sort((a, b) => {
      const rankDiff = categoryRank(a.category) - categoryRank(b.category);
      if (rankDiff !== 0) return rankDiff;
      return a.status.localeCompare(b.status);
    });
}

export function findColumnForIssue(
  columns: KanbanColumn[],
  issue: DailyBoardIssue
): KanbanColumn | undefined {
  const key = (issue.status || "").toLowerCase();
  return (
    columns.find((c) =>
      c.statusNames.some((n) => n.toLowerCase() === key)
    ) || columns.find((c) => c.issues.some((i) => i.key === issue.key))
  );
}

export function moveIssueStatus(
  issues: DailyBoardIssue[],
  issueKey: string,
  newStatus: string,
  newCategory?: string
): DailyBoardIssue[] {
  return issues.map((issue) =>
    issue.key === issueKey
      ? {
          ...issue,
          status: newStatus,
          statusCategory: newCategory || issue.statusCategory,
        }
      : issue
  );
}
