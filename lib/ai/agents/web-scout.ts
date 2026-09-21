import { ToolLoopAgent, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import { createAgentTools } from "@/lib/ai/tools";
import { loadWebScoutSkill } from "@/lib/ai/agents/skill-loader";
import { getSdkGenerationOptions } from "@/lib/ai/sdk-model";

export function createWebScout(opts: {
  model: LanguageModel;
  provider?: string;
}) {
  const base = createAgentTools({ provider: opts.provider });
  const generation = getSdkGenerationOptions();

  return new ToolLoopAgent({
    id: "web-scout",
    model: opts.model,
    instructions: `${loadWebScoutSkill()}

IMPORTANT: When finished, respond with ONLY a JSON ResearchBrief object (summary + cards). No markdown fence required.`,
    tools: {
      webSearch: base.webSearch,
    },
    stopWhen: stepCountIs(5),
    ...generation,
  });
}
