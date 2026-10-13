import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { writeIssueSummary } from "@/lib/jira-issue-writes";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueKey = String(body.issueKey || "").trim();
    const summary = String(body.summary ?? "");
    const issuetype = String(body.issuetype || "").trim();

    if (!issueKey) {
      return NextResponse.json(
        { error: "issueKey is required." },
        { status: 400 }
      );
    }
    if (!summary.trim()) {
      return NextResponse.json(
        { error: "summary is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const result = await writeIssueSummary(
      { jiraUrl, headers },
      issueKey,
      summary,
      {
        issuetype,
        epicNameField: config.epicNameField,
      }
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      key: issueKey,
      summary: result.summary,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Summary Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
