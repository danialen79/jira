"use client";

import React, { useState, useEffect } from "react";
import { Language, EpicAuditItem } from "@/lib/types";
import { getSearchParam, useUrlQueryState } from "@/lib/url-state";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Tag,
  CheckSquare,
  Square,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface EpicComponentSyncProps {
  language: Language;
  jiraUrl: string;
  jiraConnected: boolean;
}

const syncTranslations = {
  en: {
    title: "Epic component sync",
    subtitle: "Find child issues missing the epic’s components, then apply.",
    connectFirst: "Set JIRA_* on the server, then open Health.",
    refreshBtn: "Refresh",
    loadingEpics: "Loading epics…",
    onlyMissingToggle: "Only missing components",
    showAllToggle: "Show all connected issues",
    epicComponentLabel: "Epic components:",
    noEpicsFound: "No epics with components for this filter.",
    pageLabel: "Page",
    ofLabel: "of",
    epicsTotal: "Total epics:",
    selectedCount: "Selected",
    issuesSelected: "issue(s)",
    applyBtn: "Apply to selected",
    confirmModalTitle: "Confirm update",
    confirmModalDesc: "Selected issues will inherit their parent epic’s components.",
    confirmBtn: "Update in Jira",
    cancelBtn: "Cancel",
    updatingProgress: "Updating issues…",
    updateSuccess: "Components updated.",
    noIssuesInEpic: "No child issues under this epic.",
    allHaveComponents: "All connected issues already have components.",
    currentComponents: "Current:",
    missingToAdd: "Will add:",
    noComponentBadge: "No component",
    selectAllEpic: "Select all in epic",
  },
  fa: {
    title: "همگام‌سازی کامپوننت اپیک",
    subtitle: "تیکت‌های بدون کامپوننت اپیک را پیدا و اعمال کنید.",
    connectFirst: "متغیرهای JIRA_* را تنظیم کنید، سپس Health را باز کنید.",
    refreshBtn: "بروزرسانی",
    loadingEpics: "بارگذاری اپیک‌ها…",
    onlyMissingToggle: "فقط بدون کامپوننت",
    showAllToggle: "همه تیکت‌های متصل",
    epicComponentLabel: "کامپوننت‌های اپیک:",
    noEpicsFound: "اپیک دارای کامپوننتی برای این فیلتر نیست.",
    pageLabel: "صفحه",
    ofLabel: "از",
    epicsTotal: "کل اپیک‌ها:",
    selectedCount: "انتخاب‌شده",
    issuesSelected: "تیکت",
    applyBtn: "اعمال روی انتخاب‌شده‌ها",
    confirmModalTitle: "تایید به‌روزرسانی",
    confirmModalDesc: "تیکت‌های انتخاب‌شده کامپوننت اپیک والد را می‌گیرند.",
    confirmBtn: "به‌روزرسانی در جیرا",
    cancelBtn: "انصراف",
    updatingProgress: "در حال به‌روزرسانی…",
    updateSuccess: "کامپوننت‌ها به‌روز شد.",
    noIssuesInEpic: "تیکت فرعی زیر این اپیک نیست.",
    allHaveComponents: "همه تیکت‌های متصل کامپوننت دارند.",
    currentComponents: "فعلی:",
    missingToAdd: "افزودن:",
    noComponentBadge: "بدون کامپوننت",
    selectAllEpic: "انتخاب همه در اپیک",
  },
};

function issueTypeVariant(
  issuetype: string
): "success" | "destructive" | "secondary" {
  if (issuetype === "Story") return "success";
  if (issuetype === "Bug") return "destructive";
  return "secondary";
}

export default function EpicComponentSync({
  language,
  jiraUrl: _jiraUrl,
  jiraConnected,
}: EpicComponentSyncProps) {
  const t = syncTranslations[language];
  const isRtl = language === "fa";

  const [loading, setLoading] = useState(false);
  const [epics, setEpics] = useState<EpicAuditItem[]>([]);
  const [totalEpics, setTotalEpics] = useState(0);
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState(() => {
    const n = Number(getSearchParam(searchParams, "page", "1"));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  });
  const pageSize = 10;

  const [onlyMissing, setOnlyMissing] = useState(
    searchParams.get("missing") !== "0"
  );

  useUrlQueryState({
    page: currentPage <= 1 ? null : String(currentPage),
    missing: onlyMissing ? null : "0",
  });
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<string[]>([]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState("");
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAuditData = async (
    page: number = currentPage,
    overrideOnlyMissing?: boolean
  ) => {
    if (!jiraConnected) return;
    setLoading(true);
    setErrorMsg(null);
    setToastSuccess(null);

    const missingFilter =
      overrideOnlyMissing !== undefined ? overrideOnlyMissing : onlyMissing;
    const startAt = (page - 1) * pageSize;

    try {
      const res = await fetch("/api/jira/epic-components-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt,
          maxResults: pageSize,
          onlyWithComponents: true,
          onlyMissing: missingFilter,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEpics(data.epics || []);
        setTotalEpics(data.total || 0);
        setSelectedIssueKeys([]);
      } else {
        setErrorMsg(data.error || "Failed to audit epic components.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error fetching audit data.");
    } finally {
      setLoading(false);
    }
  };

  const handleMissingToggle = (val: boolean) => {
    setOnlyMissing(val);
    setCurrentPage(1);
    fetchAuditData(1, val);
  };

  useEffect(() => {
    if (jiraConnected) {
      fetchAuditData(currentPage);
    }
  }, [jiraConnected, currentPage]);

  const totalPages = Math.ceil(totalEpics / pageSize) || 1;

  const toggleIssueSelection = (key: string) => {
    setSelectedIssueKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleEpicSelection = (epic: EpicAuditItem) => {
    const candidateIssues = epic.childIssues.filter((child) =>
      onlyMissing
        ? child.missingComponents.length > 0 || child.components.length === 0
        : true
    );
    const candidateKeys = candidateIssues.map((c) => c.key);

    const allSelected = candidateKeys.every((k) =>
      selectedIssueKeys.includes(k)
    );

    if (allSelected) {
      setSelectedIssueKeys((prev) =>
        prev.filter((k) => !candidateKeys.includes(k))
      );
    } else {
      const newKeys = [...selectedIssueKeys];
      candidateKeys.forEach((k) => {
        if (!newKeys.includes(k)) newKeys.push(k);
      });
      setSelectedIssueKeys(newKeys);
    }
  };

  const getSelectedUpdatesPayload = () => {
    const updatesMap: Record<string, string[]> = {};

    epics.forEach((epic) => {
      epic.childIssues.forEach((child) => {
        if (selectedIssueKeys.includes(child.key)) {
          const combined = Array.from(
            new Set([...child.components, ...epic.components])
          );
          updatesMap[child.key] = combined;
        }
      });
    });

    return Object.entries(updatesMap).map(([issueKey, components]) => ({
      issueKey,
      components,
    }));
  };

  const handleConfirmUpdate = async () => {
    const payload = getSelectedUpdatesPayload();
    if (payload.length === 0) return;

    setUpdating(true);
    setUpdateProgress(isRtl ? "در حال ارسال…" : "Sending…");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/jira/bulk-update-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: payload,
        }),
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
    } catch (err: any) {
      setErrorMsg(
        err.message || "Failed to connect to bulk update server endpoint."
      );
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
            <Filter className="size-3.5 text-muted-foreground" />
            <ToggleGroup
              value={onlyMissing ? ["missing"] : ["all"]}
              onValueChange={(values) => {
                if (!values.length) return;
                handleMissingToggle(values[0] === "missing");
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="missing">
                {t.onlyMissingToggle}
              </ToggleGroupItem>
              <ToggleGroupItem value="all">{t.showAllToggle}</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t.epicsTotal}{" "}
              <strong className="text-foreground">{totalEpics}</strong>
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span>
              {t.pageLabel}{" "}
              <strong className="text-foreground">{currentPage}</strong>{" "}
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
              aria-label={isRtl ? "بستن" : "Dismiss"}
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
              aria-label={isRtl ? "بستن" : "Dismiss"}
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
            const filteredChildIssues = epic.childIssues.filter((child) =>
              onlyMissing
                ? child.missingComponents.length > 0 ||
                  child.components.length === 0
                : true
            );

            const missingChildCount = epic.childIssues.filter(
              (c) =>
                c.missingComponents.length > 0 || c.components.length === 0
            ).length;

            const allFilteredSelected =
              filteredChildIssues.length > 0 &&
              filteredChildIssues.every((c) =>
                selectedIssueKeys.includes(c.key)
              );

            return (
              <Card key={epic.key} className="cv-auto">
                <CardHeader className="border-b bg-muted/40">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="font-mono">
                      {epic.key}
                    </Badge>
                    <CardTitle className="text-sm">{epic.summary}</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
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
                        --
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-(--card-spacing)">
                  {epic.childIssues.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground italic">
                      {t.noIssuesInEpic}
                    </p>
                  ) : filteredChildIssues.length === 0 ? (
                    <Alert>
                      <ShieldCheck />
                      <AlertDescription>{t.allHaveComponents}</AlertDescription>
                    </Alert>
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
                          {allFilteredSelected ? (
                            <CheckSquare data-icon="inline-start" />
                          ) : (
                            <Square data-icon="inline-start" />
                          )}
                          {t.selectAllEpic}
                        </Button>
                        <div>
                          {missingChildCount} {t.issuesSelected}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex flex-col gap-1">
                        {filteredChildIssues.map((child) => {
                          const isSelected = selectedIssueKeys.includes(
                            child.key
                          );
                          const isMissingComps =
                            child.missingComponents.length > 0 ||
                            child.components.length === 0;

                          return (
                            <label
                              key={child.key}
                              className={cn(
                                "flex cursor-pointer flex-col justify-between gap-3 rounded-lg border px-3 py-3 transition-colors sm:flex-row sm:items-center",
                                isSelected
                                  ? "border-primary/30 bg-primary/5"
                                  : "border-transparent hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-start gap-3 sm:items-center">
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleIssueSelection(child.key)
                                  }
                                />
                                <span className="mt-0.5 text-muted-foreground sm:mt-0" aria-hidden="true">
                                  {isSelected ? (
                                    <CheckSquare className="size-4 text-primary" />
                                  ) : (
                                    <Square className="size-4 text-muted-foreground/40" />
                                  )}
                                </span>

                                <span className="shrink-0 font-mono text-xs font-bold text-foreground">
                                  {child.key}
                                </span>

                                <Badge
                                  variant={issueTypeVariant(child.issuetype)}
                                  className="shrink-0 uppercase"
                                >
                                  {child.issuetype}
                                </Badge>

                                <span className="line-clamp-1 text-xs font-medium text-foreground">
                                  {child.summary}
                                </span>
                              </div>

                              <div className="ms-7 flex shrink-0 items-center gap-2 text-[11px] sm:ms-0">
                                <div className="me-2 flex items-center gap-1 text-muted-foreground">
                                  <span>{t.currentComponents}</span>
                                  {child.components.length > 0 ? (
                                    child.components.map((c) => (
                                      <Badge key={c} variant="secondary">
                                        {c}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="warning">
                                      {t.noComponentBadge}
                                    </Badge>
                                  )}
                                </div>

                                {isMissingComps && (
                                  <Badge variant="outline" className="gap-1">
                                    <span>{t.missingToAdd}</span>
                                    {epic.components.map((ec) => (
                                      <span
                                        key={ec}
                                        className="underline decoration-muted-foreground/40"
                                      >
                                        +{ec}
                                      </span>
                                    ))}
                                  </Badge>
                                )}
                              </div>
                            </label>
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
              {isRtl ? (
                <ChevronRight data-icon="inline-start" />
              ) : (
                <ChevronLeft data-icon="inline-start" />
              )}
              {isRtl ? "صفحه قبل" : "Previous"}
            </Button>

            <div className="text-xs font-medium text-foreground">
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
              {isRtl ? "صفحه بعد" : "Next"}
              {isRtl ? (
                <ChevronLeft data-icon="inline-end" />
              ) : (
                <ChevronRight data-icon="inline-end" />
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {selectedIssueKeys.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-xl -translate-x-1/2"
          >
            <Card className="bg-primary text-primary-foreground ring-primary">
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="size-2 animate-ping rounded-full bg-primary-foreground/70" />
                  <span>
                    {t.selectedCount}{" "}
                    <strong className="font-bold">
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
                  onClick={() => setShowConfirmModal(true)}
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
              {t.confirmModalDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-xl border bg-muted/50 p-3 text-xs">
            {getSelectedUpdatesPayload().map((item) => (
              <div
                key={item.issueKey}
                className="flex items-center justify-between border-b border-border py-1 last:border-0"
              >
                <span className="font-mono font-bold text-foreground">
                  {item.issueKey}
                </span>
                <span className="font-medium text-primary">
                  {item.components.join(", ")}
                </span>
              </div>
            ))}
          </div>

          {updating && (
            <Alert>
              <Spinner />
              <AlertDescription>{updateProgress || t.updatingProgress}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>
              {t.cancelBtn}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={updating}
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
