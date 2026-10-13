export const STORY_BULK_MAX_ITEMS = 30;

export type StoryDraftRow = {
  id: string;
  summary: string;
  description: string;
  assignee: string;
  lens: string;
  duplicateOfExistingKey?: string;
};

const LINE_PREFIX = /^[-*•]\s*(\[[\sxX]\]\s*)?|^(\d+[.)])\s+/;

export function stubStoryDescription(summary: string): string {
  return `داستان کاربر:
به عنوان کاربر
می‌خواهم ${summary}
تا اینکه ارزش مورد نظر محقق شود

معیارهای پذیرش:
- با فرض دسترسی کاربر، وقتی قابلیت را استفاده می‌کند، آنگاه نتیجه مورد انتظار دیده می‌شود
- با فرض خطای ورودی، وقتی کاربر اقدام می‌کند، آنگاه پیام خطای واضح نشان داده می‌شود`;
}

export function newStoryDraftRow(
  partial?: Partial<StoryDraftRow>
): StoryDraftRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    summary: "",
    description: "",
    assignee: "",
    lens: "",
    ...partial,
  };
}

/** Instant preview: one non-empty line → one draft story. */
export function heuristicSplitStories(
  raw: string,
  defaults?: { assignee?: string; lens?: string }
): StoryDraftRow[] {
  const lines = raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, STORY_BULK_MAX_ITEMS).map((line, i) => {
    const cleaned = line.replace(LINE_PREFIX, "").trim().slice(0, 255);
    return newStoryDraftRow({
      id: `h-${i}`,
      summary: cleaned,
      description: stubStoryDescription(cleaned),
      assignee: defaults?.assignee || "",
      lens: defaults?.lens || "",
    });
  });
}
