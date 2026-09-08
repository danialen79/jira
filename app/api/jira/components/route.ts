import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const response = await fetch(
      `${jiraUrl}/rest/api/2/project/${projectKey}/components`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch components (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const components = (data || []).map((comp: any) => ({
      id: comp.id,
      name: comp.name,
      description: comp.description,
    }));

    return NextResponse.json({ success: true, components, projectKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Components Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch components: ${message}` },
      { status: 500 }
    );
  }
}
