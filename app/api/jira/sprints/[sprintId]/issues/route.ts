import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { JiraBoardConfigError, requireScrumBoard } from "@/lib/jira-board";
import { fetchAllSprintIssues } from "@/lib/sprint/map";
import { computeHealth } from "@/lib/sprint/metrics";

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
    const issues = await fetchAllSprintIssues(
      jiraUrl,
      headers,
      board.boardId,
      id
    );

    // Optional endDate for health daysLeft — fetch sprint meta lightly
    let endDate: string | undefined;
    try {
      const sprintRes = await fetch(`${jiraUrl}/rest/agile/1.0/sprint/${id}`, {
        method: "GET",
        headers,
      });
      if (sprintRes.ok) {
        const sprint = await sprintRes.json();
        endDate = sprint.endDate;
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      issues,
      health: computeHealth(issues, endDate),
      board,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError || err instanceof JiraBoardConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Sprint issues error:", err);
    return NextResponse.json(
      { error: `Failed to fetch sprint issues: ${message}` },
      { status: 500 }
    );
  }
}
