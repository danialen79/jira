import { NextResponse } from "next/server";
import { AI_WORKLOG_SYSTEM_INSTRUCTION } from "@/lib/gemini";
import { generateAIJson as generateAIJsonBase } from "@/lib/ai-provider";

export async function POST(req: Request) {
  try {
    const { prompt, issues, language, model, provider } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }
    if (!issues || !Array.isArray(issues)) {
      return NextResponse.json(
        { error: "An array of active issues is required." },
        { status: 400 }
      );
    }

    // language is accepted for API compatibility with the Express route body
    void language;

    const issuesListText = issues
      .map(
        (issue: any) =>
          `Key: ${issue.key} | Summary: ${issue.summary} | Type: ${issue.issuetype} | Status: ${issue.status} | Assignee: ${issue.assigneeDisplayName || issue.assignee}`
      )
      .join("\n");

    const userPromptText = `Active Project Jira Tickets:
"""
${issuesListText}
"""

User's Daily Work Summary Prompt:
"""
${prompt}
"""`;

    const { data, successfulModel } = await generateAIJsonBase({
      provider,
      kind: "aiWorklogPlan",
      model,
      systemInstruction: AI_WORKLOG_SYSTEM_INSTRUCTION,
      userPrompt: userPromptText,
      temperature: 0.2,
    });

    console.log(
      `[Jira Server AI Worklog] Generating Sub-task Plan using ${successfulModel}`
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
