"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import type {
  JiraSprint,
  JiraUser,
  JiraVersion,
  Language,
  StoryLens,
  VersionIssue,
} from "@/lib/types";
import {
  isStoryLens,
  LENS_OPTIONS,
  lensDisplayLabel,
} from "@/lib/lens";
import {
  fixVersionValidationError,
  isEpicIssueType,
  issueOwnsFixVersion,
} from "@/lib/fix-version-policy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import SearchableSelect from "@/components/SearchableSelect";

type FormState = {
  summary: string;
  description: string;
  issuetype: string;
  selectedComponent: string;
  selectedAssignee: string;
  selectedPriority: string;
  selectedLens: StoryLens | "";
  selectedRelease: string;
  selectedSprint: string;
  epicKey: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: VersionIssue | null;
  /** Nested under epic in tree → never owns Fix Version in this UI. */
  nestedUnderEpic?: boolean;
  versions: JiraVersion[];
  language: Language;
  isRtl: boolean;
  onSaved?: () => void;
};

const copy = {
  en: {
    title: "Edit issue",
    loading: "Loading…",
    save: "Save changes",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Issue updated.",
    failed: "Could not update issue.",
    summary: "Summary",
    description: "Description",
    component: "Component",
    assignee: "Assignee",
    priority: "Priority",
    lens: "Lens",
    release: "Release (Fix Version)",
    sprint: "Sprint",
    epicLink: "Epic link",
    none: "None",
    releaseHint: "Epics and orphan stories own the release.",
    underEpicHint: "Linked to an epic — Fix Version is on the epic.",
  },
  fa: {
    title: "ویرایش ایشو",
    loading: "در حال بارگذاری…",
    save: "ذخیره تغییرات",
    saving: "در حال ذخیره…",
    cancel: "انصراف",
    saved: "ایشو به‌روز شد.",
    failed: "به‌روزرسانی ایشو نشد.",
    summary: "خلاصه",
    description: "توضیحات",
    component: "کامپوننت",
    assignee: "مسئول",
    priority: "اولویت",
    lens: "لنز",
    release: "ریلیز (Fix Version)",
    sprint: "اسپرینت",
    epicLink: "لینک اپیک",
    none: "هیچ",
    releaseHint: "ریلیز روی اپیک و استوری بدون اپیک است.",
    underEpicHint: "زیر اپیک است — Fix Version روی اپیک است.",
  },
} as const;

const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];

export default function RoadmapIssueEditDialog({
  open,
  onOpenChange,
  issue,
  nestedUnderEpic = false,
  versions,
  language,
  isRtl,
  onSaved,
}: Props) {
  const t = copy[language];
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [components, setComponents] = useState<string[]>([]);
  const [users, setUsers] = useState<JiraUser[]>([]);
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!open || !issue) {
      setForm(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [issueRes, compRes, userRes, sprintRes] = await Promise.all([
          fetch("/api/jira/fetch-issue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueKey: issue.key }),
          }),
          fetch("/api/jira/components"),
          fetch("/api/jira/users"),
          fetch("/api/jira/sprints"),
        ]);

        const issueData = await issueRes.json();
        if (cancelled) return;
        if (!issueRes.ok || !issueData.success) {
          setError(issueData.error || t.failed);
          setForm(null);
          return;
        }

        const loaded = issueData.issue;
        setForm({
          summary: loaded.summary || "",
          description: loaded.description || "",
          issuetype: loaded.issuetype || issue.issuetype,
          selectedComponent: loaded.component || "",
          selectedAssignee: loaded.assignee || "",
          selectedPriority: loaded.priority || "Medium",
          selectedLens: isStoryLens(loaded.selectedLens)
            ? loaded.selectedLens
            : "",
          selectedRelease: loaded.selectedRelease || "",
          selectedSprint: loaded.selectedSprint || "",
          epicKey: loaded.epicKey || issue.epicKey || "",
        });

        if (compRes.ok) {
          const d = await compRes.json();
          const list = (d.components || d || [])
            .map((c: { name?: string } | string) =>
              typeof c === "string" ? c : c.name
            )
            .filter(Boolean) as string[];
          setComponents(list);
        }
        if (userRes.ok) {
          const d = await userRes.json();
          setUsers(d.users || []);
        }
        if (sprintRes.ok) {
          const d = await sprintRes.json();
          setSprints(d.sprints || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t.failed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, issue, t.failed]);

  const isEpic = form ? isEpicIssueType(form.issuetype) : false;
  const hasEpicLink = nestedUnderEpic || Boolean(form?.epicKey?.trim());
  const showRelease = form
    ? issueOwnsFixVersion(form.issuetype, hasEpicLink)
    : false;

  const versionOptions = useMemo(
    () =>
      versions
        .filter((v) => !v.archived)
        .map((v) => ({
          value: v.id,
          label: v.name,
          sublabel: v.released
            ? language === "fa"
              ? "منتشرشده"
              : "released"
            : undefined,
        })),
    [versions, language]
  );

  const handleSave = async () => {
    if (!issue || !form) return;

    const fvError = showRelease
      ? fixVersionValidationError({
          issuetype: form.issuetype,
          hasEpicLink: false,
          selectedRelease: form.selectedRelease,
          language,
        })
      : null;
    if (fvError) {
      toast.error(fvError);
      return;
    }
    if (form.issuetype === "Story" && !isStoryLens(form.selectedLens)) {
      toast.error(
        language === "fa"
          ? "برای استوری لنز لازم است."
          : "Story requires a Lens."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/jira/update-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: issue.key,
          issue: {
            summary: form.summary,
            description: form.description,
            issuetype: form.issuetype,
            selectedComponent: form.selectedComponent || "",
            selectedAssignee: form.selectedAssignee || "",
            selectedPriority: form.selectedPriority,
            selectedLens: form.selectedLens || undefined,
            selectedRelease: showRelease ? form.selectedRelease : "",
            selectedSprint: isEpic ? undefined : form.selectedSprint || "",
            epicKey: isEpic ? undefined : form.epicKey || "",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t.failed);
        return;
      }
      toast.success(t.saved);
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,40rem)] flex-col gap-0 overflow-y-auto sm:max-w-xl"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilIcon data-icon="inline-start" />
            {t.title}
          </DialogTitle>
          <DialogDescription translate="no">
            {issue?.key || "—"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner />
            {t.loading}
          </div>
        )}

        {error && !loading && (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && form && (
          <FieldGroup className="gap-3 px-1 py-2">
            <Field>
              <FieldLabel htmlFor="rm-summary">{t.summary}</FieldLabel>
              <Input
                id="rm-summary"
                value={form.summary}
                onChange={(e) =>
                  setForm({ ...form, summary: e.target.value })
                }
                dir="auto"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="rm-desc">{t.description}</FieldLabel>
              <Textarea
                id="rm-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={5}
                dir="auto"
              />
            </Field>

            <Field>
              <FieldLabel>{t.priority}</FieldLabel>
              <SearchableSelect
                options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                value={form.selectedPriority}
                onChange={(val) =>
                  setForm({ ...form, selectedPriority: val })
                }
                isRtl={isRtl}
              />
            </Field>

            {form.issuetype === "Story" && (
              <Field>
                <FieldLabel>{t.lens}</FieldLabel>
                <SearchableSelect
                  options={[
                    { value: "", label: t.none },
                    ...LENS_OPTIONS.map((o) => ({
                      value: o.value,
                      label: lensDisplayLabel(o.value, language),
                    })),
                  ]}
                  value={form.selectedLens || ""}
                  onChange={(val) =>
                    setForm({
                      ...form,
                      selectedLens: (val || "") as StoryLens | "",
                    })
                  }
                  isRtl={isRtl}
                />
              </Field>
            )}

            {components.length > 0 && (
              <Field>
                <FieldLabel>{t.component}</FieldLabel>
                <SearchableSelect
                  options={[
                    { value: "", label: t.none },
                    ...components.map((c) => ({ value: c, label: c })),
                  ]}
                  value={form.selectedComponent}
                  onChange={(val) =>
                    setForm({ ...form, selectedComponent: val })
                  }
                  showSearch
                  isRtl={isRtl}
                />
              </Field>
            )}

            {users.length > 0 && (
              <Field>
                <FieldLabel>{t.assignee}</FieldLabel>
                <SearchableSelect
                  options={[
                    { value: "", label: t.none },
                    ...users.map((u) => ({
                      value: u.name,
                      label: u.displayName,
                      sublabel: u.name,
                    })),
                  ]}
                  value={form.selectedAssignee}
                  onChange={(val) =>
                    setForm({ ...form, selectedAssignee: val })
                  }
                  showSearch
                  isRtl={isRtl}
                />
              </Field>
            )}

            {!isEpic && (
              <Field>
                <FieldLabel>{t.epicLink}</FieldLabel>
                <Input
                  value={form.epicKey}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      epicKey: e.target.value.toUpperCase(),
                      selectedRelease: e.target.value.trim()
                        ? ""
                        : form.selectedRelease,
                    })
                  }
                  placeholder="PROJ-123"
                  translate="no"
                  disabled={nestedUnderEpic}
                />
                {(nestedUnderEpic || form.epicKey) && (
                  <p className="text-xs text-muted-foreground">
                    {t.underEpicHint}
                  </p>
                )}
              </Field>
            )}

            {showRelease && (
              <Field>
                <FieldLabel>{t.release}</FieldLabel>
                <SearchableSelect
                  options={[
                    { value: "", label: t.none },
                    ...versionOptions,
                  ]}
                  value={form.selectedRelease}
                  onChange={(val) =>
                    setForm({ ...form, selectedRelease: val })
                  }
                  showSearch
                  isRtl={isRtl}
                />
                <p className="text-xs text-muted-foreground">{t.releaseHint}</p>
              </Field>
            )}

            {!isEpic && (
              <Field>
                <FieldLabel>{t.sprint}</FieldLabel>
                <SearchableSelect
                  options={[
                    { value: "", label: t.none },
                    ...sprints.map((s) => ({
                      value: String(s.id),
                      label: s.name,
                      sublabel: s.state,
                    })),
                  ]}
                  value={form.selectedSprint}
                  onChange={(val) =>
                    setForm({ ...form, selectedSprint: val })
                  }
                  showSearch
                  isRtl={isRtl}
                />
              </Field>
            )}
          </FieldGroup>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t.cancel}
          </Button>
          <Button
            disabled={loading || !!error || !form || saving}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Spinner data-icon="inline-start" />
                {t.saving}
              </>
            ) : (
              t.save
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
