import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const jql = `project = '${projectKey}' ORDER BY updated DESC`;
    const searchUrl = `${jiraUrl}/rest/api/2/search`;

    console.log(`[Jira Server] Fetching my issues with JQL: ${jql} at ${searchUrl}`);
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jql,
        maxResults: 150,
        fields: [
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
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Jira search returned error (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const issues = (data.issues || []).map((issue: any) => {
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

      return {
        key: issue.key,
        id: issue.id,
        summary: fields.summary || "",
        description: fields.description || "",
        status: fields.status?.name || "Todo",
        priority: fields.priority?.name || "Medium",
        assignee: fields.assignee?.name || "",
        assigneeDisplayName: fields.assignee?.displayName || "",
        assigneeEmail: fields.assignee?.emailAddress || "",
        assigneeKey: fields.assignee?.key || "",
        issuetype: fields.issuetype?.name || "Story",
        timespent: fields.timespent || 0,
        timeoriginalestimate: fields.timeoriginalestimate || 0,
        worklogs,
        created: fields.created,
      };
    });

    return NextResponse.json({ success: true, issues, projectKey });
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
