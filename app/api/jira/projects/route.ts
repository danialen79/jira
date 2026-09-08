import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers } = getJiraClient();

    const response = await fetch(`${jiraUrl}/rest/api/2/project`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch projects (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const projects = data.map((p: any) => ({
      key: p.key,
      name: p.name,
      id: p.id,
    }));

    return NextResponse.json({ success: true, projects });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Projects Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch projects: ${message}` },
      { status: 500 }
    );
  }
}
