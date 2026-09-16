"use client";

import { BugLayout } from "@/components/issue-peek/layouts/BugLayout";
import { EpicLayout } from "@/components/issue-peek/layouts/EpicLayout";
import { StoryLayout } from "@/components/issue-peek/layouts/StoryLayout";
import { SubtaskLayout } from "@/components/issue-peek/layouts/SubtaskLayout";
import { TaskLayout } from "@/components/issue-peek/layouts/TaskLayout";
import {
  isSubIssueType,
  normalizeIssueTypeName,
} from "@/lib/issue-type-badge";
import type { PeekIssue } from "@/lib/issue-peek";

type Props = { issue: PeekIssue };

export function IssuePeekBody({ issue }: Props) {
  const t = normalizeIssueTypeName(issue.issuetype);

  if (t === "epic") {
    return <EpicLayout epicKey={issue.key} />;
  }
  if (t === "bug") {
    return <BugLayout issue={issue} />;
  }
  if (isSubIssueType(issue.issuetype)) {
    return <SubtaskLayout issue={issue} />;
  }
  if (t === "task") {
    return <TaskLayout issue={issue} />;
  }
  return <StoryLayout issue={issue} />;
}
