import { ToolLoopAgent, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import { createJiraScoutTools } from "@/lib/ai/jira-tools";
import { loadJiraScoutSkill } from "@/lib/ai/agents/skill-loader";
import { getSdkGenerationOptions } from "@/lib/ai/sdk-model";
import { tryGetJiraClient } from "@/lib/jira-search";

export function createJiraScout(opts: { model: LanguageModel }) {
  const tools = createJiraScoutTools();
  const generation = getSdkGenerationOptions();
  const gate = tryGetJiraClient();
  const projectHint = gate.ok
    ? `Current project key: ${gate.client.projectKey}. Always scope JQL with project = ${gate.client.projectKey} unless issue keys are given.`
    : `Jira is not configured: ${gate.error}. If tools fail, return an empty ResearchBrief with the error in summary.`;

  return new ToolLoopAgent({
    id: "jira-scout",
    model: opts.model,
    instructions: `${loadJiraScoutSkill()}

${projectHint}

IMPORTANT: When finished, respond with ONLY a JSON ResearchBrief object (summary + cards). No markdown fence required.`,
    tools,
    stopWhen: stepCountIs(5),
    ...generation,
  });
}
