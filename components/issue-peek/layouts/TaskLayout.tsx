"use client";

import { IssuePeekDescription } from "@/components/issue-peek/IssuePeekDescription";
import { IssuePeekSubtaskList } from "@/components/issue-peek/IssuePeekSubtaskList";
import type { PeekIssue } from "@/lib/issue-peek";

const t = {
  description: "توضیحات",
} as const;

type Props = { issue: PeekIssue };

export function TaskLayout({ issue }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <IssuePeekDescription issue={issue} label={t.description} />
      <IssuePeekSubtaskList parentKey={issue.key} />
    </div>
  );
}
