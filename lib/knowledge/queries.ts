import { generateText, Output } from "ai";
import { z } from "zod";
import {
  getSdkAgentRoleModel,
  getSdkGenerationOptions,
} from "@/lib/ai/sdk-model";
import { heuristicSearchQueries } from "@/lib/knowledge/query-heuristic";

const SHORT_QUERY_CHARS = 240;
const MAX_QUERIES = 4;

const querySchema = z.object({
  queries: z.array(z.string()).min(1).max(MAX_QUERIES),
});

function cleanQueries(queries: string[]): string[] {
  const out: string[] = [];
  for (const query of queries) {
    const text = query.trim().slice(0, 200);
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= MAX_QUERIES) break;
  }
  return out;
}

/** Short retrieval queries. Long drafts go through the cheap model, then a heuristic. */
export async function planKnowledgeQueries(input: {
  draft?: string;
  userText?: string;
  provider?: string;
}): Promise<string[]> {
  const fallback = heuristicSearchQueries(input);
  const combined = [input.draft, input.userText]
    .filter((part) => part?.trim())
    .join("\n")
    .trim();
  if (!combined || combined.length <= SHORT_QUERY_CHARS) return fallback;

  try {
    const { model } = getSdkAgentRoleModel("subagent", input.provider);
    const generation = getSdkGenerationOptions();
    const result = await generateText({
      model,
      output: Output.object({ schema: querySchema }),
      ...generation,
      temperature: 0.2,
      system: `You write retrieval queries for a product knowledge base.
Return 2 to 4 short queries. Write Persian; keep technical terms in English (API, OAuth, component names).
Each query is one focused phrase, not a paragraph and not the whole draft.`,
      prompt: combined.slice(0, 4000),
    });
    const queries = cleanQueries(result.output?.queries || []);
    return queries.length ? queries : fallback;
  } catch (err) {
    console.error("planKnowledgeQueries failed", err);
    return fallback;
  }
}
