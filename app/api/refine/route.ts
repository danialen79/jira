import { NextResponse } from "next/server";
import { getJiraEnvProjectKey, sanitizeJiraText } from "@/lib/jira";
import {
  getOutputModeInstruction,
  getRefineSystemInstruction,
} from "@/lib/gemini";
import { generateAIJson as generateAIJsonBase } from "@/lib/ai-provider";

export async function POST(req: Request) {
  try {
    const {
      draftText,
      customPrompt,
      projectKey,
      model,
      outputMode,
      provider,
    } = await req.json();
    if (!draftText) {
      return NextResponse.json(
        { error: "Draft stories / requirements text is required." },
        { status: 400 }
      );
    }

    let resolvedProject = projectKey;
    try {
      resolvedProject = getJiraEnvProjectKey();
    } catch {
      // fall back to client-provided or PROJ
    }

    const outputModeInstruction = getOutputModeInstruction(outputMode);
    const systemInstruction = getRefineSystemInstruction(outputModeInstruction);

    const userPrompt = `Project Key: ${resolvedProject || "PROJ"}
Custom User Instructions/Prompt: ${customPrompt || "Clean up descriptions, structure with Acceptance Criteria, and make them professional."}

Raw Draft Content:
"""
${draftText}
"""`;

    const { data, successfulModel } = await generateAIJsonBase({
      provider,
      kind: "refineIssues",
      model,
      systemInstruction,
      userPrompt,
      temperature: 0.2,
    });

    if (data.issues && Array.isArray(data.issues)) {
      data.issues = data.issues.map((issue: any) => ({
        ...issue,
        summary: sanitizeJiraText(issue.summary),
        description: sanitizeJiraText(issue.description),
      }));
    }

    data.refinedByModel = successfulModel;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("AI Refine Error:", err);
    return NextResponse.json(
      { error: `Refinement failed: ${err.message}` },
      { status: 500 }
    );
  }
}
