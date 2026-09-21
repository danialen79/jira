import { z } from "zod";

export const evidenceSourceSchema = z.object({
  kind: z.enum(["knowledge", "jira", "web"]),
  ref: z.string().describe("doc title, issue key, or URL"),
  snippet: z.string().describe("Short supporting excerpt"),
});

export const suggestedQuestionSchema = z.object({
  prompt: z.string(),
  choices: z.array(z.string()).min(2).max(6),
  coverageKey: z
    .enum([
      "goal",
      "user",
      "acceptance",
      "outOfScope",
      "dependencies",
      "risks",
    ])
    .optional(),
});

export const evidenceCardSchema = z.object({
  claim: z.string().describe("One Persian sentence stating the finding"),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(evidenceSourceSchema).min(1),
  suggestedQuestion: suggestedQuestionSchema.optional(),
  openGaps: z
    .array(z.string())
    .default([])
    .describe("What is still unknown"),
  collide: z
    .enum(["reuse", "extend", "net-new"])
    .optional()
    .describe("Duplicate gate hint when comparing to existing Jira work"),
});

export const researchBriefSchema = z.object({
  summary: z.string().describe("2–4 sentence Persian briefing for the orchestrator"),
  cards: z.array(evidenceCardSchema).max(8),
});

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type SuggestedQuestion = z.infer<typeof suggestedQuestionSchema>;
export type EvidenceCard = z.infer<typeof evidenceCardSchema>;
export type ResearchBrief = z.infer<typeof researchBriefSchema>;

export function emptyBrief(summary: string, error?: string): ResearchBrief {
  return {
    summary: error ? `${summary} (${error})` : summary,
    cards: [],
  };
}

/** Compact text the parent model should see (toModelOutput). */
export function briefToModelText(brief: ResearchBrief): string {
  const lines = [`خلاصه: ${brief.summary}`];
  for (const [i, c] of brief.cards.entries()) {
    const src = c.sources
      .map((s) => `${s.kind}:${s.ref}`)
      .join(", ");
    lines.push(
      `${i + 1}. [${c.confidence}] ${c.claim} — ${src}` +
        (c.collide ? ` {${c.collide}}` : "") +
        (c.openGaps.length ? ` | gaps: ${c.openGaps.join("; ")}` : "")
    );
    if (c.suggestedQuestion) {
      lines.push(
        `   Q: ${c.suggestedQuestion.prompt} | choices: ${c.suggestedQuestion.choices.join(" / ")}`
      );
    }
  }
  return lines.join("\n");
}
