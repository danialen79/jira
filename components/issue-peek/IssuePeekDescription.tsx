"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { IssuePeekRewriteDialog } from "@/components/issue-peek/IssuePeekRewriteDialog";
import { Button } from "@/components/ui/button";
import type { PeekIssue } from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
  description: "توضیحات",
  empty: "توضیحی نیست.",
  rewrite: "بازنویسی با AI",
} as const;

type Props = {
  issue: PeekIssue;
  label?: string;
  className?: string;
};

export function IssuePeekDescription({ issue, label, className }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const title = label || t.description;

  return (
    <>
      <div className={cn("flex flex-col gap-1.5", className)} dir="rtl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">{title}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
          >
            <SparklesIcon data-icon="inline-start" />
            {t.rewrite}
          </Button>
        </div>

        {issue.description ? (
          <div className="max-h-[min(28rem,55vh)] min-h-40 overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs">
            <MarkdownPreview text={issue.description} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t.empty}</p>
        )}
      </div>

      <IssuePeekRewriteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        issue={issue}
      />
    </>
  );
}
