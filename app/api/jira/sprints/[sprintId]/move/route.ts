import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { JiraBoardConfigError, requireScrumBoard } from "@/lib/jira-board";
import { chunkKeys } from "@/lib/sprint/map";

type Ctx = { params: Promise<{ sprintId: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    requireScrumBoard();
    const { sprintId } = await context.params;
    const id = Number(sprintId);
    if (!Number.isFinite(id) && sprintId !== "backlog") {
      // sprintId path is numeric for sprint move; backlog uses target in body
    }

    const body = await request.json();
    const issues = Array.isArray(body?.issues)
      ? (body.issues as unknown[])
          .map((k) => String(k || "").trim())
          .filter(Boolean)
      : [];

    if (issues.length === 0) {
      return NextResponse.json(
        { error: "issues array is required" },
        { status: 400 }
      );
    }

    const target = body?.target === "backlog" ? "backlog" : "sprint";
    const { jiraUrl, headers } = getJiraClient();

    const chunks = chunkKeys(issues, 50);
    const errors: string[] = [];
    let moved = 0;

    for (const chunk of chunks) {
      const url =
        target === "backlog"
          ? `${jiraUrl}/rest/agile/1.0/backlog/issue`
          : `${jiraUrl}/rest/agile/1.0/sprint/${id}/issue`;

      const res = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ issues: chunk }),
      });

      if (!res.ok) {
        const text = await res.text();
        errors.push(
          `chunk failed (${res.status}): ${text || res.statusText}`
        );
      } else {
        moved += chunk.length;
      }
    }

    if (errors.length && moved === 0) {
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      moved,
      target,
      errors: errors.length ? errors : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError || err instanceof JiraBoardConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to move issues: ${message}` },
      { status: 500 }
    );
  }
}
