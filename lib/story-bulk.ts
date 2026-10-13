import { ISSUE_DESCRIPTION_FORMAT_RULES } from "@/lib/ai/issue-description-format";
import { sanitizeJiraText } from "@/lib/jira";
import { isStoryLens } from "@/lib/lens";
import {
  heuristicSplitStories,
  newStoryDraftRow,
  STORY_BULK_MAX_ITEMS,
  stubStoryDescription,
  type StoryDraftRow,
} from "@/lib/story-bulk-heuristic";

export {
  heuristicSplitStories,
  newStoryDraftRow,
  STORY_BULK_MAX_ITEMS,
  stubStoryDescription,
  type StoryDraftRow,
};

export function buildStoryBulkSystemInstruction(): string {
  return `You are an agile Product Owner assistant.
The user dumps feature ideas, notes, or bullets under ONE fixed Epic.
Split and clean them into separate Jira Story items linked to that Epic.

Rules:
1. One Story = one user outcome / capability. Split independent outcomes; merge duplicates.
2. summary: short imperative title in fluent Persian; keep technical terms in English.
3. NEVER put "Story", "استوری", or epic key prefixes in the summary.
4. description MUST follow the Story section of these rules exactly (plain Persian, no markdown/wiki):
${ISSUE_DESCRIPTION_FORMAT_RULES}
5. Every Story description MUST include «داستان کاربر:» and «معیارهای پذیرش:» with 2–8 «- » bullets (happy path + at least one error/boundary).
6. selectedLens: one of strategy | vision | customer | business when clearly implied; otherwise leave empty so the UI default applies.
7. suggestedAssignee: Jira username only if clearly implied; else empty.
8. duplicateOfExistingKey: set if this matches an existing child story under the epic; else omit.
9. Do not invent scope not present in the dump.
10. Return between 1 and ${STORY_BULK_MAX_ITEMS} items.

Output JSON only.`;
}

export type StoryPlanItem = {
  summary?: string;
  description?: string;
  suggestedAssignee?: string;
  selectedLens?: string;
  duplicateOfExistingKey?: string;
};

export function normalizeStoryPlanItems(
  items: StoryPlanItem[],
  defaults: { assignee?: string; lens?: string }
): StoryDraftRow[] {
  const out: StoryDraftRow[] = [];
  for (const item of items) {
    const summary = sanitizeJiraText(String(item.summary || "").trim());
    if (!summary) continue;
    let description = sanitizeJiraText(String(item.description || "").trim());
    if (
      !description.includes("داستان کاربر:") ||
      !description.includes("معیارهای پذیرش:")
    ) {
      description = stubStoryDescription(summary);
    }
    const lensRaw = String(item.selectedLens || defaults.lens || "").trim();
    const lens = isStoryLens(lensRaw) ? lensRaw : defaults.lens || "";
    const assignee = String(
      item.suggestedAssignee || defaults.assignee || ""
    ).trim();
    const duplicateOfExistingKey = String(
      item.duplicateOfExistingKey || ""
    ).trim();
    out.push(
      newStoryDraftRow({
        summary: summary.slice(0, 255),
        description: description.slice(0, 8000),
        assignee,
        lens,
        duplicateOfExistingKey: duplicateOfExistingKey || undefined,
      })
    );
    if (out.length >= STORY_BULK_MAX_ITEMS) break;
  }
  return out;
}

export function parentComponentName(issue: {
  component?: string;
  components?: string[];
}): string {
  const fromList = issue.components?.find((c) => String(c || "").trim());
  return String(fromList || issue.component || "").trim();
}
