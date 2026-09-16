"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { JiraSprint, SprintIssue } from "@/lib/types";
import { statusBucket } from "@/lib/sprint/map";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;  sprint: JiraSprint | null;
  issues: SprintIssue[];
  futureSprints: JiraSprint[];
  onCompleted: () => void;
};

const t = {
    title: "بستن اسپرینت",
    desc: (n: number) =>
      n === 0
        ? "ایشو بازی برای انتقال نیست."
        : `${n} ایشو باز — مقصد را انتخاب کنید، سپس ببندید.`,
    dest: "انتقال ایشوهای باز به",
    backlog: "بک‌لاگ",
    complete: "بستن اسپرینت",
    completing: "در حال بستن…",
    cancel: "انصراف",
    ok: "اسپرینت بسته شد.",
    fail: "بستن اسپرینت ناموفق بود.",
  } as const;

export default function CompleteSprintDialog({
  open,
  onOpenChange,  sprint,
  issues,
  futureSprints,
  onCompleted,
}: Props) {  const openIssues = useMemo(
    () => issues.filter((i) => statusBucket(i.statusCategoryKey) !== "done"),
    [issues]
  );
  const [dest, setDest] = useState("");
  const [saving, setSaving] = useState(false);

  const destOptions = [
    { value: "backlog", label: t.backlog },
    ...futureSprints
      .filter((s) => s.id !== sprint?.id)
      .map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const handleComplete = async () => {
    if (!sprint) return;
    setSaving(true);
    try {
      if (openIssues.length > 0) {
        const keys = openIssues.map((i) => i.key);
        if (dest === "backlog" || !dest) {
          const moveRes = await fetch(
            `/api/jira/sprints/${sprint.id}/move`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ issues: keys, target: "backlog" }),
            }
          );
          const moveData = await moveRes.json();
          if (!moveRes.ok) throw new Error(moveData.error || t.fail);
        } else {
          const moveRes = await fetch(`/api/jira/sprints/${dest}/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issues: keys }),
          });
          const moveData = await moveRes.json();
          if (!moveRes.ok) throw new Error(moveData.error || t.fail);
        }
      }

      const res = await fetch(`/api/jira/sprints/${sprint.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "closed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.fail);
      toast.success(t.ok);
      onOpenChange(false);
      onCompleted();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.fail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.desc(openIssues.length)}</DialogDescription>
        </DialogHeader>
        {openIssues.length > 0 && (
          <Field>
            <FieldLabel>{t.dest}</FieldLabel>
            <SearchableSelect
              options={destOptions}
              value={dest || "backlog"}
              onChange={setDest}
              showSearch={false}
            />
          </Field>
        )}
        {openIssues.length > 0 && (
          <ul className="max-h-40 overflow-auto text-sm text-muted-foreground">
            {openIssues.slice(0, 20).map((i) => (
              <li key={i.key}>
                {i.key} — {i.summary}
              </li>
            ))}
            {openIssues.length > 20 && (
              <li>+{openIssues.length - 20}</li>
            )}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={() => void handleComplete()} disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {saving ? t.completing : t.complete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
