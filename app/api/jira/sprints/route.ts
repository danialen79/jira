import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { JiraBoardConfigError, requireScrumBoard } from "@/lib/jira-board";
import { mapAgileSprint } from "@/lib/sprint/map";

export async function GET() {
  try {
    const board = requireScrumBoard();
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const [openRes, closedRes] = await Promise.all([
      fetch(
        `${jiraUrl}/rest/agile/1.0/board/${board.boardId}/sprint?state=active,future&maxResults=50`,
        { method: "GET", headers }
      ),
      fetch(
        `${jiraUrl}/rest/agile/1.0/board/${board.boardId}/sprint?state=closed&maxResults=6`,
        { method: "GET", headers }
      ),
    ]);

    if (!openRes.ok) {
      const text = await openRes.text();
      return NextResponse.json(
        {
          error: `Failed to fetch sprints (${openRes.status}): ${text || openRes.statusText}`,
        },
        { status: openRes.status }
      );
    }

    const openData = await openRes.json();
    const closedData = closedRes.ok ? await closedRes.json() : { values: [] };

    const boardMeta = { id: board.boardId, name: board.boardName };
    const open = ((openData.values || []) as Array<Record<string, unknown>>).map(
      (s) => mapAgileSprint(s, boardMeta)
    );
    const closed = (
      (closedData.values || []) as Array<Record<string, unknown>>
    ).map((s) => mapAgileSprint(s, boardMeta));

    // Closed API returns newest-first on many servers; keep last 6
    const closedRecent = closed.slice(0, 6);

    return NextResponse.json({
      success: true,
      sprints: [...open, ...closedRecent],
      active: open.filter((s) => s.state === "active"),
      future: open.filter((s) => s.state === "future"),
      closed: closedRecent,
      board,
      projectKey,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError || err instanceof JiraBoardConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Sprints Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch sprints: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const board = requireScrumBoard();
    const { jiraUrl, headers } = getJiraClient();
    const body = await request.json();

    const name = String(body?.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Sprint name is required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      name,
      originBoardId: board.boardId,
    };
    if (body?.startDate) payload.startDate = body.startDate;
    if (body?.endDate) payload.endDate = body.endDate;
    if (typeof body?.goal === "string") payload.goal = body.goal;

    const res = await fetch(`${jiraUrl}/rest/agile/1.0/sprint`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Failed to create sprint (${res.status}): ${
            typeof data === "string" ? data : data?.errorMessages?.[0] || text
          }`,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      sprint: mapAgileSprint(data, {
        id: board.boardId,
        name: board.boardName,
      }),
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError || err instanceof JiraBoardConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Sprint Create Error:", err);
    return NextResponse.json(
      { error: `Failed to create sprint: ${message}` },
      { status: 500 }
    );
  }
}
