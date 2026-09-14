import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Search delivery-project (SIP) issues for link-existing UI.
 * GET ?q=SIP-12 or ?q=export
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (!q || q.length < 2) {
      return NextResponse.json({
        success: true,
        issues: [],
      });
    }

    const { jiraUrl, headers, projectKey } = getJiraClient();
    const pk = escapeJqlString(projectKey);
    const escaped = escapeJqlString(q);
    const keyLike = q.toUpperCase().match(/^[A-Z][A-Z0-9]+-\d+$/);

    const jql = keyLike
      ? `project = '${pk}' AND key = "${escapeJqlString(q.toUpperCase())}"`
      : `project = '${pk}' AND (summary ~ "${escaped}" OR text ~ "${escaped}") ORDER BY updated DESC`;

    const response = await fetch(`${jiraUrl}/rest/api/2/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jql,
        maxResults: 20,
        fields: ["summary", "status", "issuetype", "priority"],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Search failed (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const issues = (data.issues || []).map(
      (issue: {
        key: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
          issuetype?: { name?: string };
          priority?: { name?: string };
        };
      }) => ({
        key: issue.key,
        summary: issue.fields?.summary || "",
        status: issue.fields?.status?.name || "",
        issuetype: issue.fields?.issuetype?.name || "",
        priority: issue.fields?.priority?.name || "",
      })
    );

    return NextResponse.json({ success: true, issues, projectKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("SIP search error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
