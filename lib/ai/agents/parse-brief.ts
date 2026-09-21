import {
  briefToModelText,
  emptyBrief,
  researchBriefSchema,
  type ResearchBrief,
} from "@/lib/ai/evidence";

/** Best-effort parse of subagent final text into ResearchBrief. */
export function parseResearchBrief(text: string, fallbackSummary: string): ResearchBrief {
  const trimmed = text?.trim() || "";
  if (!trimmed) return emptyBrief(fallbackSummary);

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1]?.trim() || trimmed;

  try {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const json = JSON.parse(candidate.slice(start, end + 1));
      const parsed = researchBriefSchema.safeParse(json);
      if (parsed.success) return parsed.data;
    }
  } catch {
    /* fall through */
  }

  return {
    summary: trimmed.slice(0, 1200) || fallbackSummary,
    cards: [],
  };
}

export function packBriefForTool(brief: ResearchBrief): {
  brief: ResearchBrief;
  modelText: string;
} {
  return { brief, modelText: briefToModelText(brief) };
}
