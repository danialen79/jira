"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeftIcon } from "lucide-react";
import { toast } from "sonner";
import type { JiraVersion, Language, VersionIssue } from "@/lib/types";
import { parseProductFromVersionName } from "@/lib/roadmap";
import {
  isEpicIssueType,
  selectableFixVersions,
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
import { Spinner } from "@/components/ui/spinner";
import SearchableSelect from "@/components/SearchableSelect";

const CLEAR_VERSION = "__CLEAR__";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: VersionIssue | null;
  currentVersion: JiraVersion;
  allVersions: JiraVersion[];
  language: Language;
  isRtl: boolean;
  onMoved?: () => void;
};

const copy = {
  en: {
    title: "Change version",
    description: "Move this issue to another Fix Version, or remove it.",
    target: "Target version",
    current: "Current",
    save: "Move",
    remove: "Remove version",
    saving: "Saving…",
    cancel: "Cancel",
    success: "Version updated.",
    cleared: "Version removed.",
    failed: "Could not change version.",
    pick: "Select a version",
    clearOption: "No version (remove)",
    sameProduct: "Same-product versions, or remove Fix Version entirely.",
    empty: "No other versions for this product. You can still remove it.",
  },
  fa: {
    title: "تغییر ورژن",
    description: "ایشو را به ورژن دیگری ببرید یا Fix Version را حذف کنید.",
    target: "ورژن مقصد",
    current: "فعلی",
    save: "انتقال",
    remove: "حذف ورژن",
    saving: "در حال ذخیره…",
    cancel: "انصراف",
    success: "ورژن به‌روز شد.",
    cleared: "ورژن حذف شد.",
    failed: "تغییر ورژن انجام نشد.",
    pick: "یک ورژن انتخاب کنید",
    clearOption: "بدون ورژن (حذف)",
    sameProduct: "ورژن‌های همین محصول، یا حذف کامل Fix Version.",
    empty: "ورژن دیگری برای این محصول نیست. می‌توانید ورژن را حذف کنید.",
  },
} as const;

export default function ChangeVersionDialog({
  open,
  onOpenChange,
  issue,
  currentVersion,
  allVersions,
  language,
  isRtl,
  onMoved,
}: Props) {
  const t = copy[language];
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const product = useMemo(
    () => parseProductFromVersionName(currentVersion.name),
    [currentVersion.name]
  );

  const versionOptions = useMemo(() => {
    return selectableFixVersions(allVersions)
      .filter((v) => v.id !== currentVersion.id)
      .filter((v) => parseProductFromVersionName(v.name) === product)
      .map((v) => ({
        value: v.id,
        label: v.name,
      }));
  }, [allVersions, currentVersion.id, product]);

  const selectOptions = useMemo(
    () => [
      { value: "", label: t.pick },
      {
        value: CLEAR_VERSION,
        label: t.clearOption,
        sublabel: language === "fa" ? "حذف Fix Version" : "Clear Fix Version",
      },
      ...versionOptions,
    ],
    [t.pick, t.clearOption, versionOptions, language]
  );

  const isClear = targetId === CLEAR_VERSION;
  const canSubmit = Boolean(targetId) && !saving;

  const handleOpenChange = (next: boolean) => {
    if (!next) setTargetId("");
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!issue || !targetId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jira/set-fix-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: issue.key,
          fixVersionId: isClear ? null : targetId,
          clearChildrenFromVersionId: isEpicIssueType(issue.issuetype)
            ? currentVersion.id
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t.failed);
        return;
      }
      toast.success(isClear ? t.cleared : t.success);
      handleOpenChange(false);
      onMoved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeftIcon data-icon="inline-start" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {issue ? (
              <span className="flex flex-col gap-1">
                <span translate="no">{issue.key}</span>
                <span className="text-xs">{t.sameProduct}</span>
              </span>
            ) : (
              t.description
            )}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel>{t.current}</FieldLabel>
            <p className="text-sm font-medium" translate="no">
              {currentVersion.name}
            </p>
          </Field>
          <Field>
            <FieldLabel>{t.target}</FieldLabel>
            {versionOptions.length === 0 && (
              <p className="mb-2 text-xs text-muted-foreground">{t.empty}</p>
            )}
            <SearchableSelect
              options={selectOptions}
              value={targetId}
              onChange={setTargetId}
              showSearch
              isRtl={isRtl}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            {t.cancel}
          </Button>
          <Button
            variant={isClear ? "destructive" : "default"}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {saving ? (
              <>
                <Spinner data-icon="inline-start" />
                {t.saving}
              </>
            ) : isClear ? (
              t.remove
            ) : (
              t.save
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
