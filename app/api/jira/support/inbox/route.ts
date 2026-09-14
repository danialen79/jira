import { NextResponse } from "next/server";
import {
  getJiraClient,
  getJiraSupportProjectKey,
  JiraEnvError,
} from "@/lib/jira";
import { mapSupportIssue, supportInboxJql } from "@/lib/support";

const PAGE_SIZE = 100;
const MAX_ISSUES = 300;

const FIELDS = [
  "summary",
  "description",
  "status",
  "issuetype",
  "priority",
  "updated",
  "created",
  "issuelinks",
  "assignee",
  "reporter",
];

type SupportMapped = ReturnType<typeof mapSupportIssue>;

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey: deliveryProjectKey } = getJiraClient();
    const supportProjectKey = getJiraSupportProjectKey();
    const jql = supportInboxJql(supportProjectKey);
    const searchUrl = `${jiraUrl}/rest/api/2/search`;

    const issues: SupportMapped[] = [];
    let startAt = 0;
    let total = 0;
    while (issues.length < MAX_ISSUES) {
      const response = await fetch(searchUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jql,
          startAt,
          maxResults: PAGE_SIZE,
          fields: FIELDS,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return NextResponse.json(
          {
            error: `Failed to fetch support inbox (${response.status}): ${text || response.statusText}`,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      total = data.total ?? 0;
      const batch = Array.isArray(data.issues) ? data.issues : [];
      for (const issue of batch) {
        issues.push(mapSupportIssue(issue, deliveryProjectKey));
        if (issues.length >= MAX_ISSUES) break;
      }
      if (batch.length < PAGE_SIZE || issues.length >= total) break;
      startAt += batch.length;
    }

    return NextResponse.json({
      success: true,
      supportProjectKey,
      deliveryProjectKey,
      total,
      issues,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Support inbox error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
