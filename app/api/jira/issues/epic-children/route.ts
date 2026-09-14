import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { parseLensFromLabels } from "@/lib/lens";
import { sortIssuesForRoadmap } from "@/lib/roadmap";
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

function mapRawIssue(issue: any, epicLinkField: string): VersionIssue {
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
    inVersion: false,
  };
}

async function jiraSearch(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  jql: string;
  fields: string[];
}): Promise<any[]> {
  const response = await fetch(`${opts.jiraUrl}/rest/api/2/search`, {
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: opts.jql,
      maxResults: 200,
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
  return data.issues || [];
}

/**
 * GET ?epicKey=PROJ-1 — stories/bugs under an epic (Epic Link / parent).
 */
export async function GET(req: Request) {
  try {
    const epicKey = new URL(req.url).searchParams.get("epicKey")?.trim();
    if (!epicKey) {
      return NextResponse.json(
        { error: "epicKey is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";
    const fields = [...ISSUE_FIELDS, epicLinkField];
    const quoted = `"${epicKey.replace(/"/g, '\\"')}"`;
    const cfNumber = epicLinkField.startsWith("customfield_")
      ? epicLinkField.replace("customfield_", "")
      : null;

    const jqlCandidates = [
      cfNumber
        ? `project = '${projectKey}' AND (cf[${cfNumber}] = ${quoted} OR "Epic Link" = ${quoted} OR parent = ${quoted}) ORDER BY key ASC`
        : null,
      `project = '${projectKey}' AND ("${epicLinkField}" = ${quoted} OR "Epic Link" = ${quoted} OR parent = ${quoted}) ORDER BY key ASC`,
      `project = '${projectKey}' AND ("Epic Link" = ${quoted} OR parent = ${quoted}) ORDER BY key ASC`,
      `project = '${projectKey}' AND parent = ${quoted} ORDER BY key ASC`,
    ].filter(Boolean) as string[];

    let rawIssues: any[] | null = null;
    let lastError = "";
    for (const jql of jqlCandidates) {
      try {
        rawIssues = await jiraSearch({ jiraUrl, headers, jql, fields });
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "search failed";
      }
    }

    if (rawIssues == null) {
      return NextResponse.json(
        { error: lastError || "Failed to fetch epic children." },
        { status: 502 }
      );
    }

    const issues = sortIssuesForRoadmap(
      rawIssues
        .map((raw) => mapRawIssue(raw, epicLinkField))
        .filter((i) => i.issuetype.toLowerCase() !== "epic")
    );

    return NextResponse.json({
      success: true,
      epicKey,
      issues,
      total: issues.length,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Epic Children Error:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
