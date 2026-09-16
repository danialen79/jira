import { NextResponse } from "next/server";
import {
  getJiraClient,
  getJiraSupportProjectKey,
  JiraEnvError,
} from "@/lib/jira";
import {
  addJiraComment,
  alreadyLinked,
  createJiraIssueLink,
  isSupportIssueKey,
  mapSupportIssue,
  supportQueuedComment,
} from "@/lib/support";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const psKey = String(body.psKey || "").trim().toUpperCase();
    const sipKey = String(body.sipKey || "").trim().toUpperCase();

    if (!psKey || !sipKey) {
      return NextResponse.json(
        { error: "psKey and sipKey are required." },
        { status: 400 }
      );
    }

    const supportProjectKey = getJiraSupportProjectKey();
    if (!isSupportIssueKey(psKey, supportProjectKey)) {
      return NextResponse.json(
        { error: `psKey must belong to ${supportProjectKey}.` },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, projectKey } = getJiraClient();
    if (!sipKey.startsWith(`${projectKey}-`)) {
      return NextResponse.json(
        { error: `sipKey must belong to ${projectKey}.` },
        { status: 400 }
      );
    }

    const existingRes = await fetch(
      `${jiraUrl}/rest/api/2/issue/${encodeURIComponent(psKey)}?fields=issuelinks,summary,description,status,issuetype,priority,updated,created,assignee,reporter`,
      { method: "GET", headers }
    );
    if (!existingRes.ok) {
      const text = await existingRes.text();
      return NextResponse.json(
        { error: `Failed to load PS issue: ${text || existingRes.statusText}` },
        { status: existingRes.status }
      );
    }

    const existingData = await existingRes.json();
    const mapped = mapSupportIssue(existingData, projectKey);
    if (alreadyLinked(mapped.linkedSipKeys, sipKey)) {
      return NextResponse.json(
        {
          error: `Already linked to ${sipKey}.`,
          alreadyLinked: true,
          sipKey,
          linkedSip: mapped.linkedSip,
        },
        { status: 409 }
      );
    }

    const linkResult = await createJiraIssueLink({
      jiraUrl,
      headers,
      inwardKey: psKey,
      outwardKey: sipKey,
      typeName: "Relates",
    });

    if (!linkResult.ok) {
      return NextResponse.json(
        { error: `Failed to create link: ${linkResult.error}` },
        { status: linkResult.status || 500 }
      );
    }

    const comment = await addJiraComment({
      jiraUrl,
      headers,
      issueKey: psKey,
      body: supportQueuedComment(sipKey),
    });

    return NextResponse.json({
      success: true,
      psKey,
      sipKey,
      linkOk: true,
      commentOk: comment.ok,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Support link-existing error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
