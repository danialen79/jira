import { NextResponse } from "next/server";
import {
  getJiraClient,
  getJiraSupportProjectKey,
  JiraEnvError,
} from "@/lib/jira";
import {
  isSupportIssueKey,
  mapSupportComments,
  mapSupportIssue,
  type SupportComment,
} from "@/lib/support";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = (url.searchParams.get("key") || "").trim().toUpperCase();
    if (!key) {
      return NextResponse.json({ error: "key is required." }, { status: 400 });
    }

    const supportProjectKey = getJiraSupportProjectKey();
    if (!isSupportIssueKey(key, supportProjectKey)) {
      return NextResponse.json(
        { error: `Issue must belong to ${supportProjectKey}.` },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, projectKey: deliveryProjectKey } = getJiraClient();
    const fieldList = [
      "summary",
      "description",
      "status",
      "issuetype",
      "priority",
      "updated",
      "created",
      "issuelinks",
      "assignee",
      "reporter",
      "attachment",
    ].join(",");

    const response = await fetch(
      `${jiraUrl}/rest/api/2/issue/${encodeURIComponent(key)}?fields=${encodeURIComponent(fieldList)}`,
      { method: "GET", headers }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch issue (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    const commentsRes = await fetch(
      `${jiraUrl}/rest/api/2/issue/${encodeURIComponent(key)}/comment?maxResults=50&orderBy=-created`,
      { method: "GET", headers }
    );
    let comments: SupportComment[] = [];
    if (commentsRes.ok) {
      const commentsData = await commentsRes.json();
      const rawComments = Array.isArray(commentsData.comments)
        ? commentsData.comments
        : [];
      comments = mapSupportComments(rawComments).reverse();
    }

    const issue = mapSupportIssue(data, deliveryProjectKey, { comments });

    return NextResponse.json({
      success: true,
      supportProjectKey,
      deliveryProjectKey,
      issue,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Support issue fetch error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
