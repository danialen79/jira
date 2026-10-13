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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  peekComponentName,
  type PeekIssue,
} from "@/lib/issue-peek";
import {
  isStoryLens,
  LENS_OPTIONS,
  lensDisplayLabel,
  type StoryLens,
} from "@/lib/lens";
import {
  heuristicSplitStories,
  newStoryDraftRow,
  STORY_BULK_MAX_ITEMS,
  type StoryDraftRow,
} from "@/lib/story-bulk";
import { cn } from "@/lib/utils";

const t = {
  title: "استوری گروهی",
  dumpPh: "ایده‌ها را آزاد بنویس… بعد «تفکیک با AI».",
  defaultAssignee: "مسئول پیش‌فرض",
  defaultLens: "لنز پیش‌فرض",
  splitAi: "تفکیک با AI",
  splitting: "در حال تفکیک…",
  addRow: "ردیف",
  create: "ساخت",
  creating: "در حال ساخت…",
  cancel: "انصراف",
  summary: "عنوان",
  description: "توضیح",
  assignee: "مسئول",
  lens: "لنز",
  remove: "حذف",
  emptyPlan: "اول متن را بنویس یا تفکیک کن.",
  noValid: "حداقل یک عنوان لازم است.",
  needLens: "لنز پیش‌فرض یا لنز هر ردیف را انتخاب کن.",
  needComponent: "اپیک کامپوننت ندارد؛ در جیرا ست کن.",
  splitOk: "آماده بررسی.",
  splitFallback: "تفکیک AI نشد؛ خط‌به‌خط گذاشتیم.",
  createOk: "استوری‌ها ساخته شد.",
  createPartial: "بعضی ساخته نشد.",
  duplicateHint: "تکراری",
  component: "کامپوننت",
} as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: PeekIssue;
};

export function StoryBulkDialog({ open, onOpenChange, issue }: Props) {
  const { aiProvider, selectedModel } = useAiSettings();
  const { bumpEpicChildren } = useIssuePeek();
  const { jiraUsers, fetchJiraUsers, fetchingUsers } = useJiraApp();

  const component = peekComponentName(issue);

  const [rawText, setRawText] = useState("");
  const [defaultAssignee, setDefaultAssignee] = useState("");
  const [defaultLens, setDefaultLens] = useState<StoryLens | "">("");
  const [rows, setRows] = useState<StoryDraftRow[]>([]);
  const [splitting, setSplitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRawText("");
    setRows([]);
    setPlanDirty(false);
    setDefaultAssignee(issue.assignee || "");
    setDefaultLens(isStoryLens(issue.selectedLens) ? issue.selectedLens : "");
    void fetchJiraUsers();
  }, [open, issue.key, issue.assignee, issue.selectedLens, fetchJiraUsers]);

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

  const lensItems = useMemo(
    () =>
      LENS_OPTIONS.map((o) => ({
        value: o.value,
        label: lensDisplayLabel(o.value),
      })),
    []
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
      const res = await fetch("/api/jira/stories/plan-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epicKey: issue.key,
          rawText: text,
          defaultAssignee,
          defaultLens,
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
        setRows(
          heuristicSplitStories(text, {
            assignee: defaultAssignee,
            lens: defaultLens,
          })
        );
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
        heuristicSplitStories(text, {
          assignee: defaultAssignee,
          lens: defaultLens,
        })
      );
      setPlanDirty(true);
      toast.error(e instanceof Error ? e.message : t.splitFallback);
    } finally {
      setSplitting(false);
    }
  };

  const updateRow = (id: string, patch: Partial<StoryDraftRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => {
    if (rows.length >= STORY_BULK_MAX_ITEMS) return;
    setRows((prev) => [
      ...prev,
      newStoryDraftRow({
        assignee: defaultAssignee,
        lens: defaultLens,
      }),
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
    const unresolved = validRows.filter(
      (r) => !isStoryLens(r.lens || defaultLens)
    );
    if (unresolved.length > 0) {
      toast.error(t.needLens);
      return;
    }

    setCreating(true);
    let ok = 0;
    const remaining: StoryDraftRow[] = [];
    for (const row of validRows) {
      const lens = (isStoryLens(row.lens) ? row.lens : defaultLens) as StoryLens;
      try {
        const res = await fetch("/api/jira/create-issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issue: {
              summary: row.summary.trim(),
              description: row.description.trim() || row.summary.trim(),
              issuetype: "Story",
              epicKey: issue.key,
              selectedComponent: component,
              selectedAssignee: row.assignee || defaultAssignee || undefined,
              selectedLens: lens,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          remaining.push(row);
          if (data.error) {
            toast.error(data.error);
          }
        } else {
          ok += 1;
        }
      } catch {
        remaining.push(row);
      }
    }
    setCreating(false);
    if (ok > 0) bumpEpicChildren();
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
            <div className="min-w-[8rem] flex-1">
              <Select
                items={lensItems}
                value={defaultLens || null}
                onValueChange={(v) =>
                  setDefaultLens(isStoryLens(v) ? v : "")
                }
              >
                <SelectTrigger size="sm" aria-label={t.defaultLens}>
                  <SelectValue placeholder={t.defaultLens} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {lensItems.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
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
                  disabled={rows.length >= STORY_BULK_MAX_ITEMS}
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
                        <Textarea
                          value={row.description}
                          onChange={(e) =>
                            updateRow(row.id, { description: e.target.value })
                          }
                          placeholder={t.description}
                          aria-label={`${t.description} ${index + 1}`}
                          rows={4}
                          className="min-h-24 resize-y text-xs"
                          spellCheck
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <Select
                            items={lensItems}
                            value={row.lens || defaultLens || null}
                            onValueChange={(v) =>
                              updateRow(row.id, {
                                lens: isStoryLens(v) ? v : "",
                              })
                            }
                          >
                            <SelectTrigger
                              size="sm"
                              className="min-w-[7rem] flex-1"
                              aria-label={`${t.lens} ${index + 1}`}
                            >
                              <SelectValue placeholder={t.lens} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {lensItems.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <div className="min-w-[8rem] flex-1">
                            <SearchableSelect
                              options={userOptions}
                              value={row.assignee}
                              onChange={(v) =>
                                updateRow(row.id, { assignee: v })
                              }
                              placeholder={t.assignee}
                            />
                          </div>
                        </div>
                        {row.duplicateOfExistingKey ? (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">
                            {t.duplicateHint}:{" "}
                            <span translate="no">
                              {row.duplicateOfExistingKey}
                            </span>
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
