import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { writeIssueImpactEffort } from "@/lib/jira-issue-writes";

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

    const hasImpact = Object.prototype.hasOwnProperty.call(body, "impact");
    const hasEffort = Object.prototype.hasOwnProperty.call(body, "effort");
    if (!hasImpact && !hasEffort) {
      return NextResponse.json(
        { error: "Provide impact and/or effort." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const impactFieldId = config.impactFieldId?.trim();
    const effortFieldId = config.effortFieldId?.trim();
    if (!impactFieldId || !effortFieldId) {
      return NextResponse.json(
        {
          error:
            "JIRA_IMPACT_FIELD and JIRA_EFFORT_FIELD must be set in the environment.",
        },
        { status: 503 }
      );
    }

    const result = await writeIssueImpactEffort(
      { jiraUrl, headers },
      issueKey,
      {
        impactFieldId,
        effortFieldId,
        epicLinkField: config.epicLinkField || "customfield_10014",
        ...(hasImpact ? { impact: body.impact } : {}),
        ...(hasEffort ? { effort: body.effort } : {}),
      }
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      key: issueKey,
      impact: result.impact,
      effort: result.effort,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Impact/Effort Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update impact/effort";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
