"use client";

import { useState } from "react";
import { toast } from "sonner";
import JalaliDateInput from "@/components/JalaliDateInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Language } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  onCreated: () => void;
};

const copy = {
  en: {
    title: "New sprint",
    name: "Name",
    goal: "Goal",
    start: "Start date",
    end: "End date",
    create: "Create",
    creating: "Creating…",
    cancel: "Cancel",
    ok: "Sprint created.",
    fail: "Could not create sprint.",
  },
  fa: {
    title: "اسپرینت جدید",
    name: "نام",
    goal: "هدف",
    start: "تاریخ شروع",
    end: "تاریخ پایان",
    create: "ایجاد",
    creating: "در حال ایجاد…",
    cancel: "انصراف",
    ok: "اسپرینت ساخته شد.",
    fail: "ساخت اسپرینت ناموفق بود.",
  },
} as const;

/** YYYY-MM-DD → ISO for Jira Agile sprint dates. */
function isoDayToJiraDate(isoDay: string, endOfDay: boolean): string {
  const suffix = endOfDay ? "T23:59:59.000Z" : "T00:00:00.000Z";
  return `${isoDay}${suffix}`;
}

export default function CreateSprintDialog({
  open,
  onOpenChange,
  language,
  onCreated,
}: Props) {
  const t = copy[language];
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jira/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          goal: goal.trim() || undefined,
          startDate: startDate
            ? isoDayToJiraDate(startDate, false)
            : undefined,
          endDate: endDate ? isoDayToJiraDate(endDate, true) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.fail);
      toast.success(t.ok);
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      onOpenChange(false);
      onCreated();
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
        </DialogHeader>
        <FieldGroup className="flex flex-col gap-3">
          <Field>
            <FieldLabel>{t.name}</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>{t.goal}</FieldLabel>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sprint-start">{t.start}</FieldLabel>
              <JalaliDateInput
                id="sprint-start"
                language={language}
                value={startDate}
                onChange={setStartDate}
                disabled={saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sprint-end">{t.end}</FieldLabel>
              <JalaliDateInput
                id="sprint-end"
                language={language}
                value={endDate}
                onChange={setEndDate}
                disabled={saving}
              />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={saving || !name.trim()}
          >
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {saving ? t.creating : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
