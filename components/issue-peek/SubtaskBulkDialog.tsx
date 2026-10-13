"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListPlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { peekComponentName, type PeekIssue } from "@/lib/issue-peek";
import {
  heuristicSplitSubtasks,
  newDraftRow,
  SUBTASK_BULK_MAX_ITEMS,
  type SubtaskDraftRow,
} from "@/lib/subtask-bulk";
import { cn } from "@/lib/utils";

const t = {
  title: "ساب‌تسک گروهی",
  desc: "باگ‌ها را آزاد بنویس؛ AI تفکیک می‌کند.",
  dumpPh: "هر خط یا پارagraph… بعد «تفکیک با AI».",
  defaultAssignee: "مسئول پیش‌فرض",
  splitAi: "تفکیک با AI",
  splitting: "در حال تفکیک…",
  addRow: "ردیف",
  create: "ساخت",
  creating: "در حال ساخت…",
  cancel: "انصراف",
  summary: "عنوان",
  description: "توضیح",
  assignee: "مسئول",
  remove: "حذف",
  emptyPlan: "اول متن را بنویس یا تفکیک کن.",
  noValid: "حداقل یک عنوان لازم است.",
  needComponent: "ایشو والد کامپوننت ندارد؛ در جیرا ست کن.",
  splitOk: "آماده بررسی.",
  splitFallback: "تفکیک AI نشد؛ خط‌به‌خط گذاشتیم.",
  createOk: "ساب‌تسک‌ها ساخته شد.",
  createPartial: "بعضی ساخته نشد.",
  duplicateHint: "تکراری",
  component: "کامپوننت",
} as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: PeekIssue;
};

export function SubtaskBulkDialog({ open, onOpenChange, issue }: Props) {
  const { aiProvider, selectedModel } = useAiSettings();
  const { bumpSubtasks } = useIssuePeek();
  const { jiraUsers, fetchJiraUsers, fetchingUsers } = useJiraApp();

  const [rawText, setRawText] = useState("");
  const [defaultAssignee, setDefaultAssignee] = useState("");
  const [rows, setRows] = useState<SubtaskDraftRow[]>([]);
  const [splitting, setSplitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const component = peekComponentName(issue);

  useEffect(() => {
    if (!open) return;
    setRawText("");
    setRows([]);
    setPlanDirty(false);
    setDefaultAssignee(issue.assignee || "");
    void fetchJiraUsers();
  }, [open, issue.key, issue.assignee, fetchJiraUsers]);

  const userOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...jiraUsers.map((u) => ({
        value: u.name,
        label: u.displayName || u.name,
        sublabel: u.name,
        avatar: u.avatarUrls?.["24x24"] || u.avatarUrls?.["16x16"],
      })),
    ],
    [jiraUsers]
  );

  const validRows = useMemo(
    () => rows.filter((r) => r.summary.trim()),
    [rows]
  );

  const closeGuard = useCallback(
    (next: boolean) => {
      if (!next && (rawText.trim() || validRows.length > 0) && !creating) {
        if (!window.confirm("متن یا پیش‌نمایش ذخیره نشده. ببندم؟")) return;
      }
      onOpenChange(next);
    },
    [rawText, validRows.length, creating, onOpenChange]
  );

  const runSplit = async () => {
    const text = rawText.trim();
    if (!text) {
      toast.error(t.emptyPlan);
      return;
    }
    setSplitting(true);
    try {
      const res = await fetch("/api/jira/subtasks/plan-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentKey: issue.key,
          rawText: text,
          defaultAssignee,
          provider: aiProvider,
          model: selectedModel,
          teamUsers: jiraUsers.map((u) => ({
            name: u.name,
            displayName: u.displayName,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.splitFallback);
      }
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        setRows(heuristicSplitSubtasks(text));
      } else {
        setRows(items);
      }
      setPlanDirty(true);
      if (data.usedAi === false) {
        toast.message(t.splitFallback);
      } else {
        toast.success(t.splitOk);
      }
    } catch (e) {
      setRows(
        heuristicSplitSubtasks(text).map((r) => ({
          ...r,
          assignee: r.assignee || defaultAssignee,
        }))
      );
      setPlanDirty(true);
      toast.error(e instanceof Error ? e.message : t.splitFallback);
    } finally {
      setSplitting(false);
    }
  };

  const updateRow = (id: string, patch: Partial<SubtaskDraftRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => {
    if (rows.length >= SUBTASK_BULK_MAX_ITEMS) return;
    setRows((prev) => [
      ...prev,
      newDraftRow({ assignee: defaultAssignee }),
    ]);
    setPlanDirty(true);
  };

  const createAll = async () => {
    if (validRows.length === 0) {
      toast.error(t.noValid);
      return;
    }
    if (!component) {
      toast.error(t.needComponent);
      return;
    }
    setCreating(true);
    let ok = 0;
    const remaining: SubtaskDraftRow[] = [];
    for (const row of validRows) {
      try {
        const res = await fetch("/api/jira/create-issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issue: {
              summary: row.summary.trim(),
              description: row.description.trim() || row.summary.trim(),
              issuetype: "Sub-task",
              parentKey: issue.key,
              selectedComponent: component,
              selectedAssignee: row.assignee || defaultAssignee || undefined,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          remaining.push(row);
          if (data.error) toast.error(data.error);
        } else {
          ok += 1;
        }
      } catch {
        remaining.push(row);
      }
    }
    setCreating(false);
    if (ok > 0) bumpSubtasks();
    if (ok > 0 && remaining.length === 0) {
      toast.success(`${ok} ${t.createOk}`);
      onOpenChange(false);
    } else if (ok > 0 && remaining.length > 0) {
      setRows(remaining);
      toast.warning(`${ok} ساخته شد؛ ${remaining.length} خطا.`);
    } else {
      toast.error(t.createPartial);
    }
  };

  const showGrid = planDirty || rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={closeGuard}>
      <DialogContent
        dir="rtl"
        className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden sm:max-w-xl"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ListPlusIcon className="size-4" aria-hidden />
            {t.title}
          </DialogTitle>
          <DialogDescription translate="no">
            {issue.key} — {issue.summary}
            {component ? ` · ${t.component}: ${component}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain py-3">
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={t.dumpPh}
            rows={showGrid ? 3 : 6}
            className="min-h-20 resize-y"
            spellCheck
            aria-label={t.dumpPh}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void runSplit();
              }
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={splitting || !rawText.trim()}
              onClick={() => void runSplit()}
            >
              {splitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SparklesIcon data-icon="inline-start" />
              )}
              {splitting ? t.splitting : t.splitAi}
            </Button>
            <div className="min-w-[10rem] flex-1">
              <SearchableSelect
                options={userOptions}
                value={defaultAssignee}
                onChange={setDefaultAssignee}
                disabled={fetchingUsers && userOptions.length <= 1}
                placeholder={t.defaultAssignee}
              />
            </div>
          </div>

          {showGrid ? (
            <div className="flex flex-col gap-2" aria-live="polite">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {validRows.length} ردیف
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={rows.length >= SUBTASK_BULK_MAX_ITEMS}
                  onClick={addRow}
                >
                  + {t.addRow}
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {rows.map((row, index) => (
                  <li
                    key={row.id}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-md border p-2",
                      row.duplicateOfExistingKey &&
                        "border-amber-500/40 bg-amber-500/5"
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <span className="pt-2 text-[10px] tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Input
                          value={row.summary}
                          onChange={(e) =>
                            updateRow(row.id, { summary: e.target.value })
                          }
                          placeholder={t.summary}
                          aria-label={`${t.summary} ${index + 1}`}
                          spellCheck
                        />
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            updateRow(row.id, { description: e.target.value })
                          }
                          placeholder={t.description}
                          aria-label={`${t.description} ${index + 1}`}
                          spellCheck
                        />
                        <SearchableSelect
                          options={userOptions}
                          value={row.assignee}
                          onChange={(v) => updateRow(row.id, { assignee: v })}
                          placeholder={t.assignee}
                        />
                        {row.duplicateOfExistingKey ? (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">
                            {t.duplicateHint}:{" "}
                            <span translate="no">{row.duplicateOfExistingKey}</span>
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t.remove}
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={creating}
            onClick={() => closeGuard(false)}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            disabled={creating || validRows.length === 0}
            onClick={() => void createAll()}
          >
            {creating ? <Spinner data-icon="inline-start" /> : null}
            {creating
              ? t.creating
              : `${t.create} ${validRows.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
