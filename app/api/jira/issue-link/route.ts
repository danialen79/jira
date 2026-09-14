import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { createJiraIssueLink } from "@/lib/support";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inwardKey = String(body.inwardKey || "").trim().toUpperCase();
    const outwardKey = String(body.outwardKey || "").trim().toUpperCase();
    const typeName = String(body.type || "Relates").trim() || "Relates";

    if (!inwardKey || !outwardKey) {
      return NextResponse.json(
        { error: "inwardKey and outwardKey are required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();
    const result = await createJiraIssueLink({
      jiraUrl,
      headers,
      inwardKey,
      outwardKey,
      typeName,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: `Failed to create link: ${result.error}` },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inwardKey,
      outwardKey,
      type: typeName,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Issue link error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
