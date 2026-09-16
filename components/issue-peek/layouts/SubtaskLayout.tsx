"use client";

import { IssuePeekDescription } from "@/components/issue-peek/IssuePeekDescription";
import type { PeekIssue } from "@/lib/issue-peek";

const t = {
  description: "توضیحات",
} as const;

type Props = { issue: PeekIssue };

export function SubtaskLayout({ issue }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <IssuePeekDescription issue={issue} label={t.description} />
    </div>
  );
}
