import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const jql = encodeURIComponent(
      `project = "${projectKey}" AND issuetype = "Epic"`
    );
    const searchUrl = `${jiraUrl}/rest/api/2/search?jql=${jql}&maxResults=100&fields=summary,key`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch epics (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const epics = (data.issues || []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields?.summary || issue.key,
    }));

    return NextResponse.json({ success: true, epics, projectKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Epics Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch epics: ${message}` },
      { status: 500 }
    );
  }
}
