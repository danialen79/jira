import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const response = await fetch(
      `${jiraUrl}/rest/api/2/project/${projectKey}/versions`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch versions (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const versions = (data || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      released: v.released,
      startDate: v.startDate,
      releaseDate: v.releaseDate,
      description: v.description,
      archived: v.archived,
      overdue: v.overdue,
    }));

    return NextResponse.json({ success: true, versions, projectKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Versions Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch versions: ${message}` },
      { status: 500 }
    );
  }
}
