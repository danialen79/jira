import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const response = await fetch(
      `${jiraUrl}/rest/api/2/user/assignable/search?project=${projectKey}&maxResults=100`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch users (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const users = (data || []).map((u: any) => ({
      name: u.name,
      displayName: u.displayName,
      emailAddress: u.emailAddress,
      avatarUrls: u.avatarUrls,
    }));

    return NextResponse.json({ success: true, users, projectKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Users Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch assignable users: ${message}` },
      { status: 500 }
    );
  }
}
