import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { parseLensFromLabels } from "@/lib/lens";
import {
  computeVersionProgress,
  sortIssuesForRoadmap,
} from "@/lib/roadmap";
import type { VersionIssue } from "@/lib/types";

const ISSUE_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "components",
  "labels",
  "parent",
  "epic",
] as const;

function isEpicType(name: string): boolean {
  return name.toLowerCase() === "epic";
}

function mapRawIssue(
  issue: any,
  epicLinkField: string,
  inVersion: boolean
): VersionIssue {
  const fields = issue.fields || {};
  const epicLink = fields[epicLinkField];
  const epicKey =
    (typeof epicLink === "string" ? epicLink : epicLink?.key) ||
    fields.epic?.key ||
    undefined;
  const parentKey = fields.parent?.key as string | undefined;

  return {
    key: issue.key as string,
    id: String(issue.id),
    summary: (fields.summary as string) || "",
    status: fields.status?.name || "Unknown",
    statusCategoryKey: fields.status?.statusCategory?.key as
      | string
      | undefined,
    issuetype: fields.issuetype?.name || "Story",
    priority: fields.priority?.name as string | undefined,
    assignee: fields.assignee?.name as string | undefined,
    assigneeDisplayName: fields.assignee?.displayName as string | undefined,
    components: ((fields.components as any[]) || []).map(
      (c) => c.name as string
    ),
    lens: parseLensFromLabels(
      Array.isArray(fields.labels) ? (fields.labels as string[]) : []
    ),
    epicKey,
    parentKey,
    inVersion,
  };
}

async function jiraSearch(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  jql: string;
  fields: string[];
  maxResults?: number;
}): Promise<{ issues: any[]; total: number }> {
  const response = await fetch(`${opts.jiraUrl}/rest/api/2/search`, {
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: opts.jql,
      maxResults: opts.maxResults ?? 100,
      fields: opts.fields,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Jira search failed (${response.status}): ${text || response.statusText}`
    );
  }

  const data = await response.json();
  return {
    issues: data.issues || [],
    total: typeof data.total === "number" ? data.total : (data.issues || []).length,
  };
}

async function fetchEpicChildren(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  projectKey: string;
  epicKeys: string[];
  epicLinkField: string;
  fields: string[];
}): Promise<VersionIssue[]> {
  const { epicKeys, epicLinkField, projectKey } = opts;
  if (epicKeys.length === 0) return [];

  const children: VersionIssue[] = [];
  const chunkSize = 40;

  for (let i = 0; i < epicKeys.length; i += chunkSize) {
    const chunk = epicKeys.slice(i, i + chunkSize);
    const formatted = chunk.map((k) => `"${k}"`).join(", ");
    const cfNumber = epicLinkField.startsWith("customfield_")
      ? epicLinkField.replace("customfield_", "")
      : null;

    const jqlCandidates = [
      cfNumber
        ? `project = '${projectKey}' AND (cf[${cfNumber}] in (${formatted}) OR "Epic Link" in (${formatted}) OR parent in (${formatted}))`
        : null,
      `project = '${projectKey}' AND ("${epicLinkField}" in (${formatted}) OR "Epic Link" in (${formatted}) OR parent in (${formatted}))`,
      `project = '${projectKey}' AND ("Epic Link" in (${formatted}) OR parent in (${formatted}))`,
      `project = '${projectKey}' AND parent in (${formatted})`,
    ].filter(Boolean) as string[];

    let loaded = false;
    for (const jql of jqlCandidates) {
      try {
        const { issues } = await jiraSearch({
          jiraUrl: opts.jiraUrl,
          headers: opts.headers,
          jql,
          fields: opts.fields,
          maxResults: 200,
        });
        for (const raw of issues) {
          children.push(mapRawIssue(raw, epicLinkField, false));
        }
        loaded = true;
        break;
      } catch {
        // try next JQL shape
      }
    }
    if (!loaded) {
      console.warn("Could not fetch children for epics:", chunk.join(", "));
    }
  }

  return children;
}

function buildIssueTree(
  versionIssues: VersionIssue[],
  epicChildren: VersionIssue[],
  epicKeys: Set<string>
): VersionIssue[] {
  const byKey = new Map<string, VersionIssue>();
  for (const issue of versionIssues) {
    byKey.set(issue.key, { ...issue, inVersion: true });
  }

  const childrenByEpic = new Map<string, VersionIssue[]>();
  const nestedChildKeys = new Set<string>();

  for (const child of epicChildren) {
    if (isEpicType(child.issuetype)) continue;
    const epicKey =
      (child.epicKey && epicKeys.has(child.epicKey) && child.epicKey) ||
      (child.parentKey && epicKeys.has(child.parentKey) && child.parentKey) ||
      null;
    if (!epicKey) continue;

    nestedChildKeys.add(child.key);
    const existing = byKey.get(child.key);
    const node: VersionIssue = existing
      ? { ...existing, inVersion: true, epicKey }
      : { ...child, inVersion: false, epicKey };

    const list = childrenByEpic.get(epicKey) || [];
    if (!list.some((c) => c.key === node.key)) {
      list.push(node);
    }
    childrenByEpic.set(epicKey, list);
  }

  // Also nest version issues that point at an epic in this version
  for (const issue of versionIssues) {
    if (isEpicType(issue.issuetype)) continue;
    const epicKey =
      (issue.epicKey && epicKeys.has(issue.epicKey) && issue.epicKey) ||
      (issue.parentKey && epicKeys.has(issue.parentKey) && issue.parentKey) ||
      null;
    if (!epicKey) continue;
    nestedChildKeys.add(issue.key);
    const list = childrenByEpic.get(epicKey) || [];
    if (!list.some((c) => c.key === issue.key)) {
      list.push({ ...issue, inVersion: true, epicKey });
      childrenByEpic.set(epicKey, list);
    }
  }

  const tree: VersionIssue[] = [];
  for (const issue of versionIssues) {
    if (isEpicType(issue.issuetype)) {
      const kids = sortIssuesForRoadmap(childrenByEpic.get(issue.key) || []);
      tree.push({ ...issue, inVersion: true, children: kids });
      continue;
    }
    if (nestedChildKeys.has(issue.key)) continue;
    tree.push({ ...issue, inVersion: true });
  }

  return tree;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get("versionId")?.trim();
    const versionName = searchParams.get("versionName")?.trim();

    if (!versionId && !versionName) {
      return NextResponse.json(
        { error: "versionId or versionName is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";
    const fields = [...ISSUE_FIELDS, epicLinkField];

    const fixClause = versionId
      ? `fixVersion = ${versionId}`
      : `fixVersion = "${versionName!.replace(/"/g, '\\"')}"`;

    const jql = `project = "${projectKey}" AND ${fixClause} ORDER BY issuetype ASC, status ASC`;

    const { issues: rawVersionIssues, total } = await jiraSearch({
      jiraUrl,
      headers,
      jql,
      fields,
      maxResults: 100,
    });

    const versionIssues = sortIssuesForRoadmap(
      rawVersionIssues.map((issue) => mapRawIssue(issue, epicLinkField, true))
    );

    const epicKeys = versionIssues
      .filter((i) => isEpicType(i.issuetype))
      .map((i) => i.key);

    const epicChildren = await fetchEpicChildren({
      jiraUrl,
      headers,
      projectKey,
      epicKeys,
      epicLinkField,
      fields,
    });

    const tree = buildIssueTree(
      versionIssues,
      epicChildren,
      new Set(epicKeys)
    );

    const progressIssues: VersionIssue[] = [];
    for (const node of tree) {
      progressIssues.push(node);
      if (node.children?.length) {
        progressIssues.push(...node.children);
      }
    }
    const progress = computeVersionProgress(
      progressIssues.length > 0 ? progressIssues : versionIssues
    );

    return NextResponse.json({
      success: true,
      projectKey,
      versionId: versionId || null,
      versionName: versionName || null,
      total,
      issues: versionIssues,
      tree,
      progress,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Version Issues Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch version issues: ${message}` },
      { status: 500 }
    );
  }
}
