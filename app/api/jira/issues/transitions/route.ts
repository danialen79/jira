import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { writeIssueStatusTransition } from "@/lib/jira-issue-writes";

/**
 * List reachable destination status names for an issue (from transitions).
 * GET ?issueKey=PROJ-1
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const issueKey = (url.searchParams.get("issueKey") || "").trim();
    if (!issueKey) {
      return NextResponse.json(
        { error: "issueKey is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();
    const transitionsUrl = `${jiraUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`;
    const response = await fetch(transitionsUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch transitions (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const transitions = data.transitions || [];
    const statuses: string[] = [];
    const seen = new Set<string>();
    for (const t of transitions) {
      const name = (t.to?.name || t.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      statuses.push(name);
    }

    return NextResponse.json({
      success: true,
      issueKey,
      statuses,
      transitions: transitions.map(
        (t: { id: string; name: string; to?: { name?: string } }) => ({
          id: String(t.id),
          name: t.name,
          to: t.to?.name,
        })
      ),
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Transitions Error:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Transition an issue to a destination status by name.
 * POST { issueKey, statusName }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueKey = String(body.issueKey || "").trim();
    const statusName = String(body.statusName || body.status || "").trim();

    if (!issueKey || !statusName) {
      return NextResponse.json(
        { error: "issueKey and statusName are required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();
    const result = await writeIssueStatusTransition(
      { jiraUrl, headers },
      issueKey,
      statusName
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, skipped: result.skipped },
        { status: result.skipped ? 400 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      issueKey,
      transitionedTo: result.transitionName,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Transition POST Error:", err);
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
