import { generateText, Output } from "ai";
import { z } from "zod";
import {
  getSdkGenerationOptions,
  getSdkLanguageModel,
} from "@/lib/ai/sdk-model";

const extractSchema = z.object({
  skip: z
    .boolean()
    .describe("True if the source has no durable product knowledge"),
  title: z.string().describe("Short Persian title for the canonical note"),
  canonicalText: z
    .string()
    .describe(
      "Durable product facts only: decisions, users, constraints, glossary, acceptance. No dialog filler."
    ),
});

const mergeSchema = z.object({
  title: z.string(),
  canonicalText: z.string(),
  mergeIds: z
    .array(z.string())
    .describe("Source doc ids whose content is fully absorbed"),
  supersedeIds: z
    .array(z.string())
    .describe("Source doc ids replaced by a newer fact"),
  unresolvedConflicts: z
    .array(z.string())
    .describe("Short notes on contradictions that could not be resolved"),
});

export type ExtractedCanonical = z.infer<typeof extractSchema>;
export type MergedCanonical = z.infer<typeof mergeSchema>;

export async function extractCanonicalFromText(input: {
  title: string;
  text: string;
  provider?: string;
}): Promise<ExtractedCanonical> {
  const { model } = getSdkLanguageModel(input.provider);
  const generation = getSdkGenerationOptions();
  const clipped = input.text.slice(0, 12000);

  const result = await generateText({
    model,
    output: Output.object({ schema: extractSchema }),
    ...generation,
    temperature: 0.2,
    system: `You distill product knowledge for a RAG index.
Write canonicalText in Persian unless the source is English-only.
Keep only durable facts, decisions, constraints, users, glossary, and acceptance criteria.
Drop interview chit-chat, process notes, and one-off scheduling.
If nothing durable remains, set skip=true and leave canonicalText empty.`,
    prompt: `Title: ${input.title}\n\nSource:\n${clipped}`,
  });

  return result.output;
}

export async function mergeCanonicalCluster(input: {
  docs: Array<{ id: string; title: string; text: string; updatedAt: string }>;
  provider?: string;
}): Promise<MergedCanonical> {
  const { model } = getSdkLanguageModel(input.provider);
  const generation = getSdkGenerationOptions();
  const body = input.docs
    .map((d) => {
      const text = d.text.slice(0, 1800);
      return `### ${d.id}\nTitle: ${d.title}\nUpdated: ${d.updatedAt}\n${text}`;
    })
    .join("\n\n");

  const result = await generateText({
    model,
    output: Output.object({ schema: mergeSchema }),
    ...generation,
    temperature: 0.15,
    system: `You merge overlapping product-knowledge notes into one canonical page.
Prefer newer updatedAt when facts conflict, and list leftover conflicts.
Write canonicalText in Persian unless sources are English-only.
mergeIds = notes fully absorbed. supersedeIds = notes whose facts are replaced.
Never invent product facts.`,
    prompt: `Merge these notes into one canonical document:\n\n${body}`,
  });

  return result.output;
}
