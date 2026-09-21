"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLinkIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import type { JiraVersion, VersionIssue, VersionProgressSummary } from "@/lib/types";
import {
  countVersionLenses,
  flattenVersionIssues,
  getVersionStatusLabel,
} from "@/lib/roadmap";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import JalaliDateInput from "@/components/JalaliDateInput";
import VersionIssueTree from "@/components/roadmap/VersionIssueTree";
import VersionMetaChips from "@/components/roadmap/VersionMetaChips";
import VersionStatsCharts from "@/components/roadmap/VersionStatsCharts";
import ChangeVersionDialog from "@/components/roadmap/ChangeVersionDialog";
import RoadmapIssueEditDialog from "@/components/roadmap/RoadmapIssueEditDialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: JiraVersion | null;
  versions: JiraVersion[];
  jiraUrl: string;
  onVersionUpdated?: (version: JiraVersion) => void;
};

const t = {
    loading: "در حال بارگذاری ایشوها…",
    start: "شروع",
    release: "انتشار",
    todo: "انجام‌نشده",
    inProgress: "در حال انجام",
    done: "انجام‌شده",
    canceled: "لغوشده",
    archived: "بایگانی",
    released: "منتشرشده",
    overdue: "عقب‌افتاده",
    unreleased: "منتشرنشده",
    openInJira: "باز کردن در جیرا",
    edit: "ویرایش ورژن",
    markReleased: "منتشرشده",
    save: "ذخیره تغییرات",
    saving: "در حال ذخیره…",
    saved: "ورژن بروزرسانی شد.",
    saveFailed: "بروزرسانی ورژن نشد.",
    issues: "ایشوها",
  } as const;

function statusBadgeVariant(
  label: ReturnType<typeof getVersionStatusLabel>
): "success" | "destructive" | "outline" | "secondary" {
  switch (label) {
    case "released":
      return "success";
    case "overdue":
      return "destructive";
    case "archived":
      return "secondary";
    default:
      return "outline";
  }
}

function toInputDate(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m?.[1] || "";
}

function todayInputDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function VersionDetailSheet({
  open,
  onOpenChange,
  version,
  versions,
  jiraUrl,
  onVersionUpdated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<VersionIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState<VersionProgressSummary | null>(null);

  const [startDate, setStartDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [released, setReleased] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [issueEdit, setIssueEdit] = useState<{
    issue: VersionIssue;
    nestedUnderEpic: boolean;
  } | null>(null);
  const [changeVersionIssue, setChangeVersionIssue] =
    useState<VersionIssue | null>(null);

  const reloadIssues = async (versionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ versionId });
      const res = await fetch(`/api/jira/versions/issues?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load issues");
        setTree([]);
        setProgress(null);
        setTotal(0);
        return;
      }
      setTree(data.tree || data.issues || []);
      setTotal(data.total ?? (data.issues || []).length);
      setProgress(data.progress || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load issues");
      setTree([]);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!version) return;
    setStartDate(toInputDate(version.startDate));
    setReleaseDate(toInputDate(version.releaseDate));
    setReleased(!!version.released);
    setEditOpen(false);
  }, [version]);

  useEffect(() => {
    if (!open) setEditOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !version) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ versionId: version.id });
        const res = await fetch(`/api/jira/versions/issues?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || "Failed to load issues");
          setTree([]);
          setProgress(null);
          setTotal(0);
          return;
        }
        setTree(data.tree || data.issues || []);
        setTotal(data.total ?? (data.issues || []).length);
        setProgress(data.progress || null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load issues");
          setTree([]);
          setProgress(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, version]);

  const draftVersion = useMemo((): JiraVersion | null => {
    if (!version) return null;
    return {
      ...version,
      startDate: startDate || undefined,
      releaseDate: releaseDate || undefined,
      released,
    };
  }, [version, startDate, releaseDate, released]);

  const statusLabel = draftVersion
    ? getVersionStatusLabel(draftVersion)
    : "unreleased";

  const dirty = useMemo(() => {
    if (!version) return false;
    return (
      toInputDate(version.startDate) !== startDate ||
      toInputDate(version.releaseDate) !== releaseDate ||
      !!version.released !== released
    );
  }, [version, startDate, releaseDate, released]);

  const lensCounts = useMemo(
    () => countVersionLenses(flattenVersionIssues(tree)),
    [tree]
  );

  const base = jiraUrl.replace(/\/+$/, "");

  const handleReleasedChange = (next: boolean) => {
    setReleased(next);
    if (next && !releaseDate) {
      setReleaseDate(todayInputDate());
    }
  };

  const handleSave = async () => {
    if (!version || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jira/update-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: version.id,
          startDate: startDate || null,
          releaseDate: releaseDate || null,
          released,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t.saveFailed);
        return;
      }
      const updated = data.version as JiraVersion;
      setStartDate(toInputDate(updated.startDate));
      setReleaseDate(toInputDate(updated.releaseDate));
      setReleased(!!updated.released);
      onVersionUpdated?.(updated);
      toast.success(t.saved);
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[min(94vh,72rem)] w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-4xl",
            "font-sans"
          )}
          dir="rtl"
        >
          <DialogHeader className="items-center gap-3 border-b px-6 pt-5 pb-4 text-center sm:items-center">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
              <DialogTitle className="max-w-[min(100%,28rem)] text-center text-lg font-semibold tracking-tight">
                <span translate="no">{version?.name || "—"}</span>
              </DialogTitle>
              {draftVersion && (
                <Badge variant={statusBadgeVariant(statusLabel)}>
                  {t[statusLabel]}
                </Badge>
              )}
            </div>
            <DialogDescription className="sr-only">{t.issues}</DialogDescription>

            {draftVersion && (
              <div className="flex w-full flex-col items-center gap-3">
                <VersionMetaChips
                  version={draftVersion}
                  className="w-full justify-center"
                />

                {version && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!version.archived}
                      onClick={() => setEditOpen(true)}
                    >
                      <PencilIcon data-icon="inline-start" />
                      {t.edit}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const jql = encodeURIComponent(
                          `fixVersion = ${version.id}`
                        );
                        window.open(
                          `${base}/issues/?jql=${jql}`,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                    >
                      <ExternalLinkIcon data-icon="inline-start" />
                      {t.openInJira}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-4">
            {loading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="size-40 rounded-full" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="size-40 rounded-full" />
                </div>
              </div>
            )}

            {!loading && !error && tree.length > 0 && (
              <VersionStatsCharts
                progress={progress}
                lensCounts={lensCounts}
                />
            )}

            <div className="flex flex-col gap-2">
              <p className="text-center text-xs font-medium text-muted-foreground">
                {t.issues}
              </p>

              {loading && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Spinner />
                    {t.loading}
                  </div>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              )}

              {error && !loading && (
                <p className="text-center text-sm text-destructive">{error}</p>
              )}

              {!loading && !error && (
                <VersionIssueTree
                  tree={tree}
                  total={total}
                  jiraUrl={jiraUrl}
                  onEditIssue={(issue, nestedUnderEpic) =>
                    setIssueEdit({ issue, nestedUnderEpic })
                  }
                  onChangeVersion={(issue) => setChangeVersionIssue(issue)}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-md"
          dir="rtl"
        >
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
            <DialogDescription className="truncate" translate="no">
              {version?.name}
            </DialogDescription>
          </DialogHeader>

          {version && (
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="version-start">{t.start}</FieldLabel>
                <JalaliDateInput
                  id="version-start"
                  value={startDate}
                  onChange={setStartDate}
                  disabled={saving || !!version.archived}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="version-release">{t.release}</FieldLabel>
                <JalaliDateInput
                  id="version-release"
                  value={releaseDate}
                  onChange={setReleaseDate}
                  disabled={saving || !!version.archived}
                />
              </Field>
              <Field orientation="horizontal" className="items-center">
                <Switch
                  id="version-released"
                  checked={released}
                  onCheckedChange={handleReleasedChange}
                  disabled={saving || !!version.archived}
                />
                <FieldLabel htmlFor="version-released" className="font-normal">
                  {t.markReleased}
                </FieldLabel>
              </Field>
            </FieldGroup>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              بستن
            </Button>
            <Button
              disabled={!dirty || saving || !!version?.archived}
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

      <RoadmapIssueEditDialog
        open={!!issueEdit}
        onOpenChange={(next) => {
          if (!next) setIssueEdit(null);
        }}
        issue={issueEdit?.issue || null}
        nestedUnderEpic={issueEdit?.nestedUnderEpic}
        versions={versions}
        onSaved={() => {
          if (version) void reloadIssues(version.id);
        }}
      />

      {version && (
        <ChangeVersionDialog
          open={!!changeVersionIssue}
          onOpenChange={(next) => {
            if (!next) setChangeVersionIssue(null);
          }}
          issue={changeVersionIssue}
          currentVersion={version}
          allVersions={versions}
          onMoved={() => {
            if (version) void reloadIssues(version.id);
          }}
        />
      )}
    </>
  );
}
