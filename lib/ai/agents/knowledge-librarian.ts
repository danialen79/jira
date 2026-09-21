import { ToolLoopAgent, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import { createAgentTools } from "@/lib/ai/tools";
import { loadKnowledgeLibrarianSkill } from "@/lib/ai/agents/skill-loader";
import { getSdkGenerationOptions } from "@/lib/ai/sdk-model";

export function createKnowledgeLibrarian(opts: {
  model: LanguageModel;
  provider?: string;
}) {
  const base = createAgentTools({ provider: opts.provider });
  const generation = getSdkGenerationOptions();

  return new ToolLoopAgent({
    id: "knowledge-librarian",
    model: opts.model,
    instructions: `${loadKnowledgeLibrarianSkill()}

IMPORTANT: When finished, respond with ONLY a JSON ResearchBrief object (summary + cards). No markdown fence required.`,
    tools: {
      searchKnowledge: base.searchKnowledge,
      saveToKnowledge: base.saveToKnowledge,
    },
    stopWhen: stepCountIs(5),
    ...generation,
  });
}
