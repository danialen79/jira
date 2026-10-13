import { sanitizeJiraText } from "@/lib/jira";
import {
  heuristicSplitSubtasks,
  newDraftRow,
  SUBTASK_BULK_MAX_ITEMS,
  type SubtaskDraftRow,
} from "@/lib/subtask-bulk-heuristic";

export {
  heuristicSplitSubtasks,
  newDraftRow,
  SUBTASK_BULK_MAX_ITEMS,
  type SubtaskDraftRow,
};

export function buildSubtaskBulkSystemInstruction(): string {
  return `You are an agile QA / bug triage assistant.
The user dumps many small defects in free text (Persian, English, bullets, numbered lists, or paragraphs).
Your job is to split and clean them into separate Jira Sub-task items under ONE fixed parent issue.

Rules:
1. One sub-task = one distinct, trackable defect or small fix — not every sentence, not every repro step.
2. Merge duplicate or overlapping mentions of the same bug into one item.
3. Split when the text clearly describes independent bugs (different screen, component, or failure mode).
4. summary: short action-oriented title in fluent Persian; keep technical terms in English (API, Safari, iOS, UI).
5. NEVER put "Sub-task", "Subtask", "ساب‌تسک", or "ساب تسک" in the summary.
6. description: 1–3 plain-text lines only — environment/page if known + actual vs expected briefly. No markdown, no Jira wiki (no h3., *, _, [ ]).
7. suggestedAssignee: Jira username only if clearly implied in text or obvious from team hints; otherwise omit or empty string.
8. duplicateOfExistingKey: if an item clearly matches an existing sub-task summary/key from the list provided, set that key; otherwise omit.
9. Do not invent bugs not mentioned in the dump.
10. Return between 1 and ${SUBTASK_BULK_MAX_ITEMS} items. If the dump is empty noise, return one item asking for clarification in summary (only as last resort).

Output JSON only.`;
}

export type SubtaskPlanItem = {
  summary?: string;
  description?: string;
  suggestedAssignee?: string;
  duplicateOfExistingKey?: string;
};

export function normalizePlanItems(
  items: SubtaskPlanItem[],
  defaultAssignee: string
): SubtaskDraftRow[] {
  const out: SubtaskDraftRow[] = [];
  for (const item of items) {
    const summary = sanitizeJiraText(String(item.summary || "").trim());
    if (!summary) continue;
    const description = sanitizeJiraText(String(item.description || "").trim());
    const assignee = String(item.suggestedAssignee || defaultAssignee || "").trim();
    const duplicateOfExistingKey = String(
      item.duplicateOfExistingKey || ""
    ).trim();
    out.push(
      newDraftRow({
        summary: summary.slice(0, 255),
        description: description.slice(0, 2000),
        assignee,
        duplicateOfExistingKey: duplicateOfExistingKey || undefined,
      })
    );
    if (out.length >= SUBTASK_BULK_MAX_ITEMS) break;
  }
  return out;
}
