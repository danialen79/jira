import { NextResponse } from "next/server";
import {
  convertToJiraWikiMarkup,
  getJiraClient,
  JiraEnvError,
} from "@/lib/jira";
import { putIssueFields } from "@/lib/jira-issue-writes";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueKey = String(body?.issueKey || "").trim();
    const description =
      typeof body?.description === "string" ? body.description : null;

    if (!issueKey || description === null) {
      return NextResponse.json(
        { error: "issueKey and description are required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();
    const put = await putIssueFields(
      { jiraUrl, headers },
      issueKey,
      { description: convertToJiraWikiMarkup(description) }
    );

    if (!put.ok) {
      return NextResponse.json(
        { success: false, error: put.error },
        { status: put.status || 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Update failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
