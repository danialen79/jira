import { NextResponse } from "next/server";
import { normalizeDueDateWrite } from "@/lib/due-date";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { writeIssueDueDate } from "@/lib/jira-issue-writes";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueKey = String(body.issueKey || "").trim();
    if (!issueKey) {
      return NextResponse.json(
        { error: "issueKey is required." },
        { status: 400 }
      );
    }

    const normalized = normalizeDueDateWrite(body.dueDate);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const { jiraUrl, headers } = getJiraClient();
    const result = await writeIssueDueDate(
      { jiraUrl, headers },
      issueKey,
      normalized.dueDate
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      key: issueKey,
      dueDate: normalized.dueDate,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Due Date Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update due date";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
