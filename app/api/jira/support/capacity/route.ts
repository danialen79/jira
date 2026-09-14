import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

const TARGET_PCT = 20;

/**
 * Capacity strip: % of Story+Bug in a SIP fixVersion with label from-ps.
 * GET ?versionId=10510
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const versionId = (url.searchParams.get("versionId") || "").trim();
    if (!versionId) {
      return NextResponse.json(
        { error: "versionId is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, projectKey } = getJiraClient();
    const jql = `project = '${projectKey}' AND fixVersion = ${/^\d+$/.test(versionId) ? versionId : `"${versionId.replace(/"/g, '\\"')}"`} AND issuetype in (Story, Bug) AND resolution = EMPTY`;

    const response = await fetch(`${jiraUrl}/rest/api/2/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jql,
        maxResults: 200,
        fields: ["labels", "issuetype", "summary"],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Capacity query failed (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const issues = Array.isArray(data.issues) ? data.issues : [];
    const total = issues.length;
    let fromPs = 0;
    for (const issue of issues) {
      const labels: string[] = Array.isArray(issue.fields?.labels)
        ? issue.fields.labels
        : [];
      if (labels.some((l) => String(l).toLowerCase() === "from-ps")) {
        fromPs += 1;
      }
    }

    const pct = total > 0 ? Math.round((fromPs / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      versionId,
      projectKey,
      total,
      fromPs,
      pct,
      targetPct: TARGET_PCT,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Support capacity error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
