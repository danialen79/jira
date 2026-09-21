"use client";

import React, { useEffect, useState } from "react";
import { RefinedIssue, JiraEpic, JiraUser, JiraVersion, JiraSprint, IssueLens } from "@/lib/types";
import {
  EPIC_LENS_OPTIONS,
  isIssueLens,
  isStoryLens,
  LENS_OPTIONS,
  lensDisplayLabel,
} from "@/lib/lens";
import {
  fixVersionValidationError,
  issueOwnsFixVersion,
  selectableFixVersions,
} from "@/lib/fix-version-policy";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import {
  IssueCard,
  IssueCardFooter,
  IssueCardHeader,
  IssueKeyLink,
} from "@/components/issue-card";
import { getSearchParam, useUrlQueryState } from "@/lib/url-state";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import SearchableSelect from "@/components/SearchableSelect";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  Tag,
  ExternalLink,
  Layers,
  FileText,
  ArrowUpRight,
  HelpCircle,
  RefreshCw,
  Layers2,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

interface RefinedListProps {
  issues: RefinedIssue[];
  onIssuesChange: (issues: RefinedIssue[]) => void;
  jiraUrl: string;
  jiraConnected: boolean;
  existingEpics: JiraEpic[];
  onFetchEpics: () => Promise<void>;
  fetchingEpics: boolean;
  availableComponents: string[];
  availableUsers: JiraUser[];
  fetchingUsers: boolean;
  onFetchUsers: () => Promise<void>;
  availableVersions: JiraVersion[];
  fetchingVersions: boolean;
  onFetchVersions: () => Promise<void>;
  availableSprints: JiraSprint[];
  fetchingSprints: boolean;
  onFetchSprints: () => Promise<void>;
}

const translations = {
    title: "برد اصلاح‌شده",
    subtitle: "تیکت‌های تولیدشده را ویرایش و منتشر کنید.",
    bulkCreate: "انتشار گروهی",
    publishingAll: "در حال انتشار…",
    filterAll: "همه",
    filterEpics: "اپیک‌ها",
    filterStories: "استوری‌ها",
    filterBugs: "باگ‌ها",
    emptyState: "تیکتی نیست. در پنل چپ پیش‌نویس را اصلاح کنید.",
    issueType: "نوع",
    epic: "اپیک",
    story: "استوری",
    bug: "باگ",
    epicLink: "درفت اپیک:",
    noEpicLink: "بدون لینک اپیک",
    createInJira: "انتشار",
    creating: "در حال ساخت…",
    published: "منتشر شد",
    edit: "ویرایش",
    save: "ذخیره",
    cancel: "انصراف",
    summary: "عنوان",
    description: "توضیحات (مارک‌داون)",
    existingEpics: "لینک به اپیک موجود",
    linkHelp: "در انتشار گروهی اول اپیک‌ها ساخته می‌شوند، بعد استوری‌ها لینک می‌شوند.",
    errorOccurred: "خطا:",
    rePublish: "تلاش مجدد",
    noEpicsToLink: "اپیکی نیست. برای دریافت به جیرا وصل شوید.",
    loading: "در حال بارگذاری…",
    loadingUsers: "بارگذاری کاربران…",
    loadingVersions: "بارگذاری نسخه‌ها…",
    loadingSprints: "بارگذاری اسپرینت‌ها…",
    refining: "در حال اصلاح…",
    lens: "لنز",
    lensRequired: "قبل از انتشار استوری، لنز را انتخاب کنید.",
    lensNone: "بدون لنز",
    changeLens: "تغییر لنز:",
    releaseRequiredEpic: "قبل از انتشار، اپیک باید ریلیز (Fix Version) داشته باشد.",
    releaseRequiredOrphan:
      "استوری/باگ بدون اپیک باید ریلیز داشته باشد.",
    releaseHintUnderEpic: "ریلیز روی اپیک است — روی ایشوی لینک‌شده تنظیم نمی‌شود.",
  };

const priorityLabels: Record<string, string> = {
  Highest: "بالاترین",
  High: "بالا",
  Medium: "متوسط",
  Low: "پایین",
  Lowest: "پایین‌ترین",
  priority: "اولویت (Priority)",
  changePriority: "تغییر اولویت:",
};

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const getPriorityBadgeStyles = (priority?: string): BadgeVariant => {
  const p = (priority || "Medium").toLowerCase();
  switch (p) {
    case "highest":
      return "destructive";
    case "high":
      return "warning";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    case "lowest":
      return "ghost";
    default:
      return "secondary";
  }
};

// Helper to track assignee assignment frequency in server kv + memory cache
let assigneeFrequencyCache: Record<string, number> = {};
let assigneeFrequencyHydrated = false;

async function hydrateAssigneeFrequency(): Promise<void> {
  if (assigneeFrequencyHydrated) return;
  try {
    const res = await fetch("/api/kv/prefs/assignee_frequency");
    if (res.ok) {
      const data = await res.json();
      if (data.value && typeof data.value === "object") {
        assigneeFrequencyCache = data.value as Record<string, number>;
      }
    }
  } catch (e) {
    console.error("Failed to load assignee frequency", e);
  } finally {
    assigneeFrequencyHydrated = true;
  }
}

const persistAssigneeFrequency = () => {
  void fetch("/api/kv/prefs/assignee_frequency", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: assigneeFrequencyCache }),
  }).catch((e) => console.error("Failed to persist assignee frequency", e));
};

const trackAssigneeUsage = (username: string) => {
  if (!username) return;
  try {
    assigneeFrequencyCache[username] =
      (assigneeFrequencyCache[username] || 0) + 1;
    persistAssigneeFrequency();
  } catch (e) {
    console.error("Failed to track assignee frequency:", e);
  }
};

// Helper to sort users: most frequently selected first
const getSortedUsers = (users: JiraUser[]): JiraUser[] => {
  try {
    const freq = assigneeFrequencyCache;
    return [...users].sort((a, b) => {
      const freqA = freq[a.name] || 0;
      const freqB = freq[b.name] || 0;
      if (freqA !== freqB) {
        return freqB - freqA; // High frequency first
      }
      return a.displayName.localeCompare(b.displayName); // fallback alphabetical
    });
  } catch {
    return users;
  }
};

export default function RefinedList({
  issues,
  onIssuesChange,
  jiraUrl,
  jiraConnected,
  existingEpics,
  onFetchEpics,
  fetchingEpics,
  availableComponents,
  availableUsers,
  fetchingUsers,
  onFetchUsers,
  availableVersions,
  fetchingVersions,
  onFetchVersions,
  availableSprints,
  fetchingSprints,
  onFetchSprints,
}: RefinedListProps) {
  const t = translations;
  const { aiProvider, selectedModel } = useAiSettings();
  const searchParams = useSearchParams();
  const [, setFreqTick] = useState(0);

  useEffect(() => {
    void hydrateAssigneeFrequency().then(() => setFreqTick((n) => n + 1));
  }, []);

  const [filter, setFilter] = useState<"all" | "epics" | "stories" | "bugs">(
    () => {
      const raw = getSearchParam(searchParams, "filter", "all");
      return raw === "epics" || raw === "stories" || raw === "bugs"
        ? raw
        : "all";
    }
  );

  useUrlQueryState({
    filter: filter === "all" ? null : filter,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    summary: string;
    description: string;
    selectedComponent?: string;
    selectedAssignee?: string;
    selectedSprint?: string;
    selectedRelease?: string;
    selectedPriority?: string;
    selectedLens?: IssueLens | "";
    issuetype: "Epic" | "Story" | "Bug";
  }>({
    summary: "",
    description: "",
    selectedComponent: "",
    selectedAssignee: "",
    selectedSprint: "",
    selectedRelease: "",
    selectedPriority: "",
    selectedLens: "",
    issuetype: "Story",
  });
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // States for AI re-refining
  const [reRefiningId, setReRefiningId] = useState<string | null>(null);
  const [reRefinePrompt, setReRefinePrompt] = useState<string>("");
  const [isAIProcessing, setIsAIProcessing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // States for loading Jira issue by ID
  const [loadJiraKey, setLoadJiraKey] = useState("");
  const [loadingJiraIssue, setLoadingJiraIssue] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showLoadPanel, setShowLoadPanel] = useState(false);

  // Bulk selection and editing states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEpicKey, setBulkEpicKey] = useState<string>("");
  const [bulkPriority, setBulkPriority] = useState<string>("");
  const [bulkComponent, setBulkComponent] = useState<string>("");
  const [bulkLens, setBulkLens] = useState<string>("");
  const [bulkSprint, setBulkSprint] = useState<string>("");
  const [bulkAssignee, setBulkAssignee] = useState<string>("");
  const [bulkRelease, setBulkRelease] = useState<string>("");

  const toggleSelectIssue = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (selectableIssues: any[]) => {
    if (selectedIds.length === selectableIssues.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableIssues.map((i) => i.id));
    }
  };

  const handleApplyBulkChanges = () => {
    if (selectedIds.length === 0) return;

    const updated = issues.map((issue) => {
      if (selectedIds.includes(issue.id)) {
        const newIssue = { ...issue };

        if (bulkEpicKey !== "") {
          newIssue.selectedEpicKey =
            bulkEpicKey === "CLEAR_FIELD" ? undefined : bulkEpicKey;
          if (bulkEpicKey !== "CLEAR_FIELD" && bulkEpicKey) {
            newIssue.selectedRelease = undefined;
          }
        }
        if (bulkPriority !== "") {
          newIssue.selectedPriority = bulkPriority;
        }
        if (bulkComponent !== "") {
          newIssue.selectedComponent =
            bulkComponent === "CLEAR_FIELD" ? undefined : bulkComponent;
        }
        if (bulkLens !== "") {
          if (
            issue.issuetype === "Story" ||
            issue.issuetype === "Epic"
          ) {
            if (bulkLens === "CLEAR_FIELD") {
              newIssue.selectedLens = undefined;
            } else if (bulkLens === "mixed") {
              if (issue.issuetype === "Epic") {
                newIssue.selectedLens = "mixed";
              }
            } else if (isStoryLens(bulkLens)) {
              newIssue.selectedLens = bulkLens;
            }
          }
        }
        if (bulkSprint !== "") {
          newIssue.selectedSprint =
            bulkSprint === "CLEAR_FIELD" ? undefined : bulkSprint;
        }
        if (bulkAssignee !== "") {
          newIssue.selectedAssignee =
            bulkAssignee === "CLEAR_FIELD" ? undefined : bulkAssignee;
        }
        if (bulkRelease !== "") {
          const linked =
            !!newIssue.selectedEpicKey ||
            (!!newIssue.epicReference &&
              issues.some(
                (i) =>
                  i.id === newIssue.epicReference && i.issuetype === "Epic"
              ));
          if (issueOwnsFixVersion(newIssue.issuetype, linked)) {
            newIssue.selectedRelease =
              bulkRelease === "CLEAR_FIELD" ? undefined : bulkRelease;
          }
        }

        return newIssue;
      }
      return issue;
    });

    onIssuesChange(updated);

    // Clear selections and bulk fields
    setSelectedIds([]);
    setBulkEpicKey("");
    setBulkPriority("");
    setBulkComponent("");
    setBulkLens("");
    setBulkSprint("");
    setBulkAssignee("");
    setBulkRelease("");
  };

  // Function to execute re-refining a single ticket using AI
  const handleExecuteReRefine = async (issue: RefinedIssue) => {
    setIsAIProcessing(true);
    setAiError(null);
    try {
      let savedDraft = "";
      try {
        const draftRes = await fetch("/api/kv/workspace/last_draft");
        if (draftRes.ok) {
          const data = await draftRes.json();
          savedDraft =
            typeof data?.value === "string"
              ? data.value
              : data?.value?.text || "";
        }
      } catch {
        // ignore
      }

      const response = await fetch("/api/refine-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: issue.summary,
          description: issue.description,
          issuetype: issue.issuetype,
          customPrompt: reRefinePrompt,
          draftText: savedDraft,
          model: selectedModel,
          provider: aiProvider,
        }),
      });

      const data = await response.json();
      if (response.ok && data) {
        // Update the issue in list state
        const updated = issues.map((iss) => {
          if (iss.id === issue.id) {
            return {
              ...iss,
              summary: data.summary || iss.summary,
              description: data.description || iss.description,
              selectedPriority: data.suggestedPriority || iss.selectedPriority,
              selectedComponent:
                data.suggestedComponent || iss.selectedComponent,
            };
          }
          return iss;
        });
        onIssuesChange(updated);
        setReRefiningId(null);
        setReRefinePrompt("");
      } else {
        setAiError(data.error || "Failed to refine with AI");
      }
    } catch (err: any) {
      setAiError(err.message || "An unexpected error occurred");
    } finally {
      setIsAIProcessing(false);
    }
  };

  // Function to load/fetch a Jira ticket from server
  const handleLoadJiraIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loadJiraKey.trim()) return;
    setLoadingJiraIssue(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/jira/fetch-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: loadJiraKey.trim().toUpperCase(),
        }),
      });
      const data = await response.json();
      if (response.ok && data.success && data.issue) {
        const newIssue: RefinedIssue = {
          id: `loaded-${Date.now()}`,
          summary: data.issue.summary,
          description: data.issue.description,
          issuetype: data.issue.issuetype as "Epic" | "Story" | "Bug",
          status: "draft", // Load as draft so they can edit or review
          createdKey: data.issue.key, // Save key so we can update it
          selectedPriority: data.issue.priority || "Medium",
          selectedComponent: data.issue.component || undefined,
          selectedAssignee: data.issue.assignee || undefined,
          selectedLens: isIssueLens(data.issue.selectedLens)
            ? data.issue.selectedLens
            : undefined,
        };
        onIssuesChange([newIssue, ...issues]);
        setLoadJiraKey("");
        setShowLoadPanel(false);
      } else {
        setLoadError(
          data.error ||
            ("یافتن تیکت ناموفق بود")
        );
      }
    } catch (err: any) {
      setLoadError(err.message || "An error occurred while fetching.");
    } finally {
      setLoadingJiraIssue(false);
    }
  };

  // Single issue publish helper (supporting create and update)
  const publishSingleIssue = async (
    issueId: string,
    currentIssues: RefinedIssue[]
  ) => {
    const updatedIssues = [...currentIssues];
    const index = updatedIssues.findIndex((i) => i.id === issueId);
    if (index === -1) return;

    const targetIssue = updatedIssues[index];

    if (
      targetIssue.issuetype === "Story" &&
      !isStoryLens(targetIssue.selectedLens)
    ) {
      updatedIssues[index].status = "failed";
      updatedIssues[index].error = t.lensRequired;
      onIssuesChange([...updatedIssues]);
      toast.error(t.lensRequired);
      return { success: false, error: t.lensRequired };
    }

    // Determine parent Epic Key
    let epicKey = targetIssue.selectedEpicKey;
    let linkedToDraftEpic = false;
    if (!epicKey && targetIssue.epicReference) {
      const parentEpic = updatedIssues.find(
        (i) => i.id === targetIssue.epicReference && i.issuetype === "Epic"
      );
      if (parentEpic?.createdKey) {
        epicKey = parentEpic.createdKey;
      } else if (parentEpic) {
        linkedToDraftEpic = true;
      }
    }

    if (linkedToDraftEpic) {
      const msg = "اول اپیک را منتشر کنید، بعد استوری را.";
      updatedIssues[index].status = "failed";
      updatedIssues[index].error = msg;
      onIssuesChange([...updatedIssues]);
      toast.error(msg);
      return { success: false, error: msg };
    }

    const hasEpicLink = Boolean(epicKey);
    const releaseForPublish = hasEpicLink
      ? ""
      : targetIssue.selectedRelease || "";
    const fvError = fixVersionValidationError({
      issuetype: targetIssue.issuetype,
      hasEpicLink,
      selectedRelease: releaseForPublish,
    });
    if (fvError) {
      updatedIssues[index].status = "failed";
      updatedIssues[index].error = fvError;
      onIssuesChange([...updatedIssues]);
      toast.error(fvError);
      return { success: false, error: fvError };
    }

    updatedIssues[index].status = "creating";
    updatedIssues[index].error = undefined;
    onIssuesChange([...updatedIssues]);

    const isUpdate = !!targetIssue.createdKey;
    const endpoint = isUpdate
      ? "/api/jira/update-issue"
      : "/api/jira/create-issue";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: targetIssue.createdKey, // only used for update-issue
          issue: {
            summary: targetIssue.summary,
            description: targetIssue.description,
            issuetype: targetIssue.issuetype,
            epicKey,
            selectedComponent: targetIssue.selectedComponent,
            selectedAssignee: targetIssue.selectedAssignee,
            selectedSprint: targetIssue.selectedSprint,
            selectedRelease: hasEpicLink
              ? ""
              : targetIssue.selectedRelease,
            selectedPriority: targetIssue.selectedPriority,
            selectedLens:
              targetIssue.issuetype === "Epic"
                ? targetIssue.selectedLens ?? ""
                : targetIssue.selectedLens,
          },
        }),
      });

      const data = await response.json();
      const freshIssues = [...updatedIssues];
      const freshIndex = freshIssues.findIndex((i) => i.id === issueId);

      if (response.ok && data.success) {
        freshIssues[freshIndex].status = "success";
        freshIssues[freshIndex].createdKey = isUpdate
          ? targetIssue.createdKey
          : data.key;
      } else {
        freshIssues[freshIndex].status = "failed";
        freshIssues[freshIndex].error =
          data.error ||
          (isUpdate ? "Failed to update issue." : "Failed to create issue.");
      }
      onIssuesChange([...freshIssues]);
      return data;
    } catch (err: any) {
      const freshIssues = [...updatedIssues];
      const freshIndex = freshIssues.findIndex((i) => i.id === issueId);
      freshIssues[freshIndex].status = "failed";
      freshIssues[freshIndex].error = err.message || "Network Error";
      onIssuesChange([...freshIssues]);
      throw err;
    }
  };

  // Bulk publish: epics first, then stories/bugs with resolved epic keys
  const handleBulkPublish = async () => {
    if (!jiraConnected) return;
    setBulkPublishing(true);
    let stateIssues = [...issues];

    try {
      const epics = stateIssues.filter(
        (i) => i.issuetype === "Epic" && i.status !== "success"
      );
      for (const epic of epics) {
        try {
          const result = await publishSingleIssue(epic.id, stateIssues);
          if (result && result.success && result.key) {
            stateIssues = stateIssues.map((i) =>
              i.id === epic.id
                ? { ...i, status: "success", createdKey: result.key }
                : i
            );
          }
        } catch (e) {
          console.error("Failed to publish Epic:", epic.summary, e);
        }
      }

      // Point child issues at newly created epic keys before publishing
      stateIssues = stateIssues.map((i) => {
        if (
          (i.issuetype !== "Story" && i.issuetype !== "Bug") ||
          i.selectedEpicKey ||
          !i.epicReference
        ) {
          return i;
        }
        const parent = stateIssues.find(
          (e) => e.id === i.epicReference && e.issuetype === "Epic"
        );
        if (parent?.createdKey) {
          return {
            ...i,
            selectedEpicKey: parent.createdKey,
            selectedRelease: undefined,
          };
        }
        return i;
      });
      onIssuesChange(stateIssues);

      const children = stateIssues.filter(
        (i) =>
          (i.issuetype === "Story" || i.issuetype === "Bug") &&
          i.status !== "success"
      );
      for (const child of children) {
        try {
          const result = await publishSingleIssue(child.id, stateIssues);
          if (result && result.success && result.key) {
            stateIssues = stateIssues.map((i) =>
              i.id === child.id
                ? { ...i, status: "success", createdKey: result.key }
                : i
            );
          }
        } catch (e) {
          console.error("Failed to publish child:", child.summary, e);
        }
      }
    } catch (err) {
      console.error("Bulk publish error", err);
    } finally {
      setBulkPublishing(false);
    }
  };

  const handleEditClick = (issue: RefinedIssue) => {
    setEditingId(issue.id);
    setEditForm({
      summary: issue.summary,
      description: issue.description,
      selectedComponent: issue.selectedComponent || "",
      selectedAssignee: issue.selectedAssignee || "",
      selectedSprint: issue.selectedSprint || "",
      selectedRelease: issue.selectedRelease || "",
      selectedPriority: issue.selectedPriority || "Medium",
      selectedLens: issue.selectedLens || "",
      issuetype: issue.issuetype,
    });
  };

  const handleSaveEdit = (id: string) => {
    if (editForm.selectedAssignee) {
      trackAssigneeUsage(editForm.selectedAssignee);
    }
    const updated = issues.map((issue) => {
      if (issue.id === id) {
        const parentEpic = issue.epicReference
          ? issues.find(
              (i) => i.id === issue.epicReference && i.issuetype === "Epic"
            )
          : undefined;
        const linked = Boolean(issue.selectedEpicKey || parentEpic);
        const ownsRelease = issueOwnsFixVersion(editForm.issuetype, linked);
        return {
          ...issue,
          summary: editForm.summary,
          description: editForm.description,
          issuetype: editForm.issuetype,
          selectedComponent: editForm.selectedComponent || undefined,
          selectedAssignee: editForm.selectedAssignee || undefined,
          selectedSprint: editForm.selectedSprint || undefined,
          selectedRelease: ownsRelease
            ? editForm.selectedRelease || undefined
            : undefined,
          selectedPriority: editForm.selectedPriority || undefined,
          selectedLens:
            editForm.issuetype === "Story" && isStoryLens(editForm.selectedLens)
              ? editForm.selectedLens
              : editForm.issuetype === "Epic" &&
                  isIssueLens(editForm.selectedLens)
                ? editForm.selectedLens
                : undefined,
        };
      }
      return issue;
    });
    onIssuesChange(updated);
    setEditingId(null);
  };

  const handleEpicLinkOverride = (issueId: string, epicKey: string) => {
    const updated = issues.map((issue) => {
      if (issue.id === issueId) {
        return {
          ...issue,
          selectedEpicKey: epicKey || undefined,
          selectedRelease: epicKey ? undefined : issue.selectedRelease,
        };
      }
      return issue;
    });
    onIssuesChange(updated);
  };

  const filteredIssues = issues.filter((issue) => {
    if (filter === "epics") return issue.issuetype === "Epic";
    if (filter === "stories") return issue.issuetype === "Story";
    if (filter === "bugs") return issue.issuetype === "Bug";
    return true;
  });

  const selectableIssues = filteredIssues.filter((i) => i.status !== "success");

  const getJiraBrowseUrl = (key: string) => {
    const baseUrl = (jiraUrl || "").trim().replace(/\/+$/, "");
    return `${baseUrl}/browse/${key}`;
  };

  return (
    <div className="flex flex-col gap-4" id="refined-board-panel">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-2.5">
              <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                <Layers className="size-4" />
              </div>
              <div>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.subtitle}</CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={2}
                value={[filter]}
                onValueChange={(v) =>
                  setFilter((v[0] as typeof filter) ?? "all")
                }
              >
                <ToggleGroupItem value="all">{t.filterAll}</ToggleGroupItem>
                <ToggleGroupItem value="epics">{t.filterEpics}</ToggleGroupItem>
                <ToggleGroupItem value="stories">
                  {t.filterStories}
                </ToggleGroupItem>
                <ToggleGroupItem value="bugs">{t.filterBugs}</ToggleGroupItem>
              </ToggleGroup>

              {jiraConnected && (
                <Button
                  type="button"
                  size="sm"
                  variant={showLoadPanel ? "secondary" : "outline"}
                  onClick={() => {
                    setShowLoadPanel(!showLoadPanel);
                    setLoadError(null);
                  }}
                  aria-label={
                    "بارگذاری تیکت موجود با شناسه"
                  }
                >
                  <RefreshCw data-icon="inline-start" />
                  {"بارگذاری تیکت با شناسه"}
                </Button>
              )}

              {issues.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  disabled={bulkPublishing || !jiraConnected}
                  onClick={handleBulkPublish}
                >
                  {bulkPublishing ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Play data-icon="inline-start" className="fill-current" />
                  )}
                  {bulkPublishing ? t.publishingAll : t.bulkCreate}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {(showLoadPanel ||
          (issues.length > 0 && !jiraConnected) ||
          (issues.length > 0 && jiraConnected)) && (
          <CardContent className="flex flex-col gap-3">
            {showLoadPanel && (
              <form
                onSubmit={handleLoadJiraIssue}
                className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-end"
              >
                <FieldGroup className="flex-1 gap-0">
                  <Field>
                    <FieldLabel htmlFor="load-jira-key">
                      {"کلید یا شناسه تیکت جیرا"}
                    </FieldLabel>
                    <Input
                      id="load-jira-key"
                      required
                      type="text"
                      placeholder="PROJ-123"
                      value={loadJiraKey}
                      onChange={(e) => setLoadJiraKey(e.target.value)}
                      className="font-mono"
                      disabled={loadingJiraIssue}
                    />
                  </Field>
                </FieldGroup>
                <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowLoadPanel(false);
                      setLoadError(null);
                    }}
                    disabled={loadingJiraIssue}
                  >
                    {"انصراف"}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loadingJiraIssue || !loadJiraKey.trim()}
                  >
                    {loadingJiraIssue ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        {t.loading}
                      </>
                    ) : (
                      <>{"بارگذاری و شروع بازبینی"}</>
                    )}
                  </Button>
                </div>
                {loadError && (
                  <Alert variant="destructive" className="w-full">
                    <AlertCircle />
                    <AlertTitle>
                      {"خطا"}
                    </AlertTitle>
                    <AlertDescription>{loadError}</AlertDescription>
                  </Alert>
                )}
              </form>
            )}

            {issues.length > 0 && !jiraConnected && (
              <Alert>
                <AlertCircle />
                <AlertTitle>
                  {"اتصال جیرا لازم است"}
                </AlertTitle>
                <AlertDescription>
                  {"متغیرهای JIRA_* را تنظیم کنید و صفحه Health را باز کنید."}
                </AlertDescription>
              </Alert>
            )}

            {issues.length > 0 && jiraConnected && (
              <Alert>
                <HelpCircle />
                <AlertDescription>{t.linkHelp}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>

      {/* Empty State */}
      {filteredIssues.length === 0 && (
        <Empty
          id="board-empty-state"
          className="border border-dashed bg-card"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers2 />
            </EmptyMedia>
            <EmptyTitle>
              {"تیکتی یافت نشد"}
            </EmptyTitle>
            <EmptyDescription>{t.emptyState}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Bulk Selection and Action Controls Panel */}
      {filteredIssues.length > 0 && selectableIssues.length > 0 && (
        <Card className="bg-muted/40">
          <CardContent className="flex flex-col gap-4 pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex select-none items-center gap-2.5">
                <input
                  type="checkbox"
                  id="select-all-checkbox"
                  checked={
                    selectedIds.length > 0 &&
                    selectedIds.length === selectableIssues.length
                  }
                  onChange={() => toggleSelectAll(selectableIssues)}
                  className="size-4 cursor-pointer accent-primary"
                />
                <label
                  htmlFor="select-all-checkbox"
                  className="cursor-pointer text-xs font-semibold text-foreground"
                >
                  {`انتخاب همه (${selectedIds.length} از ${selectableIssues.length} تیکت قابل ویرایش انتخاب شده است)`}
                </label>
              </div>

              {selectedIds.length > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => setSelectedIds([])}
                >
                  {"لغو انتخاب‌ها"}
                </Button>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-primary">
                  <Sparkles className="size-4" />
                  <span className="text-xs font-bold">
                    {"اعمال گروهی مقادیر به تیکت‌های انتخاب شده"}
                  </span>
                </div>

                <FieldGroup className="gap-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Field>
                      <FieldLabel>
                        {"اتصال به اپیک"}
                      </FieldLabel>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            options={[
                              {
                                value: "",
                                label: "تغییر داده نشود",
                              },
                              {
                                value: "CLEAR_FIELD",
                                label: "پاک کردن اتصال اپیک",
                              },
                              ...existingEpics.map((epic) => ({
                                value: epic.key,
                                label: `${epic.key} - ${epic.summary}`,
                              })),
                            ]}
                            value={bulkEpicKey}
                            onChange={(val) => setBulkEpicKey(val)}
                            showSearch={true}
                            />
                        </div>
                        {jiraConnected && existingEpics.length === 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={fetchingEpics}
                            onClick={onFetchEpics}
                            aria-label={"بارگذاری اپیک‌ها"}
                          >
                            {fetchingEpics ? (
                              <Spinner />
                            ) : (
                              <RefreshCw />
                            )}
                          </Button>
                        )}
                      </div>
                      {jiraConnected && (
                        <div className="mt-1 flex items-center gap-1 text-[10px]">
                          <span className="text-muted-foreground">
                            {"شناسه مستقیم:"}
                          </span>
                          <Input
                            type="text"
                            placeholder="PROJ-123"
                            value={
                              bulkEpicKey === "CLEAR_FIELD" ? "" : bulkEpicKey
                            }
                            onChange={(e) =>
                              setBulkEpicKey(e.target.value.trim().toUpperCase())
                            }
                            className="h-7 flex-1 text-center font-mono text-[10px]"
                          />
                        </div>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel>
                        {"اولویت"}
                      </FieldLabel>
                      <SearchableSelect
                        options={[
                          {
                            value: "",
                            label: "تغییر داده نشود",
                          },
                          ...["Highest", "High", "Medium", "Low", "Lowest"].map(
                            (p) => ({
                              value: p,
                              label: priorityLabels[p] || p,
                            })
                          ),
                        ]}
                        value={bulkPriority}
                        onChange={(val) => setBulkPriority(val)}
                        />
                    </Field>

                    <Field>
                      <FieldLabel>
                        {"کامپوننت"}
                      </FieldLabel>
                      <SearchableSelect
                        options={[
                          {
                            value: "",
                            label: "تغییر داده نشود",
                          },
                          {
                            value: "CLEAR_FIELD",
                            label: "پاک کردن کامپوننت",
                          },
                          ...availableComponents.map((comp) => ({
                            value: comp,
                            label: comp,
                          })),
                        ]}
                        value={bulkComponent}
                        onChange={(val) => setBulkComponent(val)}
                        showSearch={true}
                        />
                    </Field>

                    <Field>
                      <FieldLabel>{t.lens}</FieldLabel>
                      <SearchableSelect
                        options={[
                          {
                            value: "",
                            label: "تغییر داده نشود",
                          },
                          {
                            value: "CLEAR_FIELD",
                            label: t.lensNone,
                          },
                          ...EPIC_LENS_OPTIONS.map((o) => ({
                            value: o.value,
                            label: o.labelFa,
                            sublabel: o.jiraLabel,
                          })),
                        ]}
                        value={bulkLens}
                        onChange={(val) => setBulkLens(val)}
                      />
                    </Field>

                    {jiraConnected && (
                      <Field>
                        <FieldLabel>
                          {"اسپرینت"}
                        </FieldLabel>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={[
                                {
                                  value: "",
                                  label: "تغییر داده نشود",
                                },
                                {
                                  value: "CLEAR_FIELD",
                                  label: "انتقال به بکلاگ (بدون اسپرینت)",
                                },
                                ...availableSprints.map((sprint) => ({
                                  value: String(sprint.id),
                                  label: sprint.name,
                                  sublabel: `${sprint.boardName ? `[${sprint.boardName}] ` : ""}(${sprint.state})`,
                                })),
                              ]}
                              value={bulkSprint}
                              onChange={(val) => setBulkSprint(val)}
                              showSearch={true}
                              />
                          </div>
                          {availableSprints.length === 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              disabled={fetchingSprints}
                              onClick={onFetchSprints}
                              aria-label={
                                "بارگذاری اسپرینت‌ها"
                              }
                            >
                              {fetchingSprints ? (
                                <Spinner />
                              ) : (
                                <RefreshCw />
                              )}
                            </Button>
                          )}
                        </div>
                      </Field>
                    )}

                    {jiraConnected && (
                      <Field>
                        <FieldLabel>
                          {"مسئول (Assignee)"}
                        </FieldLabel>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={[
                                {
                                  value: "",
                                  label: "تغییر داده نشود",
                                },
                                {
                                  value: "CLEAR_FIELD",
                                  label: "بدون مسئول (Unassigned)",
                                },
                                ...getSortedUsers(availableUsers).map(
                                  (user) => ({
                                    value: user.name,
                                    label: user.displayName,
                                    avatar: user.avatarUrls?.["24x24"],
                                  })
                                ),
                              ]}
                              value={bulkAssignee}
                              onChange={(val) => setBulkAssignee(val)}
                              showSearch={true}
                              />
                          </div>
                          {availableUsers.length === 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              disabled={fetchingUsers}
                              onClick={onFetchUsers}
                              aria-label={
                                "بارگذاری کاربران"
                              }
                            >
                              {fetchingUsers ? <Spinner /> : <RefreshCw />}
                            </Button>
                          )}
                        </div>
                      </Field>
                    )}

                    {jiraConnected && (
                      <Field>
                        <FieldLabel>
                          {"ریلیز / نسخه"}
                        </FieldLabel>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={[
                                {
                                  value: "",
                                  label: "تغییر داده نشود",
                                },
                                {
                                  value: "CLEAR_FIELD",
                                  label: "پاک کردن ریلیز",
                                },
                                ...selectableFixVersions(availableVersions).map(
                                  (version) => ({
                                    value: version.id,
                                    label: version.name,
                                  })
                                ),
                              ]}
                              value={bulkRelease}
                              onChange={(val) => setBulkRelease(val)}
                              showSearch={true}
                              />
                          </div>
                          {availableVersions.length === 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              disabled={fetchingVersions}
                              onClick={onFetchVersions}
                              aria-label={
                                "بارگذاری ریلیزها"
                              }
                            >
                              {fetchingVersions ? (
                                <Spinner />
                              ) : (
                                <RefreshCw />
                              )}
                            </Button>
                          )}
                        </div>
                      </Field>
                    )}
                  </div>
                </FieldGroup>

                <Separator />
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={handleApplyBulkChanges}>
                    <Check data-icon="inline-start" />
                    {`اعمال تغییرات روی ${selectedIds.length} تیکت`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Issue Cards */}
      <div className="flex flex-col gap-3.5">
        {filteredIssues.map((issue) => {
          const isEditing = editingId === issue.id;
          const isEpic = issue.issuetype === "Epic";

          let parentEpicDraft: RefinedIssue | undefined;
          if (issue.epicReference) {
            parentEpicDraft = issues.find(
              (i) => i.id === issue.epicReference && i.issuetype === "Epic"
            );
          }

          const hasEpicLink = Boolean(
            issue.selectedEpicKey || parentEpicDraft
          );
          const showRelease = issueOwnsFixVersion(
            issue.issuetype,
            hasEpicLink
          );

          return (
            <IssueCard
              key={issue.id}
              className={cn(
                "cv-auto transition-[color,background-color,border-color,box-shadow,opacity] duration-200",
                issue.status === "success" && "ring-success/40",
                issue.status === "failed" && "ring-destructive/40",
                isEpic &&
                  issue.status !== "success" &&
                  issue.status !== "failed" &&
                  "ring-primary/25"
              )}
            >
              <div id={`issue-card-${issue.id}`} className="sr-only" />
              <IssueCardHeader
                title={issue.summary}
                leading={
                  issue.status !== "success" ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(issue.id)}
                      onChange={() => toggleSelectIssue(issue.id)}
                      className="size-4 cursor-pointer accent-primary"
                      aria-label={issue.summary}
                    />
                  ) : undefined
                }
                badges={
                  <>
                    {issue.status === "success" && issue.createdKey ? (
                      <IssueKeyLink
                        href={getJiraBrowseUrl(issue.createdKey)}
                        issueKey={issue.createdKey}
                      />
                    ) : (
                      <Badge variant="secondary" className="font-mono">
                        #{issue.id}
                      </Badge>
                    )}
                    <Badge className={getIssueTypeBadgeClass(issue.issuetype)}>
                      {issue.issuetype === "Epic" ? (
                        <Layers data-icon="inline-start" />
                      ) : issue.issuetype === "Bug" ? (
                        <AlertCircle data-icon="inline-start" />
                      ) : (
                        <FileText data-icon="inline-start" />
                      )}
                      {issue.issuetype === "Epic"
                        ? t.epic
                        : issue.issuetype === "Bug"
                          ? t.bug
                          : t.story}
                    </Badge>
                    <Badge
                      variant={getPriorityBadgeStyles(issue.selectedPriority)}
                    >
                      {priorityLabels[
                        issue.selectedPriority || "Medium"
                      ] ||
                        issue.selectedPriority ||
                        "Medium"}
                    </Badge>
                    {(issue.issuetype === "Story" ||
                      issue.issuetype === "Epic") &&
                    issue.selectedLens ? (
                      <Badge variant="outline">
                        {lensDisplayLabel(issue.selectedLens)}
                      </Badge>
                    ) : null}
                    {issue.status === "success" && issue.createdKey ? (
                      <Badge variant="success">
                        <CheckCircle2 data-icon="inline-start" />
                        OK
                      </Badge>
                    ) : null}
                    {issue.status === "creating" ? (
                      <Badge variant="warning">
                        <Spinner data-icon="inline-start" />
                        {t.creating}
                      </Badge>
                    ) : null}
                  </>
                }
              />
              <IssueCardFooter
                actions={
                  <>
                    {!isEditing && issue.status !== "success" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          reRefiningId === issue.id ? "secondary" : "ghost"
                        }
                        onClick={() => {
                          if (reRefiningId === issue.id) {
                            setReRefiningId(null);
                          } else {
                            setReRefiningId(issue.id);
                            setReRefinePrompt("");
                            setAiError(null);
                          }
                        }}
                        aria-label={
                          "بازبینی با هوش مصنوعی"
                        }
                      >
                        <Sparkles data-icon="inline-start" />
                        <span className="hidden sm:inline">
                          {"بازبینی مجدد"}
                        </span>
                      </Button>
                    ) : null}

                    {!isEditing && issue.status !== "success" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditClick(issue)}
                        aria-label={t.edit}
                      >
                        <Edit2 data-icon="inline-start" />
                        <span className="hidden sm:inline">{t.edit}</span>
                      </Button>
                    ) : null}

                    {jiraConnected &&
                    issue.status !== "success" &&
                    !isEditing ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          issue.status === "creating" || bulkPublishing
                        }
                        onClick={() => publishSingleIssue(issue.id, issues)}
                      >
                        {issue.status === "creating" ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <ArrowUpRight data-icon="inline-start" />
                        )}
                        {issue.createdKey
                          ? "به‌روزرسانی در جیرا"
                          : issue.status === "failed"
                            ? t.rePublish
                            : t.createInJira}
                      </Button>
                    ) : null}

                    {issue.status === "success" && issue.createdKey ? (
                      <a
                        href={getJiraBrowseUrl(issue.createdKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "bg-success text-success-foreground hover:bg-success/90"
                        )}
                      >
                        {"مشاهده در جیرا"}
                        <ExternalLink data-icon="inline-end" />
                      </a>
                    ) : null}
                  </>
                }
              />

              <div className="mt-2 flex flex-col gap-4 border-t border-border/60 pt-4">                {isEditing ? (
                  <FieldGroup className="gap-3.5">
                    <Field>
                      <FieldLabel htmlFor={`summary-${issue.id}`}>
                        {t.summary}
                      </FieldLabel>
                      <Input
                        id={`summary-${issue.id}`}
                        type="text"
                        value={editForm.summary}
                        onChange={(e) =>
                          setEditForm({ ...editForm, summary: e.target.value })
                        }
                        dir="auto"
                      />
                    </Field>

                    <Field>
                      <FieldLabel>{t.issueType}</FieldLabel>
                      <SearchableSelect
                        options={[
                          { value: "Epic", label: t.epic },
                          { value: "Story", label: t.story },
                          { value: "Bug", label: t.bug },
                        ]}
                        value={editForm.issuetype}
                        onChange={(val) =>
                          setEditForm({
                            ...editForm,
                            issuetype: val as "Epic" | "Story" | "Bug",
                            selectedLens:
                              val === "Story" || val === "Epic"
                                ? val === "Story" &&
                                  editForm.selectedLens === "mixed"
                                  ? ""
                                  : editForm.selectedLens
                                : "",
                          })
                        }
                        />
                    </Field>

                    {(editForm.issuetype === "Story" ||
                      editForm.issuetype === "Epic") && (
                      <Field>
                        <FieldLabel>{t.lens}</FieldLabel>
                        <SearchableSelect
                          options={[
                            { value: "", label: t.lensNone },
                            ...(editForm.issuetype === "Epic"
                              ? EPIC_LENS_OPTIONS
                              : LENS_OPTIONS
                            ).map((o) => ({
                              value: o.value,
                              label: o.labelFa,
                              sublabel: o.jiraLabel,
                            })),
                          ]}
                          value={editForm.selectedLens || ""}
                          onChange={(val) =>
                            setEditForm({
                              ...editForm,
                              selectedLens: (val || "") as IssueLens | "",
                            })
                          }
                          />
                      </Field>
                    )}

                    <Field>
                      <FieldLabel htmlFor={`description-${issue.id}`}>
                        {t.description}
                      </FieldLabel>
                      <Textarea
                        id={`description-${issue.id}`}
                        className="min-h-44 text-xs"
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            description: e.target.value,
                          })
                        }
                        dir="auto"
                      />
                    </Field>

                    <Field>
                      <FieldLabel>
                        {"اولویت (Priority)"}
                      </FieldLabel>
                      <SearchableSelect
                        options={[
                          "Highest",
                          "High",
                          "Medium",
                          "Low",
                          "Lowest",
                        ].map((p) => ({
                          value: p,
                          label: priorityLabels[p] || p,
                        }))}
                        value={editForm.selectedPriority || "Medium"}
                        onChange={(val) =>
                          setEditForm({ ...editForm, selectedPriority: val })
                        }
                        />
                    </Field>

                    {availableComponents.length > 0 && (
                      <Field>
                        <FieldLabel>
                          {"کامپوننت جیرا"}
                        </FieldLabel>
                        <SearchableSelect
                          options={[
                            {
                              value: "",
                              label: "بدون کامپوننت",
                            },
                            ...availableComponents.map((comp) => ({
                              value: comp,
                              label: comp,
                            })),
                          ]}
                          value={editForm.selectedComponent || ""}
                          onChange={(val) =>
                            setEditForm({
                              ...editForm,
                              selectedComponent: val,
                            })
                          }
                          showSearch={true}
                          />
                      </Field>
                    )}

                    {jiraConnected && (
                      <Field>
                        <FieldLabel>
                          {"مسئول (Assignee)"}
                        </FieldLabel>
                        {fetchingUsers ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <Spinner />
                            <span className="text-xs text-muted-foreground">
                              {t.loadingUsers}
                            </span>
                          </div>
                        ) : (
                          <SearchableSelect
                            options={[
                              {
                                value: "",
                                label: "تخصیص داده نشده",
                              },
                              ...getSortedUsers(availableUsers).map((user) => {
                                const storedFreq = assigneeFrequencyCache;
                                const freqVal = storedFreq[user.name] || 0;
                                return {
                                  value: user.name,
                                  label: user.displayName,
                                  sublabel:
                                    freqVal > 0
                                      ? `${"پرکاربرد"} (${freqVal})`
                                      : user.name,
                                  avatar: user.avatarUrls?.["24x24"],
                                };
                              }),
                            ]}
                            value={editForm.selectedAssignee || ""}
                            onChange={(val) =>
                              setEditForm({
                                ...editForm,
                                selectedAssignee: val,
                              })
                            }
                            showSearch={true}
                            />
                        )}
                      </Field>
                    )}

                    {jiraConnected && showRelease && (
                      <Field>
                        <FieldLabel>
                          {"ریلیز (Fix Version)"}
                        </FieldLabel>
                        {fetchingVersions ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <Spinner />
                            <span className="text-xs text-muted-foreground">
                              {t.loadingVersions}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <SearchableSelect
                                options={[
                                  {
                                    value: "",
                                    label: "انتخاب نشده",
                                  },
                                  ...selectableFixVersions(availableVersions, {
                                    includeId: editForm.selectedRelease,
                                  }).map((version) => ({
                                    value: version.id,
                                    label: version.name,
                                    sublabel: version.released
                                      ? `(${"منتشر شده"})`
                                      : "",
                                  })),
                                ]}
                                value={editForm.selectedRelease || ""}
                                onChange={(val) =>
                                  setEditForm({
                                    ...editForm,
                                    selectedRelease: val,
                                  })
                                }
                                showSearch={true}
                                />
                            </div>
                            {availableVersions.length === 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={fetchingVersions}
                                onClick={onFetchVersions}
                                aria-label={
                                  "دریافت مجدد نسخه‌ها"
                                }
                              >
                                {fetchingVersions ? (
                                  <Spinner />
                                ) : (
                                  <RefreshCw />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </Field>
                    )}

                    {jiraConnected && !showRelease && !isEpic && (
                      <p className="text-xs text-muted-foreground">
                        {t.releaseHintUnderEpic}
                      </p>
                    )}

                    {jiraConnected && !isEpic && (
                      <Field>
                        <FieldLabel>
                          {"اسپرینت (Sprint)"}
                        </FieldLabel>
                        {fetchingSprints ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <Spinner />
                            <span className="text-xs text-muted-foreground">
                              {t.loadingSprints}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <SearchableSelect
                                options={[
                                  {
                                    value: "",
                                    label: "تخصیص داده نشده (بکلاگ)",
                                  },
                                  ...availableSprints.map((sprint) => ({
                                    value: String(sprint.id),
                                    label: sprint.name,
                                    sublabel: `${sprint.boardName ? `[${sprint.boardName}] ` : ""}(${sprint.state})`,
                                  })),
                                ]}
                                value={editForm.selectedSprint || ""}
                                onChange={(val) =>
                                  setEditForm({
                                    ...editForm,
                                    selectedSprint: val,
                                  })
                                }
                                showSearch={true}
                                />
                            </div>
                            {availableSprints.length === 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={fetchingSprints}
                                onClick={onFetchSprints}
                                aria-label={
                                  "دریافت مجدد اسپرینت‌ها"
                                }
                              >
                                {fetchingSprints ? (
                                  <Spinner />
                                ) : (
                                  <RefreshCw />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </Field>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        {t.cancel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveEdit(issue.id)}
                      >
                        <Check data-icon="inline-start" />
                        {t.save}
                      </Button>
                    </div>
                  </FieldGroup>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {!isEpic && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="font-medium text-muted-foreground">
                          {parentEpicDraft ? (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block size-2 rounded-full bg-primary" />
                              {t.epicLink}{" "}
                              <strong className="font-semibold text-foreground">
                                #{issue.epicReference}
                              </strong>{" "}
                              ({parentEpicDraft.summary})
                            </span>
                          ) : issue.selectedEpicKey ? (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block size-2 rounded-full bg-success" />
                              {"لینک شده به اپیک موجود:"}{" "}
                              <Badge variant="success" className="font-mono">
                                {issue.selectedEpicKey}
                              </Badge>
                            </span>
                          ) : (
                            <span className="font-normal italic text-muted-foreground">
                              {t.noEpicLink}
                            </span>
                          )}
                        </div>

                        {jiraConnected && issue.status !== "success" && (
                          <div className="flex min-w-[220px] flex-wrap items-center gap-2.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {t.existingEpics}
                            </span>
                            <div className="min-w-[150px] flex-1">
                              <SearchableSelect
                                options={[
                                  {
                                    value: "",
                                    label: "انتخاب نشده",
                                  },
                                  ...existingEpics.map((epic) => ({
                                    value: epic.key,
                                    label: `${epic.key} - ${epic.summary}`,
                                  })),
                                ]}
                                value={issue.selectedEpicKey || ""}
                                onChange={(val) =>
                                  handleEpicLinkOverride(issue.id, val)
                                }
                                showSearch={true}
                                />
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {"یا شناسه:"}
                              </span>
                              <Input
                                type="text"
                                placeholder="PROJ-123"
                                value={issue.selectedEpicKey || ""}
                                onChange={(e) =>
                                  handleEpicLinkOverride(
                                    issue.id,
                                    e.target.value.trim().toUpperCase()
                                  )
                                }
                                className="h-7 w-24 text-center font-mono text-[11px]"
                              />
                            </div>
                            {existingEpics.length === 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={fetchingEpics}
                                onClick={onFetchEpics}
                                aria-label={
                                  "بارگذاری اپیک‌های موجود جیرا"
                                }
                              >
                                {fetchingEpics ? <Spinner /> : <RefreshCw />}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {(issue.issuetype === "Story" ||
                      issue.issuetype === "Epic") && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="inline-block size-2 rounded-full bg-primary" />
                          <span>
                            {t.lens}:{" "}
                            {issue.selectedLens ? (
                              <Badge variant="outline">
                                {lensDisplayLabel(issue.selectedLens)}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {t.lensNone}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {t.changeLens}
                            </span>
                            <div className="flex-1">
                              <SearchableSelect
                                options={[
                                  { value: "", label: t.lensNone },
                                  ...(issue.issuetype === "Epic"
                                    ? EPIC_LENS_OPTIONS
                                    : LENS_OPTIONS
                                  ).map((o) => ({
                                    value: o.value,
                                    label: o.labelFa,
                                    sublabel: o.jiraLabel,
                                  })),
                                ]}
                                value={issue.selectedLens || ""}
                                onChange={(val) => {
                                  const updated = issues.map((iss) =>
                                    iss.id === issue.id
                                      ? {
                                          ...iss,
                                          selectedLens: isIssueLens(val)
                                            ? val
                                            : undefined,
                                        }
                                      : iss
                                  );
                                  onIssuesChange(updated);
                                }}
                                />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                      <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                        <span className="inline-block size-2 rounded-full bg-destructive" />
                        <span>
                          {"اولویت انتخاب شده:"}{" "}
                          <Badge
                            variant={getPriorityBadgeStyles(
                              issue.selectedPriority
                            )}
                          >
                            {priorityLabels[
                              issue.selectedPriority || "Medium"
                            ] ||
                              issue.selectedPriority ||
                              "Medium"}
                          </Badge>
                        </span>
                      </div>

                      {issue.status !== "success" && (
                        <div className="flex min-w-[160px] items-center gap-1.5">
                          <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                            {"تغییر اولویت:"}
                          </span>
                          <div className="flex-1">
                            <SearchableSelect
                              options={[
                                "Highest",
                                "High",
                                "Medium",
                                "Low",
                                "Lowest",
                              ].map((p) => ({
                                value: p,
                                label: priorityLabels[p] || p,
                              }))}
                              value={issue.selectedPriority || "Medium"}
                              onChange={(val) => {
                                const updated = issues.map((iss) =>
                                  iss.id === issue.id
                                    ? { ...iss, selectedPriority: val }
                                    : iss
                                );
                                onIssuesChange(updated);
                              }}
                              />
                          </div>
                        </div>
                      )}
                    </div>

                    {availableComponents.length > 0 && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="inline-block size-2 rounded-full bg-accent-foreground" />
                          <span>
                            {"کامپوننت انتخاب شده:"}{" "}
                            {issue.selectedComponent ? (
                              <Badge variant="outline">
                                {issue.selectedComponent}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {"هیچ"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {"تغییر کامپوننت:"}
                            </span>
                            <div className="flex-1">
                              <SearchableSelect
                                options={[
                                  {
                                    value: "",
                                    label: "بدون کامپوننت",
                                  },
                                  ...availableComponents.map((comp) => ({
                                    value: comp,
                                    label: comp,
                                  })),
                                ]}
                                value={issue.selectedComponent || ""}
                                onChange={(val) => {
                                  const updated = issues.map((iss) =>
                                    iss.id === issue.id
                                      ? {
                                          ...iss,
                                          selectedComponent: val || undefined,
                                        }
                                      : iss
                                  );
                                  onIssuesChange(updated);
                                }}
                                showSearch={true}
                                />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {jiraConnected && showRelease && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="inline-block size-2 rounded-full bg-success" />
                          <span>
                            {"ریلیز انتخاب شده:"}{" "}
                            {issue.selectedRelease ? (
                              <Badge variant="outline">
                                {availableVersions.find(
                                  (v) => v.id === issue.selectedRelease
                                )?.name || issue.selectedRelease}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {"هیچ"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {"تغییر ریلیز:"}
                            </span>
                            {fetchingVersions ? (
                              <Spinner />
                            ) : (
                              <div className="flex-1">
                                <SearchableSelect
                                  options={[
                                    {
                                      value: "",
                                      label: "انتخاب نشده",
                                    },
                                    ...selectableFixVersions(availableVersions, {
                                      includeId: issue.selectedRelease,
                                    }).map((version) => ({
                                      value: version.id,
                                      label: version.name,
                                      sublabel: version.released
                                        ? `(${"منتشر شده"})`
                                        : "",
                                    })),
                                  ]}
                                  value={issue.selectedRelease || ""}
                                  onChange={(val) => {
                                    const updated = issues.map((iss) =>
                                      iss.id === issue.id
                                        ? {
                                            ...iss,
                                            selectedRelease: val || undefined,
                                          }
                                        : iss
                                    );
                                    onIssuesChange(updated);
                                  }}
                                  showSearch={true}
                                  />
                              </div>
                            )}
                            {availableVersions.length === 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={fetchingVersions}
                                onClick={onFetchVersions}
                                aria-label={
                                  "بارگذاری ریلیزها"
                                }
                              >
                                {fetchingVersions ? (
                                  <Spinner />
                                ) : (
                                  <RefreshCw />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {jiraConnected && !showRelease && !isEpic && (
                      <p className="text-xs text-muted-foreground">
                        {t.releaseHintUnderEpic}
                      </p>
                    )}

                    {jiraConnected && !isEpic && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="inline-block size-2 rounded-full bg-primary" />
                          <span>
                            {"اسپرینت انتخاب شده:"}{" "}
                            {issue.selectedSprint ? (
                              <Badge variant="outline">
                                {availableSprints.find(
                                  (s) => String(s.id) === issue.selectedSprint
                                )?.name || issue.selectedSprint}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {"بکلاگ"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {"تغییر اسپرینت:"}
                            </span>
                            {fetchingSprints ? (
                              <Spinner />
                            ) : (
                              <div className="flex-1">
                                <SearchableSelect
                                  options={[
                                    {
                                      value: "",
                                      label: "بکلاگ",
                                    },
                                    ...availableSprints.map((sprint) => ({
                                      value: String(sprint.id),
                                      label: sprint.name,
                                      sublabel: `${sprint.boardName ? `[${sprint.boardName}] ` : ""}(${sprint.state})`,
                                    })),
                                  ]}
                                  value={issue.selectedSprint || ""}
                                  onChange={(val) => {
                                    const updated = issues.map((iss) =>
                                      iss.id === issue.id
                                        ? {
                                            ...iss,
                                            selectedSprint: val || undefined,
                                          }
                                        : iss
                                    );
                                    onIssuesChange(updated);
                                  }}
                                  showSearch={true}
                                  />
                              </div>
                            )}
                            {availableSprints.length === 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={fetchingSprints}
                                onClick={onFetchSprints}
                                aria-label={
                                  "بارگذاری اسپرینت‌ها"
                                }
                              >
                                {fetchingSprints ? (
                                  <Spinner />
                                ) : (
                                  <RefreshCw />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {jiraConnected && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="inline-block size-2 rounded-full bg-warning" />
                          <span>
                            {"مسئول (Assignee):"}{" "}
                            {issue.selectedAssignee ? (
                              <Badge variant="outline">
                                {availableUsers.find(
                                  (u) => u.name === issue.selectedAssignee
                                )?.displayName || issue.selectedAssignee}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {"تخصیص داده نشده"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {"تغییر مسئول:"}
                            </span>
                            {fetchingUsers ? (
                              <Spinner />
                            ) : (
                              <div className="flex-1">
                                <SearchableSelect
                                  options={[
                                    {
                                      value: "",
                                      label: "تخصیص داده نشده",
                                    },
                                    ...getSortedUsers(availableUsers).map(
                                      (user) => {
                                        const storedFreq = assigneeFrequencyCache;
                                        const freqVal =
                                          storedFreq[user.name] || 0;
                                        return {
                                          value: user.name,
                                          label: user.displayName,
                                          sublabel:
                                            freqVal > 0
                                              ? `${"پرکاربرد"} (${freqVal})`
                                              : user.name,
                                          avatar: user.avatarUrls?.["24x24"],
                                        };
                                      }
                                    ),
                                  ]}
                                  value={issue.selectedAssignee || ""}
                                  onChange={(val) => {
                                    if (val) trackAssigneeUsage(val);
                                    const updated = issues.map((iss) =>
                                      iss.id === issue.id
                                        ? {
                                            ...iss,
                                            selectedAssignee: val || undefined,
                                          }
                                        : iss
                                    );
                                    onIssuesChange(updated);
                                  }}
                                  showSearch={true}
                                  />
                              </div>
                            )}
                            {availableUsers.length === 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={fetchingUsers}
                                onClick={onFetchUsers}
                                aria-label={
                                  "بارگذاری کاربران"
                                }
                              >
                                {fetchingUsers ? <Spinner /> : <RefreshCw />}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {reRefiningId === issue.id && (
                      <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Sparkles className="size-4 animate-pulse" />
                          <span className="text-xs font-bold">
                            {"بازبینی و اصلاح متن با هوش مصنوعی"}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {"دستور اصلاح را بنویسید."}
                        </p>
                        <Textarea
                          rows={3}
                          value={reRefinePrompt}
                          onChange={(e) => setReRefinePrompt(e.target.value)}
                          placeholder={
                            "مثال: سناریوی خطا را اضافه کن…"
                          }
                          disabled={isAIProcessing}
                        />
                        <div className="flex items-center justify-between gap-3">
                          {aiError ? (
                            <Alert variant="destructive" className="flex-1">
                              <AlertCircle />
                              <AlertDescription>{aiError}</AlertDescription>
                            </Alert>
                          ) : (
                            <span />
                          )}
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReRefiningId(null);
                                setReRefinePrompt("");
                                setAiError(null);
                              }}
                              disabled={isAIProcessing}
                            >
                              {"انصراف"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleExecuteReRefine(issue)}
                              disabled={
                                isAIProcessing || !reRefinePrompt.trim()
                              }
                            >
                              {isAIProcessing ? (
                                <Spinner data-icon="inline-start" />
                              ) : (
                                <Sparkles data-icon="inline-start" />
                              )}
                              {isAIProcessing ? t.refining : "اعمال"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      className="rounded-lg border bg-muted/30 p-3.5"
                      dir="auto"
                    >
                      <MarkdownPreview text={issue.description} />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Tag className="size-3.5 text-primary" />
                      <Badge variant="secondary">agent</Badge>
                    </div>

                    {issue.status === "failed" && issue.error && (
                      <Alert variant="destructive">
                        <AlertCircle />
                        <AlertTitle>{t.errorOccurred}</AlertTitle>
                        <AlertDescription>{issue.error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </IssueCard>
          );
        })}
      </div>
    </div>
  );
}
