import { NextResponse } from "next/server";
import { mapRawToOpsIssue } from "@/lib/issue-ops/map";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

/**
 * GET ?parentKey=PROJ-1 — sub-tasks of a parent story/bug/task.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parentKey = (url.searchParams.get("parentKey") || "").trim();
    if (!parentKey) {
      return NextResponse.json(
        { error: "parentKey is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";

    const fields = [
      "summary",
      "status",
      "issuetype",
      "priority",
      "assignee",
      "components",
      "labels",
      "fixVersions",
      "parent",
      epicLinkField,
    ];

    const jql = `parent = ${parentKey} ORDER BY key ASC`;
    const response = await fetch(`${jiraUrl}/rest/api/2/search`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jql,
        startAt: 0,
        maxResults: 100,
        fields,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Jira search failed (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const issues = (data.issues || []).map((raw: any) =>
      mapRawToOpsIssue(raw, epicLinkField)
    );

    return NextResponse.json({
      success: true,
      parentKey,
      issues,
      total: typeof data.total === "number" ? data.total : issues.length,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Subtasks Error:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
