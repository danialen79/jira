"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  EPIC_LENS_OPTIONS,
  isIssueLens,
  lensDisplayLabel,
  type IssueLens,
} from "@/lib/lens";
import type { BulkActionId } from "@/lib/issue-ops/types";
import { selectableFixVersions } from "@/lib/fix-version-policy";
import type { JiraUser, JiraVersion } from "@/lib/types";

const t = {
    selected: "انتخاب‌شده",
    clear: "پاک کردن",
    setLens: "تنظیم لنز",
    setAssignee: "اساین",
    setVersion: "تنظیم ورژن",
    setStatus: "تغییر وضعیت",
    confirmTitle: "روی انتخاب‌شده‌ها اعمال شود؟",
    confirmDesc: "ایشوهای انتخاب‌شده در جیرا به‌روز می‌شوند.",
    apply: "اعمال",
    cancel: "انصراف",
    applying: "در حال اعمال…",
    pickLens: "لنز",
    pickAssignee: "مسئول",
    pickVersion: "Fix Version",
    pickStatus: "وضعیت",
    unassign: "برداشتن مسئول",
    none: "هیچ",
    done: "به‌روز شد",
    skipped: "رد شد",
    failed: "به‌روزرسانی گروهی ناموفق بود.",
  } as const;

type PendingAction = {
  action: BulkActionId;
  params: Record<string, unknown>;
};

type Props = {
  count: number;
  selectedKeys: string[];
  users: JiraUser[];
  versions: JiraVersion[];
  statusOptions: string[];
  onClear: () => void;
  onDone: () => void;
};

export default function BulkActionBar({  count,
  selectedKeys,
  users,
  versions,
  statusOptions,
  onClear,
  onDone,
}: Props) {
  const [lens, setLens] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [versionId, setVersionId] = useState<string>("");
  const [statusName, setStatusName] = useState<string>("");
  const [transitionStatuses, setTransitionStatuses] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const versionOptions = useMemo(
    () =>
      selectableFixVersions(versions).map((v) => ({
        value: v.id,
        label: v.name,
      })),
    [versions]
  );

  useEffect(() => {
    const key = selectedKeys[0];
    if (!key) {
      setTransitionStatuses([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/jira/issues/transitions?issueKey=${encodeURIComponent(key)}`
        );
        const data = await res.json();
        if (cancelled || !res.ok || !data.success) return;
        setTransitionStatuses(data.statuses || []);
      } catch {
        if (!cancelled) setTransitionStatuses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKeys]);

  const statusSelectOptions = useMemo(() => {
    const set = new Set<string>([...statusOptions, ...transitionStatuses]);
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((s) => ({ value: s, label: s }));
  }, [statusOptions, transitionStatuses]);

  if (count === 0) return null;

  const openConfirm = (action: BulkActionId, params: Record<string, unknown>) => {
    if (action === "setLens" && !isIssueLens(params.lens)) {
      toast.error("لنز را انتخاب کنید.");
      return;
    }
    if (action === "setFixVersion" && !String(params.fixVersionId || "").trim()) {
      toast.error("ورژن را انتخاب کنید.");
      return;
    }
    if (action === "setStatus" && !String(params.statusName || "").trim()) {
      toast.error("وضعیت را انتخاب کنید.");
      return;
    }
    setPending({ action, params });
  };

  const runBulk = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/jira/issues/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pending.action,
          issueKeys: selectedKeys,
          params: pending.params,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t.failed);
        return;
      }
      const skipped = (data.results || []).filter(
        (r: { skipped?: boolean }) => r.skipped
      ).length;
      const failed = (data.results || []).filter(
        (r: { success: boolean; skipped?: boolean }) =>
          !r.success && !r.skipped
      ).length;
      toast.success(
        `${t.done} ${data.updatedCount}/${selectedKeys.length}` +
          (skipped ? ` · ${skipped} ${t.skipped}` : "") +
          (failed ? ` · ${failed} failed` : "")
      );
      setPending(null);
      onClear();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed bottom-3 left-1/2 z-40 flex w-[min(64rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80"
        dir="rtl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium tabular-nums">
            {count} {t.selected}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {t.clear}
          </Button>
        </div>

        <FieldGroup className="gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel>{t.pickLens}</FieldLabel>
            <div className="flex gap-2">
              <SearchableSelect
                className="min-w-0 flex-1"
                options={EPIC_LENS_OPTIONS.map((o) => ({
                  value: o.value,
                  label: lensDisplayLabel(o.value),
                }))}
                value={lens}
                onChange={setLens}
                placeholder={t.pickLens}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  openConfirm("setLens", { lens: lens as IssueLens })
                }
              >
                {t.setLens}
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel>{t.pickAssignee}</FieldLabel>
            <div className="flex gap-2">
              <SearchableSelect
                className="min-w-0 flex-1"
                options={[
                  { value: "", label: t.unassign },
                  ...users.map((u) => ({
                    value: u.name,
                    label: u.displayName,
                    sublabel: u.name,
                  })),
                ]}
                value={assignee}
                onChange={setAssignee}
                placeholder={t.pickAssignee}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  openConfirm("setAssignee", {
                    assignee: assignee || null,
                  })
                }
              >
                {t.setAssignee}
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel>{t.pickVersion}</FieldLabel>
            <div className="flex gap-2">
              <SearchableSelect
                className="min-w-0 flex-1"
                options={versionOptions}
                value={versionId}
                onChange={setVersionId}
                placeholder={t.pickVersion}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  openConfirm("setFixVersion", {
                    fixVersionId: versionId,
                  })
                }
              >
                {t.setVersion}
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel>{t.pickStatus}</FieldLabel>
            <div className="flex gap-2">
              <SearchableSelect
                className="min-w-0 flex-1"
                options={statusSelectOptions}
                value={statusName}
                onChange={setStatusName}
                placeholder={t.pickStatus}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  openConfirm("setStatus", { statusName })
                }
              >
                {t.setStatus}
              </Button>
            </div>
          </Field>
        </FieldGroup>
      </div>

      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !submitting) setPending(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmDesc} ({count})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void runBulk();
              }}
            >
              {submitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {t.applying}
                </>
              ) : (
                t.apply
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
