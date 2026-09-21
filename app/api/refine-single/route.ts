import { NextResponse } from "next/server";
import { sanitizeJiraText } from "@/lib/jira";
import { getRefineSingleSystemInstruction } from "@/lib/gemini";
import { generateAIJson as generateAIJsonBase } from "@/lib/ai-provider";

export async function POST(req: Request) {
  try {
    const {
      summary,
      description,
      issuetype,
      customPrompt,
      draftText,
      model,
      provider,
    } = await req.json();

    const systemInstruction = getRefineSingleSystemInstruction(issuetype);

    const userPrompt = `
=== ORIGINAL BACKGROUND CONTEXT (Draft Requirements) ===
${draftText || "None"}

=== CURRENT TICKET INFO ===
Title/Summary: ${summary}
Issue Type: ${issuetype}
Current Description:
${description}

=== CUSTOM INSTRUCTION FOR RE-REFINEMENT ===
${customPrompt}

Please revise this ticket according to the custom instruction above.
`;

    const { data, successfulModel } = await generateAIJsonBase({
      provider,
      kind: "refineSingle",
      model,
      systemInstruction,
      userPrompt,
    });

    if (data.summary) data.summary = sanitizeJiraText(data.summary);
    if (data.description) data.description = sanitizeJiraText(data.description);
    data.refinedByModel = successfulModel;
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("AI Single Refine Error:", err);
    return NextResponse.json(
      { error: `Revision failed: ${err.message}` },
      { status: 500 }
    );
  }
}
