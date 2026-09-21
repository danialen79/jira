import { tool, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import {
  askUserInputSchema,
  coverageSchema,
  proposedIssueSchema,
  sanitizeProposedIssues,
} from "@/lib/ai/tools";
import { createDelegateTools } from "@/lib/ai/agents/delegate-tools";
import {
  loadCoverageGates,
  loadOrchestratorSkill,
  loadStoryDescriptionProtocol,
} from "@/lib/ai/agents/skill-loader";
import { ISSUE_DESCRIPTION_FORMAT_RULES } from "@/lib/ai/issue-description-format";
import { getSdkGenerationOptions } from "@/lib/ai/sdk-model";
import {
  formatForcedDelegatesPrompt,
  type ForcedDelegate,
} from "@/lib/ai/agents/workshop-agents";
import { z } from "zod";

export type InterviewOrchestratorContext = {
  draftText: string;
  coverageSummary: string;
  knowledgeContext: string;
  outputModeHint: string;
  forceWrite: boolean;
  forcedDelegates?: ForcedDelegate[];
};

export function buildInterviewSystemPrompt(
  ctx: InterviewOrchestratorContext
): string {
  const forcedBlock = formatForcedDelegatesPrompt(ctx.forcedDelegates || []);
  return `${loadOrchestratorSkill()}

${loadCoverageGates()}

${loadStoryDescriptionProtocol()}

${ISSUE_DESCRIPTION_FORMAT_RULES}

Initial draft:
"""
${ctx.draftText || "(empty)"}
"""

Current coverage: ${ctx.coverageSummary}

Seed knowledge (light RAG — deepen via consultKnowledge / consultBrief):
${ctx.knowledgeContext || "(none)"}

Output mode for proposeStories: ${ctx.outputModeHint}
${ctx.forceWrite ? "User forced write now — proposeStories after a quick similar Jira check if possible." : ""}
${forcedBlock}

First turn after a new draft: prefer consultBrief before askUser (ghost coverage).
Prefer EvidenceCard suggestedQuestion when asking askUser.
Before proposeStories: consultJira intent=similar; note collide in notes.
When proposing: every Story/Bug description must include verifiable معیارهای پذیرش (or bug repro sections); coverage.acceptance alone is not enough.`;
}

export function createInterviewOrchestratorTools(opts: {
  /** Model for subagents (knowledge / jira / web). */
  subagentModel: LanguageModel;
  provider?: string;
}) {
  const delegates = createDelegateTools({
    model: opts.subagentModel,
    provider: opts.provider,
  });
  const generation = getSdkGenerationOptions();

  const tools = {
    ...delegates,

    updateCoverage: tool({
      description:
        "Update which interview coverage dimensions are understood after user answers.",
      inputSchema: z.object({
        coverage: coverageSchema,
      }),
      execute: async ({ coverage }) => ({ coverage }),
    }),

    proposeStories: tool({
      description:
        "Propose final Jira epics/stories/bugs when ready. Call consultJira intent=similar first. Every issue needs unique id; Stories/Bugs need epicReference. Each description MUST use the Scrum plain-Persian structure (داستان کاربر / معیارهای پذیرش for Story; مراحل بازتولید for Bug; هدف کلی for Epic) — no markdown or Jira wiki.",
      inputSchema: z.object({
        issues: z.array(proposedIssueSchema).min(1),
        coverage: coverageSchema,
        notes: z
          .string()
          .optional()
          .describe("Include duplicate gate: reuse/extend/net-new notes"),
      }),
      execute: async ({ issues, coverage, notes }) => {
        return {
          issues: sanitizeProposedIssues(issues),
          coverage,
          notes: notes || "",
        };
      },
    }),

    // No execute — client HITL
    askUser: tool({
      description:
        "Ask clarifying questions as an interactive questionnaire. Prefer EvidenceCard suggestedQuestion when available. 1–3 questions, concrete choices.",
      inputSchema: askUserInputSchema,
    }),
  };

  return { tools, generation, stopWhen: stepCountIs(12) };
}
