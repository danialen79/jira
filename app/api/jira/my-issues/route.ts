import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { isSubIssueType } from "@/lib/issue-type-badge";

const ISSUE_FIELDS = [
  "summary",
  "description",
  "status",
  "priority",
  "assignee",
  "issuetype",
  "timespent",
  "timeoriginalestimate",
  "worklog",
  "created",
  "parent",
];

/** Soft cap so a bad ALL filter cannot pull the whole project. */
const MAX_ISSUES = 500;
const PAGE_SIZE = 100;

function mapIssue(issue: any) {
  const fields = issue.fields || {};
  const worklogData = fields.worklog?.worklogs || [];
  const worklogs = worklogData.map((wl: any) => ({
    id: wl.id,
    author: wl.author?.displayName || wl.author?.name || "Unknown",
    comment: wl.comment || "",
    timeSpent: wl.timeSpent || "",
    timeSpentSeconds: wl.timeSpentSeconds || 0,
    created: wl.created,
  }));

  const statusCategory =
    fields.status?.statusCategory?.key ||
    fields.status?.statusCategory?.name ||
    "";

  return {
    key: issue.key,
    id: issue.id,
    summary: fields.summary || "",
    description: fields.description || "",
    status: fields.status?.name || "Todo",
    statusCategory: String(statusCategory).toLowerCase() || "new",
    priority: fields.priority?.name || "Medium",
    assignee: fields.assignee?.name || "",
    assigneeDisplayName: fields.assignee?.displayName || "",
    assigneeEmail: fields.assignee?.emailAddress || "",
    assigneeKey: fields.assignee?.key || "",
    issuetype: fields.issuetype?.name || "Story",
    parentKey: fields.parent?.key || undefined,
    timespent: fields.timespent || 0,
    timeoriginalestimate: fields.timeoriginalestimate || 0,
    worklogs,
    created: fields.created,
  };
}

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildJql(projectKey: string, assignee: string | null): string {
  const base = `project = '${escapeJqlString(projectKey)}' AND resolution = EMPTY`;
  if (!assignee || assignee === "ALL") {
    return `${base} ORDER BY updated DESC`;
  }
  if (assignee === "currentUser()") {
    return `${base} AND assignee = currentUser() ORDER BY updated DESC`;
  }
  return `${base} AND assignee = "${escapeJqlString(assignee)}" ORDER BY updated DESC`;
}

async function searchAllPages(
  searchUrl: string,
  headers: Record<string, string>,
  jql: string,
  maxIssues: number
): Promise<{ issues: any[]; total: number }> {
  const all: any[] = [];
  let startAt = 0;
  let total = 0;

  while (all.length < maxIssues) {
    const maxResults = Math.min(PAGE_SIZE, maxIssues - all.length);
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jql,
        startAt,
        maxResults,
        fields: ISSUE_FIELDS,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw Object.assign(
        new Error(
          `Jira search returned error (${response.status}): ${text || response.statusText}`
        ),
        { status: response.status }
      );
    }

    const data = await response.json();
    total = typeof data.total === "number" ? data.total : total;
    const page = data.issues || [];
    all.push(...page);
    if (page.length === 0 || all.length >= total) break;
    startAt += page.length;
  }

  return { issues: all, total };
}

export async function GET(req: Request) {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();
    const url = new URL(req.url);
    const assigneeParam = (url.searchParams.get("assignee") || "").trim();
    const assignee =
      !assigneeParam || assigneeParam.toUpperCase() === "ALL"
        ? null
        : assigneeParam;

    const jql = buildJql(projectKey, assignee);
    const searchUrl = `${jiraUrl}/rest/api/2/search`;

    console.log(`[Jira Server] Fetching daily-board issues with JQL: ${jql}`);

    let rawIssues: any[];
    let total: number;
    try {
      const result = await searchAllPages(
        searchUrl,
        headers,
        jql,
        MAX_ISSUES
      );
      rawIssues = result.issues;
      total = result.total;
    } catch (err: any) {
      const status = err?.status || 500;
      return NextResponse.json(
        { error: err.message || "Jira search failed" },
        { status }
      );
    }

    const issues = rawIssues.map(mapIssue);
    const byKey = new Set(issues.map((i: { key: string }) => i.key));

    // Always include all non-subtask Test PM issues (shared queue for daily board).
    try {
      const testPmJql = `project = '${escapeJqlString(projectKey)}' AND status = "Test PM" ORDER BY updated DESC`;
      const testPm = await searchAllPages(searchUrl, headers, testPmJql, 200);
      for (const raw of testPm.issues) {
        const mapped = mapIssue(raw);
        if (isSubIssueType(mapped.issuetype)) continue;
        if (!byKey.has(mapped.key)) {
          issues.push(mapped);
          byKey.add(mapped.key);
        }
      }
    } catch (err) {
      console.warn("[Jira Server] Test PM fetch skipped:", err);
    }

    const missingParents = Array.from(
      new Set(
        issues
          .filter(
            (i: { issuetype: string; parentKey?: string }) =>
              isSubIssueType(i.issuetype) &&
              i.parentKey &&
              !byKey.has(i.parentKey)
          )
          .map((i: { parentKey?: string }) => i.parentKey as string)
      )
    ).slice(0, 100);

    if (missingParents.length > 0) {
      const parentJql = `key in (${missingParents.join(",")})`;
      const parentRes = await fetch(searchUrl, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql: parentJql,
          maxResults: missingParents.length,
          fields: ISSUE_FIELDS,
        }),
      });
      if (parentRes.ok) {
        const parentData = await parentRes.json();
        for (const raw of parentData.issues || []) {
          const mapped = mapIssue(raw);
          if (!byKey.has(mapped.key)) {
            issues.push(mapped);
            byKey.add(mapped.key);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      issues,
      projectKey,
      total,
      truncated: total > issues.length,
      jql,
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira My Issues Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch issues: ${err.message}` },
      { status: 500 }
    );
  }
}
