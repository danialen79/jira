"use client";

import { CalendarDaysIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IssueMetaItem } from "@/components/issue-card/IssueMetaLine";
import { formatDueRemaining, type DueTone } from "@/lib/due-date";
import { cn } from "@/lib/utils";

function badgeVariant(
  tone: DueTone
): "destructive" | "secondary" | "outline" | null {
  if (tone === "overdue") return "destructive";
  if (tone === "soon" || tone === "today") return "secondary";
  return null;
}

type DueSource = {
  dueDate?: string | null;
  statusCategoryKey?: string;
};

/** Meta item for IssueCardFooter when due is set and issue is not done. */
export function dueDateMetaItem(issue: DueSource): IssueMetaItem | null {
  if (!issue.dueDate) return null;
  const remaining = formatDueRemaining(issue.dueDate, {
    statusCategoryKey: issue.statusCategoryKey,
  });
  if (!remaining) return null;

  const variant = badgeVariant(remaining.tone);
  const label = variant ? (
    <Badge
      variant={variant}
      className={cn("font-normal tabular-nums", "px-1.5 py-0 text-[11px]")}
    >
      {remaining.label}
    </Badge>
  ) : (
    <span className="tabular-nums">{remaining.label}</span>
  );

  return {
    key: "due",
    icon: CalendarDaysIcon,
    label,
  };
}

export function appendDueDateMeta(
  meta: IssueMetaItem[],
  issue: DueSource
): IssueMetaItem[] {
  const due = dueDateMetaItem(issue);
  return due ? [...meta, due] : meta;
}
