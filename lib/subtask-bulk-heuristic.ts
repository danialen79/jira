export const SUBTASK_BULK_MAX_ITEMS = 30;

export type SubtaskDraftRow = {
  id: string;
  summary: string;
  description: string;
  assignee: string;
  duplicateOfExistingKey?: string;
};

const LINE_PREFIX = /^[-*•]\s*(\[[\sxX]\]\s*)?|^(\d+[.)])\s+/;

export function newDraftRow(partial?: Partial<SubtaskDraftRow>): SubtaskDraftRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    summary: "",
    description: "",
    assignee: "",
    ...partial,
  };
}

/** Instant preview: one non-empty line → one draft row. */
export function heuristicSplitSubtasks(raw: string): SubtaskDraftRow[] {
  const lines = raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, SUBTASK_BULK_MAX_ITEMS).map((line, i) => {
    const cleaned = line.replace(LINE_PREFIX, "").trim();
    return newDraftRow({
      id: `h-${i}`,
      summary: cleaned.slice(0, 255),
      description: "",
      assignee: "",
    });
  });
}
