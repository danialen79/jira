"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { PeekIssue } from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
  edit: "ویرایش نام",
  save: "ذخیره",
  cancel: "لغو",
  ok: "نام به‌روز شد.",
  failed: "ذخیره نام نشد.",
  empty: "نام خالی نباشد.",
} as const;

type Props = {
  issue: PeekIssue;
  className?: string;
};

export function IssuePeekSummary({ issue, className }: Props) {
  const { patchIssue } = useIssuePeek();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(issue.summary);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(issue.summary);
  }, [issue.summary, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const cancel = () => {
    setDraft(issue.summary);
    setEditing(false);
  };

  const save = async () => {
    const next = draft.trim();
    if (!next) {
      toast.error(t.empty);
      return;
    }
    if (next === issue.summary.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jira/issues/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: issue.key,
          summary: next,
          issuetype: issue.issuetype,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || t.failed);
      }
      const saved = String(data.summary || next);
      patchIssue({ summary: saved });
      setDraft(saved);
      setEditing(false);
      toast.success(t.ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={cn("flex min-w-0 items-start gap-1", className)} dir="rtl">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          aria-label={t.edit}
          className="h-8 min-w-0 flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.save}
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Spinner /> : <CheckIcon />}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.cancel}
          disabled={saving}
          onClick={cancel}
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-start gap-1", className)} dir="rtl">
      <h2 className="min-w-0 flex-1 text-sm font-medium leading-snug text-pretty">
        {issue.summary}
      </h2>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="mt-0.5 shrink-0 text-muted-foreground"
        aria-label={t.edit}
        onClick={() => setEditing(true)}
      >
        <PencilIcon />
      </Button>
    </div>
  );
}
