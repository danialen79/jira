import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { addJiraComment } from "@/lib/support";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueKey = String(body.issueKey || "").trim().toUpperCase();
    const commentBody = String(body.body || "").trim();

    if (!issueKey || !commentBody) {
      return NextResponse.json(
        { error: "issueKey and body are required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();
    const result = await addJiraComment({
      jiraUrl,
      headers,
      issueKey,
      body: commentBody,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: `Failed to add comment: ${result.error}` },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ success: true, issueKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Issue comment error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
