"use client";

import React, { useEffect, useMemo, useState } from "react";
import { EpicAuditItem } from "@/lib/types";
import { getSearchParam, useUrlQueryState } from "@/lib/url-state";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  ChevronRight,
  ChevronLeft,
  CheckSquare,
  Square,
  Info,
  Tag,
  Aperture,
} from "lucide-react";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { jiraBrowseUrl, normalizeJiraBase } from "@/lib/jira-browse";
import {
  LENS_OPTIONS,
  isStoryLens,
  lensDisplayLabel,
  type IssueLens,
  type StoryLens,
} from "@/lib/lens";
import { cn } from "@/lib/utils";
import {
  IssueCard,
  IssueCardFooter,
  IssueCardHeader,
  IssueKeyLink,
} from "@/components/issue-card";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import SearchableSelect from "@/components/SearchableSelect";
import { useJiraApp } from "@/components/providers/jira-app-provider";

type SyncMode = "component" | "lens";

const ORPHAN_GROUP_KEY = "__orphans__";

interface EpicComponentSyncProps {
  jiraUrl: string;
  jiraConnected: boolean;
}

const syncTranslations = {
    title: "همگام‌سازی اپیک",
    subtitle: "کامپوننت یا لنز خالی روی فرزندان را پر کنید.",
    connectFirst: "متغیرهای JIRA_* را تنظیم کنید، سپس Health را باز کنید.",
    refreshBtn: "بروزرسانی",
    loadingEpics: "بارگذاری…",
    modeComponent: "بدون کامپوننت",
    modeLens: "بدون لنز",
    epicComponentLabel: "کامپوننت‌های اپیک:",
    epicLensLabel: "لنز اپیک:",
    noEpicsFound: "موردی برای این فیلتر نیست.",
    pageLabel: "صفحه",
    ofLabel: "از",
    groupsTotal: "گروه‌ها:",
    selectedCount: "انتخاب‌شده",
    issuesSelected: "تیکت",
    applyBtn: "اعمال روی انتخاب‌شده‌ها",
    confirmModalTitle: "تایید به‌روزرسانی",
    confirmModalDescComponent:
      "کامپوننت موردنظر برای تیکت‌های انتخاب‌شده را انتخاب کنید.",
    confirmModalDescLens: "لنز موردنظر برای تیکت‌های انتخاب‌شده را انتخاب کنید.",
    confirmBtn: "به‌روزرسانی در جیرا",
    cancelBtn: "انصراف",
    updatingProgress: "در حال به‌روزرسانی…",
    updateSuccess: "به‌روز شد.",
    noIssuesInEpic: "تیکت منطبقی زیر این گروه نیست.",
    currentComponents: "فعلی:",
    noComponentBadge: "بدون کامپوننت",
    noLensBadge: "بدون لنز",
    selectAllEpic: "انتخاب همه در گروه",
    orphanTitle: "بدون اپیک",
    orphanBadge: "مستقل",
    pickComponent: "کامپوننت",
    pickLens: "لنز",
    pickRequired: "اول یک مقدار انتخاب کنید.",
    none: "—",
  };

function parseMode(raw: string | null): SyncMode {
  return raw === "lens" ? "lens" : "component";
}

function suggestedComponent(epics: EpicAuditItem[], keys: string[]): string {
  const selected = new Set(keys);
  const parentComps = new Set<string>();
  for (const epic of epics) {
    if (epic.kind === "orphan") continue;
    const hasSelected = epic.childIssues.some((c) => selected.has(c.key));
    if (!hasSelected) continue;
    for (const c of epic.components) parentComps.add(c);
  }
  if (parentComps.size === 1) return [...parentComps][0];
  return "";
}

function suggestedLens(epics: EpicAuditItem[], keys: string[]): string {
  const selected = new Set(keys);
  const parentLenses = new Set<string>();
  for (const epic of epics) {
    if (epic.kind === "orphan") continue;
    const hasSelected = epic.childIssues.some((c) => selected.has(c.key));
    if (!hasSelected) continue;
    if (epic.lens && isStoryLens(epic.lens)) parentLenses.add(epic.lens);
  }
  if (parentLenses.size === 1) return [...parentLenses][0];
  return "";
}

export default function EpicComponentSync({
  jiraUrl,
  jiraConnected,
}: EpicComponentSyncProps) {
  const t = syncTranslations;  const jiraBase = normalizeJiraBase(jiraUrl);
  const reduceMotion = useReducedMotion();
  const { componentNames } = useJiraApp();

  const [loading, setLoading] = useState(false);
  const [epics, setEpics] = useState<EpicAuditItem[]>([]);
  const [totalEpics, setTotalEpics] = useState(0);
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(() => {
    const n = Number(getSearchParam(searchParams, "page", "1"));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  });
  const pageSize = 10;

  const [mode, setMode] = useState<SyncMode>(() =>
    parseMode(searchParams.get("mode"))
  );

  useUrlQueryState({
    page: currentPage <= 1 ? null : String(currentPage),
    mode: mode === "component" ? null : mode,
  });

  const [selectedIssueKeys, setSelectedIssueKeys] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pickedComponent, setPickedComponent] = useState("");
  const [pickedLens, setPickedLens] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState("");
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const componentOptions = useMemo(
    () => componentNames.map((name) => ({ value: name, label: name })),
    [componentNames]
  );

  const lensOptions = useMemo(
    () =>
      LENS_OPTIONS.map((o) => ({
        value: o.value,
        label: lensDisplayLabel(o.value),
      })),
    []
  );

  const fetchAuditData = async (
    page: number = currentPage,
    overrideMode?: SyncMode
  ) => {
    if (!jiraConnected) return;
    setLoading(true);
    setErrorMsg(null);
    setToastSuccess(null);

    const activeMode = overrideMode ?? mode;
    const startAt = (page - 1) * pageSize;

    try {
      const res = await fetch("/api/jira/epic-components-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt,
          maxResults: pageSize,
          mode: activeMode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEpics(data.epics || []);
        setTotalEpics(data.total || 0);
        setSelectedIssueKeys([]);
      } else {
        setErrorMsg(data.error || "Failed to audit epic sync.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error fetching audit data.");
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (next: SyncMode) => {
    if (next === mode) return;
    setMode(next);
    setCurrentPage(1);
    setSelectedIssueKeys([]);
    fetchAuditData(1, next);
  };

  useEffect(() => {
    if (jiraConnected) {
      fetchAuditData(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on page/connection only
  }, [jiraConnected, currentPage]);

  const totalPages = Math.ceil(totalEpics / pageSize) || 1;

  const toggleIssueSelection = (key: string) => {
    setSelectedIssueKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleEpicSelection = (epic: EpicAuditItem) => {
    const candidateKeys = epic.childIssues.map((c) => c.key);
    const allSelected = candidateKeys.every((k) =>
      selectedIssueKeys.includes(k)
    );

    if (allSelected) {
      setSelectedIssueKeys((prev) =>
        prev.filter((k) => !candidateKeys.includes(k))
      );
    } else {
      setSelectedIssueKeys((prev) => {
        const next = [...prev];
        for (const k of candidateKeys) {
          if (!next.includes(k)) next.push(k);
        }
        return next;
      });
    }
  };

  const openConfirm = () => {
    if (selectedIssueKeys.length === 0) return;
    setPickedComponent(suggestedComponent(epics, selectedIssueKeys));
    setPickedLens(suggestedLens(epics, selectedIssueKeys));
    setShowConfirmModal(true);
  };

  const handleConfirmUpdate = async () => {
    if (selectedIssueKeys.length === 0) return;

    if (mode === "component") {
      if (!pickedComponent.trim()) {
        setErrorMsg(t.pickRequired);
        return;
      }
    } else if (!isStoryLens(pickedLens)) {
      setErrorMsg(t.pickRequired);
      return;
    }

    setUpdating(true);
    setUpdateProgress("در حال ارسال…");
    setErrorMsg(null);

    try {
      if (mode === "component") {
        const payload = selectedIssueKeys.map((issueKey) => ({
          issueKey,
          components: [pickedComponent.trim()],
        }));

        const res = await fetch("/api/jira/bulk-update-components", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: payload }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setToastSuccess(
            `${t.updateSuccess} (${data.updatedCount} / ${payload.length})`
          );
          setShowConfirmModal(false);
          setSelectedIssueKeys([]);
          fetchAuditData(currentPage);
        } else {
          setErrorMsg(data.error || "Failed to update issue components.");
        }
      } else {
        const res = await fetch("/api/jira/issues/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "setLens",
            issueKeys: selectedIssueKeys,
            params: { lens: pickedLens as StoryLens },
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setToastSuccess(
            `${t.updateSuccess} (${data.updatedCount} / ${selectedIssueKeys.length})`
          );
          setShowConfirmModal(false);
          setSelectedIssueKeys([]);
          fetchAuditData(currentPage);
        } else {
          setErrorMsg(data.error || "Failed to update issue lenses.");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to update endpoint.");
    } finally {
      setUpdating(false);
      setUpdateProgress("");
    }
  };

  if (!jiraConnected) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle />
          </EmptyMedia>
          <EmptyTitle>{t.connectFirst}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const motionProps = reduceMotion
    ? { initial: false as const, animate: { y: 0, opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: 50, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: 50, opacity: 0 },
      };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <Sparkles className="size-5" />
          </div>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription className="max-w-3xl">{t.subtitle}</CardDescription>
          <CardAction>
            <Button
              type="button"
              size="sm"
              onClick={() => fetchAuditData(currentPage)}
              disabled={loading}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {t.refreshBtn}
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-(--card-spacing)">
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" aria-hidden />
            <ToggleGroup
              value={[mode]}
              onValueChange={(values) => {
                if (!values.length) return;
                const next = values[0] === "lens" ? "lens" : "component";
                handleModeChange(next);
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="component">
                {t.modeComponent}
              </ToggleGroupItem>
              <ToggleGroupItem value="lens">{t.modeLens}</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t.groupsTotal}{" "}
              <strong className="text-foreground tabular-nums">
                {totalEpics}
              </strong>
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span>
              {t.pageLabel}{" "}
              <strong className="text-foreground tabular-nums">
                {currentPage}
              </strong>{" "}
              {t.ofLabel} {totalPages}
            </span>
          </div>
        </CardContent>
      </Card>

      {toastSuccess && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>{toastSuccess}</AlertTitle>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setToastSuccess(null)}
              aria-label={"بستن"}
            >
              ×
            </Button>
          </AlertAction>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{errorMsg}</AlertTitle>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setErrorMsg(null)}
              aria-label={"بستن"}
            >
              ×
            </Button>
          </AlertAction>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <Spinner className="size-7 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">
              {t.loadingEpics}
            </p>
          </CardContent>
        </Card>
      ) : epics.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>{t.noEpicsFound}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {epics.map((epic) => {
            const isOrphan = epic.kind === "orphan" || epic.key === ORPHAN_GROUP_KEY;
            const childIssues = epic.childIssues;
            const allSelected =
              childIssues.length > 0 &&
              childIssues.every((c) => selectedIssueKeys.includes(c.key));

            return (
              <Card key={epic.key} className="cv-auto">
                <CardHeader className="border-b bg-muted/40">
                  <div className="flex flex-wrap items-center gap-3">
                    {isOrphan ? (
                      <Badge variant="secondary">{t.orphanBadge}</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-mono">
                        {epic.key}
                      </Badge>
                    )}
                    <CardTitle className="text-sm">
                      {isOrphan ? t.orphanTitle : epic.summary}
                    </CardTitle>
                  </div>
                  {!isOrphan && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {mode === "component" ? (
                        <>
                          <span className="me-1 text-[11px] font-medium text-muted-foreground">
                            {t.epicComponentLabel}
                          </span>
                          {epic.components.length > 0 ? (
                            epic.components.map((comp) => (
                              <Badge key={comp} variant="outline">
                                <Tag data-icon="inline-start" />
                                {comp}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              {t.none}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="me-1 text-[11px] font-medium text-muted-foreground">
                            {t.epicLensLabel}
                          </span>
                          {epic.lens ? (
                            <Badge variant="outline">
                              <Aperture data-icon="inline-start" />
                              {lensDisplayLabel(epic.lens as IssueLens)}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              {t.none}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-(--card-spacing)">
                  {childIssues.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground italic">
                      {t.noIssuesInEpic}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          onClick={() => toggleEpicSelection(epic)}
                          className="h-auto px-0 lowercase tracking-normal"
                        >
                          {allSelected ? (
                            <CheckSquare data-icon="inline-start" />
                          ) : (
                            <Square data-icon="inline-start" />
                          )}
                          {t.selectAllEpic}
                        </Button>
                        <div className="tabular-nums">
                          {childIssues.length} {t.issuesSelected}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex flex-col gap-2">
                        {childIssues.map((child) => {
                          const isSelected = selectedIssueKeys.includes(
                            child.key
                          );
                          const metaLabel =
                            mode === "component"
                              ? child.components.length > 0
                                ? `${t.currentComponents} ${child.components.join(", ")}`
                                : t.noComponentBadge
                              : child.lens
                                ? lensDisplayLabel(child.lens as IssueLens)
                                : t.noLensBadge;

                          return (
                            <IssueCard
                              key={child.key}
                              density="compact"
                              className={cn(
                                isSelected &&
                                  "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                              )}
                            >
                              <IssueCardHeader
                                title={child.summary}
                                leading={
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      toggleIssueSelection(child.key)
                                    }
                                    aria-label={child.key}
                                  />
                                }
                                badges={
                                  <>
                                    <IssueKeyLink
                                      href={jiraBrowseUrl(jiraBase, child.key)}
                                      issueKey={child.key}
                                      showIcon={false}
                                    />
                                    <Badge
                                      className={cn(
                                        "uppercase",
                                        getIssueTypeBadgeClass(child.issuetype)
                                      )}
                                    >
                                      {child.issuetype}
                                    </Badge>
                                  </>
                                }
                              />
                              <IssueCardFooter
                                meta={[
                                  {
                                    label: metaLabel,
                                    key: mode,
                                  },
                                ]}
                              />
                            </IssueCard>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Card size="sm">
          <CardContent className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronRight data-icon="inline-start" />
              {"صفحه قبل"}
            </Button>

            <div className="text-xs font-medium text-foreground tabular-nums">
              {t.pageLabel} {currentPage} {t.ofLabel} {totalPages}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages || loading}
            >
              {"صفحه بعد"}
              <ChevronLeft data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {selectedIssueKeys.length > 0 && (
          <motion.div
            {...motionProps}
            className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-xl -translate-x-1/2"
          >
            <Card className="bg-primary text-primary-foreground ring-primary">
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  {!reduceMotion && (
                    <span className="size-2 animate-ping rounded-full bg-primary-foreground/70" />
                  )}
                  <span>
                    {t.selectedCount}{" "}
                    <strong className="font-bold tabular-nums">
                      {selectedIssueKeys.length}
                    </strong>{" "}
                    {t.issuesSelected}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ms-auto"
                  onClick={openConfirm}
                >
                  <CheckCircle2 data-icon="inline-start" />
                  {t.applyBtn}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog
        open={showConfirmModal}
        onOpenChange={(open) => {
          if (!updating) setShowConfirmModal(open);
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Info />
            </AlertDialogMedia>
            <AlertDialogTitle>{t.confirmModalTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "component"
                ? t.confirmModalDescComponent
                : t.confirmModalDescLens}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>
                {mode === "component" ? t.pickComponent : t.pickLens}
              </FieldLabel>
              {mode === "component" ? (
                <SearchableSelect
                  options={componentOptions}
                  value={pickedComponent}
                  onChange={setPickedComponent}
                  placeholder={t.pickComponent}
                  disabled={updating}
                />
              ) : (
                <SearchableSelect
                  options={lensOptions}
                  value={pickedLens}
                  onChange={setPickedLens}
                  placeholder={t.pickLens}
                  disabled={updating}
                />
              )}
            </Field>
          </FieldGroup>

          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-xl border bg-muted/50 p-3 text-xs">
            {selectedIssueKeys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between border-b border-border py-1 last:border-0"
              >
                <span className="font-mono font-bold text-foreground">
                  {key}
                </span>
                <span className="font-medium text-primary">
                  {mode === "component"
                    ? pickedComponent || t.none
                    : pickedLens
                      ? lensDisplayLabel(pickedLens as IssueLens)
                      : t.none}
                </span>
              </div>
            ))}
          </div>

          {updating && (
            <Alert>
              <Spinner />
              <AlertDescription>
                {updateProgress || t.updatingProgress}
              </AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>
              {t.cancelBtn}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                updating ||
                (mode === "component"
                  ? !pickedComponent.trim()
                  : !isStoryLens(pickedLens))
              }
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmUpdate();
              }}
            >
              {updating ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              {t.confirmBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
