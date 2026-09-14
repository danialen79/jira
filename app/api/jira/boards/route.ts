import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const boardRes = await fetch(
      `${jiraUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`,
      { method: "GET", headers }
    );

    if (!boardRes.ok) {
      const text = await boardRes.text();
      return NextResponse.json(
        {
          error: `Failed to fetch boards (${boardRes.status}): ${text || boardRes.statusText}`,
        },
        { status: boardRes.status }
      );
    }

    const data = await boardRes.json();
    const boards = ((data.values || []) as Array<Record<string, unknown>>)
      .map((b) => ({
        id: Number(b.id),
        name: String(b.name || ""),
        type: String(b.type || ""),
      }))
      .filter((b) => Number.isFinite(b.id) && b.id > 0);

    return NextResponse.json({
      success: true,
      boards,
      scrumBoards: boards.filter((b) => b.type === "scrum"),
      projectKey,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Boards Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch boards: ${message}` },
      { status: 500 }
    );
  }
}
