"use client";

import { useState } from "react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { Button } from "@/components/ui/button";
import type { PeekIssue } from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
  description: "توضیحات",
  empty: "توضیحی نیست.",
  more: "بیشتر",
  less: "کمتر",
} as const;

type Props = {
  issue: PeekIssue;
  label?: string;
  className?: string;
};

export function IssuePeekDescription({ issue, label, className }: Props) {
  const [expanded, setExpanded] = useState(false);
  const title = label || t.description;
  const hasDesc = Boolean(issue.description?.trim());

  return (
    <div className={cn("flex flex-col gap-1.5", className)} dir="rtl">
      <p className="text-xs font-medium">{title}</p>

      {hasDesc ? (
        <>
          <div
            className={cn(
              "rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs",
              !expanded && "line-clamp-8 overflow-hidden"
            )}
          >
            <MarkdownPreview text={issue.description} />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 self-start px-1.5 text-xs text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t.less : t.more}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t.empty}</p>
      )}
    </div>
  );
}
