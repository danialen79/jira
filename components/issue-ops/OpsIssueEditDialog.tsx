"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  EPIC_LENS_OPTIONS,
  isIssueLens,
  isStoryLens,
  LENS_OPTIONS,
  lensDisplayLabel,
  type IssueLens,
} from "@/lib/lens";
import {
  fixVersionValidationError,
  issueOwnsFixVersion,
  selectableFixVersions,
} from "@/lib/fix-version-policy";
import type { OpsIssue } from "@/lib/issue-ops/types";
import type { JiraUser, JiraVersion } from "@/lib/types";

type FormState = {
  summary: string;
  description: string;
  issuetype: string;
  selectedAssignee: string;
  selectedLens: IssueLens | "";
  selectedRelease: string;
  epicKey: string;
};

const t = {
    title: "ویرایش ایشو",
    loading: "در حال بارگذاری…",
    save: "ذخیره تغییرات",
    saving: "در حال ذخیره…",
    cancel: "انصراف",
    saved: "ایشو به‌روز شد.",
    failed: "به‌روزرسانی ایشو نشد.",
    summary: "خلاصه",
    assignee: "مسئول",
    lens: "لنز",
    release: "ریلیز (Fix Version)",
    none: "هیچ",
    underEpicHint: "زیر اپیک است — Fix Version روی اپیک است.",
    viaEpic: "ارثی",
  } as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: OpsIssue | null;
  versions: JiraVersion[];
  users: JiraUser[];
  onSaved?: () => void;
};

export default function OpsIssueEditDialog({
  open,
  onOpenChange,
  issue,
  versions,
  users,  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [inheritedVersionName, setInheritedVersionName] = useState<string>("");

  useEffect(() => {
    if (!open || !issue) {
      setForm(null);
      setError(null);
      setInheritedVersionName("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch("/api/jira/fetch-issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueKey: issue.key }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || t.failed);
          setForm(null);
          return;
        }
        const loaded = data.issue;
        const epicKey = loaded.epicKey || issue.epicKey || "";
        setForm({
          summary: loaded.summary || "",
          description: loaded.description || "",
          issuetype: loaded.issuetype || issue.issuetype,
          selectedAssignee: loaded.assignee || "",
          selectedLens: isIssueLens(loaded.selectedLens)
            ? loaded.selectedLens
            : "",
          selectedRelease: loaded.selectedRelease || "",
          epicKey,
        });

        if (
          epicKey &&
          !issueOwnsFixVersion(loaded.issuetype || issue.issuetype, true)
        ) {
          setInheritedVersionName(
            issue.effectiveFixVersionName || t.viaEpic
          );
        } else {
          setInheritedVersionName("");
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
  }, [open, issue, t.failed, t.viaEpic]);

  const hasEpicLink = Boolean(form?.epicKey?.trim());
  const showRelease = form
    ? issueOwnsFixVersion(form.issuetype, hasEpicLink)
    : false;

  const versionOptions = useMemo(
    () =>
      selectableFixVersions(versions, {
        includeId: form?.selectedRelease,
      }).map((v) => ({
        value: v.id,
        label: v.name,
        sublabel: v.released ? "منتشرشده" : undefined,
      })),
    [versions, form?.selectedRelease]
  );

  const handleSave = async () => {
    if (!issue || !form) return;

    const fvError = showRelease
      ? fixVersionValidationError({
          issuetype: form.issuetype,
          hasEpicLink: false,
          selectedRelease: form.selectedRelease,
        })
      : null;
    if (fvError) {
      toast.error(fvError);
      return;
    }
    if (form.issuetype === "Story" && !isStoryLens(form.selectedLens)) {
      toast.error("برای استوری لنز لازم است.");
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
            selectedAssignee: form.selectedAssignee || "",
            selectedLens:
              form.issuetype === "Story" ||
              form.issuetype.toLowerCase() === "epic"
                ? form.selectedLens || ""
                : undefined,
            selectedRelease: showRelease ? form.selectedRelease : "",
            epicKey: form.issuetype.toLowerCase() === "epic" ? undefined : form.epicKey || "",
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
        className="flex max-h-[min(92vh,36rem)] flex-col gap-0 overflow-y-auto sm:max-w-lg"
        dir="rtl"
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
              <FieldLabel htmlFor="ops-summary">{t.summary}</FieldLabel>
              <Input
                id="ops-summary"
                name="summary"
                value={form.summary}
                onChange={(e) =>
                  setForm({ ...form, summary: e.target.value })
                }
                dir="auto"
                autoComplete="off"
              />
            </Field>

            {(form.issuetype === "Story" ||
              form.issuetype.toLowerCase() === "epic") && (
              <Field>
                <FieldLabel>{t.lens}</FieldLabel>
                <SearchableSelect
                  options={(form.issuetype.toLowerCase() === "epic"
                    ? EPIC_LENS_OPTIONS
                    : LENS_OPTIONS
                  ).map((o) => ({
                    value: o.value,
                    label: lensDisplayLabel(o.value),
                  }))}
                  value={form.selectedLens || ""}
                  onChange={(val) =>
                    setForm({
                      ...form,
                      selectedLens: (val || "") as IssueLens | "",
                    })
                  }
                  />
              </Field>
            )}

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
                />
            </Field>

            {showRelease ? (
              <Field>
                <FieldLabel>{t.release}</FieldLabel>
                <SearchableSelect
                  options={versionOptions}
                  value={form.selectedRelease}
                  onChange={(val) =>
                    setForm({ ...form, selectedRelease: val })
                  }
                  />
              </Field>
            ) : hasEpicLink ? (
              <p className="text-xs text-muted-foreground">
                {t.underEpicHint}
                {inheritedVersionName ? ` (${inheritedVersionName})` : ""}
              </p>
            ) : null}
          </FieldGroup>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading || !form}
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
