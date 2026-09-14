import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { JiraBoardConfigError, requireScrumBoard } from "@/lib/jira-board";
import { mapAgileSprint } from "@/lib/sprint/map";

type Ctx = { params: Promise<{ sprintId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const board = requireScrumBoard();
    const { sprintId } = await context.params;
    const id = Number(sprintId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid sprintId" }, { status: 400 });
    }

    const { jiraUrl, headers } = getJiraClient();
    const res = await fetch(`${jiraUrl}/rest/agile/1.0/sprint/${id}`, {
      method: "GET",
      headers,
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
        { error: `Failed to fetch sprint (${res.status}): ${text}` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      sprint: mapAgileSprint(data, {
        id: board.boardId,
        name: board.boardName,
      }),
      board,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError || err instanceof JiraBoardConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch sprint: ${message}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: Ctx) {
  try {
    const board = requireScrumBoard();
    const { sprintId } = await context.params;
    const id = Number(sprintId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid sprintId" }, { status: 400 });
    }

    const body = await request.json();
    const { jiraUrl, headers } = getJiraClient();

    // Fetch current sprint to merge required fields for partial updates
    const currentRes = await fetch(`${jiraUrl}/rest/agile/1.0/sprint/${id}`, {
      method: "GET",
      headers,
    });
    if (!currentRes.ok) {
      const text = await currentRes.text();
      return NextResponse.json(
        { error: `Sprint not found (${currentRes.status}): ${text}` },
        { status: currentRes.status }
      );
    }
    const current = await currentRes.json();

    const payload: Record<string, unknown> = {
      id,
      self: current.self,
      state: body.state ?? current.state,
      name: body.name ?? current.name,
      startDate: body.startDate !== undefined ? body.startDate : current.startDate,
      endDate: body.endDate !== undefined ? body.endDate : current.endDate,
      originBoardId: current.originBoardId ?? board.boardId,
      goal: body.goal !== undefined ? body.goal : current.goal,
    };

    // Remove nullish optional dates that Jira rejects when empty string
    if (!payload.startDate) delete payload.startDate;
    if (!payload.endDate) delete payload.endDate;
    if (payload.goal === null) payload.goal = "";

    const res = await fetch(`${jiraUrl}/rest/agile/1.0/sprint/${id}`, {
      method: "PUT",
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
          error: `Failed to update sprint (${res.status}): ${
            typeof data === "string"
              ? data
              : data?.errorMessages?.[0] || text
          }`,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      sprint: mapAgileSprint(data || current, {
        id: board.boardId,
        name: board.boardName,
      }),
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError || err instanceof JiraBoardConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update sprint: ${message}` },
      { status: 500 }
    );
  }
}
