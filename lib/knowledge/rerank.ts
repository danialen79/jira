import { generateText, Output } from "ai";
import { z } from "zod";
import {
  getSdkAgentRoleModel,
  getSdkGenerationOptions,
} from "@/lib/ai/sdk-model";

const orderSchema = z.object({
  order: z.array(z.number().int().nonnegative()),
});

export async function rerankByRelevance<T extends { title: string; text: string }>(
  query: string,
  items: T[],
  k: number,
  provider?: string
): Promise<T[]> {
  if (k <= 0) return [];
  if (items.length <= 1) return items.slice(0, k);

  try {
    const { model } = getSdkAgentRoleModel("subagent", provider);
    const generation = getSdkGenerationOptions();
    const passages = items
      .map(
        (item, index) =>
          `[${index}] ${item.title}\n${item.text.slice(0, 700)}`
      )
      .join("\n\n");
    const result = await generateText({
      model,
      output: Output.object({ schema: orderSchema }),
      ...generation,
      temperature: 0,
      system:
        "Rank passages by relevance to the query. Return JSON order: passage indexes, best first. Include only indexes that exist. No prose.",
      prompt: `Query:\n${query}\n\nPassages:\n${passages}`,
    });
    const seen = new Set<number>();
    const picked: T[] = [];
    for (const index of result.output?.order || []) {
      if (!Number.isInteger(index) || index < 0 || index >= items.length) continue;
      if (seen.has(index)) continue;
      seen.add(index);
      picked.push(items[index]!);
    }
    if (!picked.length) return items.slice(0, k);
    for (let i = 0; i < items.length; i++) {
      if (!seen.has(i)) picked.push(items[i]!);
    }
    return picked.slice(0, k);
  } catch (err) {
    console.error("knowledge rerank failed", err);
    return items.slice(0, k);
  }
}
