import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { writeIssueEpicLink } from "@/lib/jira-issue-writes";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueKey = String(body?.issueKey || "").trim();
    const epicKeyRaw = body?.epicKey;
    const epicKey =
      epicKeyRaw === null || epicKeyRaw === undefined || epicKeyRaw === ""
        ? null
        : String(epicKeyRaw).trim().toUpperCase();
    if (!issueKey) {
      return NextResponse.json(
        { error: "issueKey is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";
    const result = await writeIssueEpicLink(
      { jiraUrl, headers },
      issueKey,
      epicKey,
      epicLinkField
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          skipped: result.skipped,
        },
        { status: result.skipped ? 400 : 500 }
      );
    }

    return NextResponse.json({ success: true, epicKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Update failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
