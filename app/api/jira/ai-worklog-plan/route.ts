import { NextResponse } from "next/server";
import { AI_WORKLOG_SYSTEM_INSTRUCTION } from "@/lib/gemini";
import { generateAIJson as generateAIJsonBase } from "@/lib/ai-provider";

const CHIP_CONSTRAINED_ADDENDUM = `
IMPORTANT CONSTRAINT MODE:
- You MUST only use parent tickets from the provided list. Do not invent keys.
- Always set parentType = "existing" and parentKey to one of the listed keys.
- Never propose parentType = "new" or a new Story.
- Prefer matching work to the listed tickets; distribute time across them when the user describes multiple activities.
- Still fill subTaskSummary as a short activity title for the plan UI (it will be logged on the parent, not as a new Sub-task).
`;

export async function POST(req: Request) {
  try {
    const { prompt, issues, language, model, provider, constrainToIssues } =
      await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }
    if (!issues || !Array.isArray(issues)) {
      return NextResponse.json(
        { error: "An array of active issues is required." },
        { status: 400 }
      );
    }

    void language;

    const issuesListText = issues
      .map(
        (issue: any) =>
          `Key: ${issue.key} | Summary: ${issue.summary} | Type: ${issue.issuetype} | Status: ${issue.status} | Assignee: ${issue.assigneeDisplayName || issue.assignee}`
      )
      .join("\n");

    const constrained = Boolean(constrainToIssues) && issues.length > 0;

    const userPromptText = `${constrained ? "Allowed tickets only (do not use any other keys):\n" : "Active Project Jira Tickets:\n"}"""
${issuesListText}
"""

User's Daily Work Summary Prompt:
"""
${prompt}
"""`;

    const systemInstruction = constrained
      ? `${AI_WORKLOG_SYSTEM_INSTRUCTION}\n${CHIP_CONSTRAINED_ADDENDUM}`
      : AI_WORKLOG_SYSTEM_INSTRUCTION;

    const { data, successfulModel } = await generateAIJsonBase({
      provider,
      kind: "aiWorklogPlan",
      model,
      systemInstruction,
      userPrompt: userPromptText,
    });

    console.log(
      `[Jira Server AI Worklog] Generating plan using ${successfulModel}${constrained ? " (chip-constrained)" : ""}`
    );
    return NextResponse.json({ success: true, proposals: data.proposals || [] });
  } catch (err: any) {
    console.error("AI Worklog Plan Error:", err);
    return NextResponse.json(
      { error: `Failed to plan worklog: ${err.message}` },
      { status: 500 }
    );
  }
}
