"use client";

import React, { useState } from "react";
import {
  RefinedIssue,
  JiraEpic,
  Language,
  JiraUser,
  JiraVersion,
  JiraSprint,
} from "@/lib/types";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import SearchableSelect from "@/components/SearchableSelect";
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
  language: Language;
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
  en: {
    title: "Refined Board Workspace",
    subtitle:
      "Review, edit, and publish your generated Jira structures. You can create them individually or trigger a smart bulk publication.",
    bulkCreate: "Bulk Publish Structure",
    publishingAll: "Bulk publishing structure in progress...",
    filterAll: "All Tickets",
    filterEpics: "Epics Only",
    filterStories: "Stories Only",
    filterBugs: "Bugs Only",
    emptyState:
      "No refined tickets yet. Input your requirements in the left panel and click 'Refine with Gemini AI' to get started.",
    issueType: "Issue Type",
    epic: "Epic",
    story: "Story",
    bug: "Bug",
    epicLink: "Linked to Epic Draft:",
    noEpicLink: "No Epic Parent Link",
    createInJira: "Publish Ticket",
    creating: "Creating...",
    published: "Published Successfully",
    labels: "Labels",
    edit: "Edit details",
    save: "Save changes",
    cancel: "Discard",
    summary: "Ticket Summary / Title",
    description: "Detailed Description (Markdown Supported)",
    addLabel: "Add tag",
    existingEpics: "Or link to existing Jira Epic",
    linkHelp:
      "When bulk publishing, Epics are automatically created first. Then, stories are linked using the newly returned Epic keys.",
    errorOccurred: "Error:",
    rePublish: "Retry Publishing",
    noEpicsToLink: "No existing epics found. Connect to Jira to fetch.",
  },
  fa: {
    title: "محیط کار برد اصلاح شده",
    subtitle:
      "تیکت‌های سازماندهی شده را بازبینی، ویرایش و در جیرا منتشر کنید. می‌توانید تیکت‌ها را تکی منتشر کنید یا از انتشار هوشمند گروهی بهره ببرید.",
    bulkCreate: "انتشار هوشمند گروهی",
    publishingAll: "در حال انتشار خودکار و گام‌به‌گام ساختار تیکت‌ها...",
    filterAll: "همه تیکت‌ها",
    filterEpics: "فقط اپیک‌ها",
    filterStories: "فقط استوری‌ها",
    filterBugs: "فقط باگ‌ها",
    emptyState:
      "هنوز تیکتی تولید نشده است. در پنل سمت چپ پیش‌نویس‌ها را وارد کرده و دکمه ساختاربندی را بزنید.",
    issueType: "نوع تیکت",
    epic: "اپیک (Epic)",
    story: "استوری (Story)",
    bug: "باگ (Bug)",
    epicLink: "متصل به درفت اپیک:",
    noEpicLink: "بدون اتصال به اپیک والد",
    createInJira: "انتشار تیکت",
    creating: "در حال ساخت...",
    published: "با موفقیت ساخته شد",
    labels: "برچسب‌ها",
    edit: "ویرایش جزییات",
    save: "ذخیره تغییرات",
    cancel: "انصراف",
    summary: "عنوان / خلاصه تیکت",
    description: "توضیحات کامل (با پشتیبانی از مارک‌داون)",
    addLabel: "افزودن برچسب",
    existingEpics: "یا اتصال به اپیک موجود در جیرا",
    linkHelp:
      "در زمان انتشار گروهی، ابتدا اپیک‌ها ساخته می‌شوند. سپس استوری‌ها به طور خودکار به کلیدهای واقعی دریافتی متصل می‌گردند.",
    errorOccurred: "خطا در جیرا:",
    rePublish: "تلاش مجدد",
    noEpicsToLink: "اپیک موجودی در پروژه پیدا نشد. به جیرا متصل شوید.",
  },
};

const priorityLabels: Record<Language, Record<string, string>> = {
  en: {
    Highest: "Highest",
    High: "High",
    Medium: "Medium",
    Low: "Low",
    Lowest: "Lowest",
    priority: "Priority",
    changePriority: "Change Priority:",
  },
  fa: {
    Highest: "بالاترین",
    High: "بالا",
    Medium: "متوسط",
    Low: "پایین",
    Lowest: "پایین‌ترین",
    priority: "اولویت (Priority)",
    changePriority: "تغییر اولویت:",
  },
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

const getIssueTypeBadgeVariant = (
  issuetype: RefinedIssue["issuetype"]
): BadgeVariant => {
  if (issuetype === "Epic") return "default";
  if (issuetype === "Bug") return "destructive";
  return "secondary";
};

// Helper to track assignee assignment frequency in local storage
const trackAssigneeUsage = (username: string) => {
  if (!username) return;
  try {
    const stored = localStorage.getItem("jira_assignee_frequency");
    const freq = stored ? JSON.parse(stored) : {};
    freq[username] = (freq[username] || 0) + 1;
    localStorage.setItem("jira_assignee_frequency", JSON.stringify(freq));
  } catch (e) {
    console.error("Failed to track assignee frequency:", e);
  }
};

// Helper to sort users: most frequently selected first
const getSortedUsers = (users: JiraUser[]): JiraUser[] => {
  try {
    const stored = localStorage.getItem("jira_assignee_frequency");
    if (!stored) return users;
    const freq = JSON.parse(stored);
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
  language,
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
  const t = translations[language];
  const isRtl = language === "fa";

  const [filter, setFilter] = useState<"all" | "epics" | "stories" | "bugs">(
    "all"
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    summary: string;
    description: string;
    suggestedLabels: string[];
    selectedComponent?: string;
    selectedAssignee?: string;
    selectedSprint?: string;
    selectedRelease?: string;
    selectedPriority?: string;
    issuetype: "Epic" | "Story" | "Bug";
  }>({
    summary: "",
    description: "",
    suggestedLabels: [],
    selectedComponent: "",
    selectedAssignee: "",
    selectedSprint: "",
    selectedRelease: "",
    selectedPriority: "",
    issuetype: "Story",
  });
  const [newLabel, setNewLabel] = useState("");
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
        }
        if (bulkPriority !== "") {
          newIssue.selectedPriority = bulkPriority;
        }
        if (bulkComponent !== "") {
          newIssue.selectedComponent =
            bulkComponent === "CLEAR_FIELD" ? undefined : bulkComponent;
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
          newIssue.selectedRelease =
            bulkRelease === "CLEAR_FIELD" ? undefined : bulkRelease;
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
    setBulkSprint("");
    setBulkAssignee("");
    setBulkRelease("");
  };

  // Function to execute re-refining a single ticket using AI
  const handleExecuteReRefine = async (issue: RefinedIssue) => {
    setIsAIProcessing(true);
    setAiError(null);
    try {
      const savedDraft = localStorage.getItem("jira_last_draft_text") || "";
      const aiProvider =
        (localStorage.getItem("jira_ai_provider") as any) || "gemini";
      const selectedModel =
        localStorage.getItem("jira_ai_model") ||
        localStorage.getItem("jira_last_selected_model") ||
        (aiProvider === "avalai"
          ? "gpt-4o-mini"
          : aiProvider === "arvan"
            ? "Gemini-3-Flash-Preview"
            : "gemini-3.5-flash");

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
              suggestedLabels: data.suggestedLabels || iss.suggestedLabels,
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
          suggestedLabels: [],
          selectedPriority: data.issue.priority || "Medium",
          selectedComponent: data.issue.component || undefined,
          selectedAssignee: data.issue.assignee || undefined,
        };
        onIssuesChange([newIssue, ...issues]);
        setLoadJiraKey("");
        setShowLoadPanel(false);
      } else {
        setLoadError(
          data.error ||
            (isRtl ? "یافتن تیکت ناموفق بود" : "Failed to find Jira ticket.")
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

    updatedIssues[index].status = "creating";
    updatedIssues[index].error = undefined;
    onIssuesChange([...updatedIssues]);

    const targetIssue = updatedIssues[index];

    // Determine parent Epic Key
    let epicKey = targetIssue.selectedEpicKey;
    if (!epicKey && targetIssue.epicReference) {
      // Find if parent Epic was already created in this draft list
      const parentEpic = updatedIssues.find(
        (i) => i.id === targetIssue.epicReference && i.issuetype === "Epic"
      );
      if (parentEpic && parentEpic.createdKey) {
        epicKey = parentEpic.createdKey;
      }
    }

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
            suggestedLabels: targetIssue.suggestedLabels,
            epicKey,
            selectedComponent: targetIssue.selectedComponent,
            selectedAssignee: targetIssue.selectedAssignee,
            selectedSprint: targetIssue.selectedSprint,
            selectedRelease: targetIssue.selectedRelease,
            selectedPriority: targetIssue.selectedPriority,
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

  // Bulk publish implementation
  const handleBulkPublish = async () => {
    if (!jiraConnected) return;
    setBulkPublishing(true);
    let stateIssues = [...issues];

    try {
      // 1. Publish all Epics first
      const epics = stateIssues.filter(
        (i) => i.issuetype === "Epic" && i.status !== "success"
      );
      for (const epic of epics) {
        try {
          const result = await publishSingleIssue(epic.id, stateIssues);
          if (result && result.success) {
            // Re-fetch state because publishSingleIssue updates it in React
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

      // 2. Publish all Stories
      const stories = stateIssues.filter(
        (i) => i.issuetype === "Story" && i.status !== "success"
      );
      for (const story of stories) {
        try {
          await publishSingleIssue(story.id, stateIssues);
        } catch (e) {
          console.error("Failed to publish Story:", story.summary, e);
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
      suggestedLabels: issue.suggestedLabels || [],
      selectedComponent: issue.selectedComponent || "",
      selectedAssignee: issue.selectedAssignee || "",
      selectedSprint: issue.selectedSprint || "",
      selectedRelease: issue.selectedRelease || "",
      selectedPriority: issue.selectedPriority || "Medium",
      issuetype: issue.issuetype,
    });
    setNewLabel("");
  };

  const handleSaveEdit = (id: string) => {
    if (editForm.selectedAssignee) {
      trackAssigneeUsage(editForm.selectedAssignee);
    }
    const updated = issues.map((issue) => {
      if (issue.id === id) {
        return {
          ...issue,
          summary: editForm.summary,
          description: editForm.description,
          issuetype: editForm.issuetype,
          suggestedLabels: editForm.suggestedLabels,
          selectedComponent: editForm.selectedComponent || undefined,
          selectedAssignee: editForm.selectedAssignee || undefined,
          selectedSprint: editForm.selectedSprint || undefined,
          selectedRelease: editForm.selectedRelease || undefined,
          selectedPriority: editForm.selectedPriority || undefined,
        };
      }
      return issue;
    });
    onIssuesChange(updated);
    setEditingId(null);
  };

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    const cleanLabel = newLabel.trim().replace(/\s+/g, "_");
    if (!editForm.suggestedLabels.includes(cleanLabel)) {
      setEditForm({
        ...editForm,
        suggestedLabels: [...editForm.suggestedLabels, cleanLabel],
      });
    }
    setNewLabel("");
  };

  const handleRemoveLabel = (label: string) => {
    setEditForm({
      ...editForm,
      suggestedLabels: editForm.suggestedLabels.filter((l) => l !== label),
    });
  };

  const handleEpicLinkOverride = (issueId: string, epicKey: string) => {
    const updated = issues.map((issue) => {
      if (issue.id === issueId) {
        return { ...issue, selectedEpicKey: epicKey || undefined };
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
                  title={
                    isRtl
                      ? "بارگذاری تیکت موجود با شناسه"
                      : "Load existing ticket by ID"
                  }
                >
                  <RefreshCw data-icon="inline-start" />
                  {isRtl ? "بارگذاری تیکت با شناسه" : "Load Issue by ID"}
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
                      {isRtl
                        ? "کلید یا شناسه تیکت جیرا"
                        : "Jira Issue Key / ID"}
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
                    {isRtl ? "انصراف" : "Cancel"}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loadingJiraIssue || !loadJiraKey.trim()}
                  >
                    {loadingJiraIssue ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        {isRtl ? "در حال دریافت..." : "Loading..."}
                      </>
                    ) : (
                      <>{isRtl ? "بارگذاری و شروع بازبینی" : "Load & Review"}</>
                    )}
                  </Button>
                </div>
                {loadError && (
                  <Alert variant="destructive" className="w-full">
                    <AlertCircle />
                    <AlertTitle>
                      {isRtl ? "خطا" : "Error"}
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
                  {isRtl ? "اتصال به جیرا لازم است" : "Jira connection required"}
                </AlertTitle>
                <AlertDescription>
                  {isRtl
                    ? "برای ساخت خودکار تیکت‌ها در جیرا، متغیرهای JIRA_* را در env سرور تنظیم کنید و صفحه Healthcheck را بررسی کنید."
                    : "To publish these tickets to Jira, configure JIRA_* env vars on the server and verify the Healthcheck page."}
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
              {isRtl ? "تیکتی یافت نشد" : "Workspace Empty"}
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
                  {isRtl
                    ? `انتخاب همه (${selectedIds.length} از ${selectableIssues.length} تیکت قابل ویرایش انتخاب شده است)`
                    : `Select All (${selectedIds.length} of ${selectableIssues.length} editable tickets selected)`}
                </label>
              </div>

              {selectedIds.length > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => setSelectedIds([])}
                >
                  {isRtl ? "لغو انتخاب‌ها" : "Clear selection"}
                </Button>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-primary">
                  <Sparkles className="size-4" />
                  <span className="text-xs font-bold">
                    {isRtl
                      ? "اعمال گروهی مقادیر به تیکت‌های انتخاب شده"
                      : "Bulk Edit Selected Issues"}
                  </span>
                </div>

                <FieldGroup className="gap-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Field>
                      <FieldLabel>
                        {isRtl ? "اتصال به اپیک" : "Link to Epic"}
                      </FieldLabel>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            options={[
                              {
                                value: "",
                                label: isRtl
                                  ? "تغییر داده نشود"
                                  : "Do not change",
                              },
                              {
                                value: "CLEAR_FIELD",
                                label: isRtl
                                  ? "پاک کردن اتصال اپیک"
                                  : "Clear epic link",
                              },
                              ...existingEpics.map((epic) => ({
                                value: epic.key,
                                label: `${epic.key} - ${epic.summary}`,
                              })),
                            ]}
                            value={bulkEpicKey}
                            onChange={(val) => setBulkEpicKey(val)}
                            showSearch={true}
                            isRtl={isRtl}
                          />
                        </div>
                        {jiraConnected && existingEpics.length === 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={fetchingEpics}
                            onClick={onFetchEpics}
                            title={isRtl ? "بارگذاری اپیک‌ها" : "Fetch Epics"}
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
                            {isRtl ? "شناسه مستقیم:" : "Direct Key:"}
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
                        {isRtl ? "اولویت" : "Priority"}
                      </FieldLabel>
                      <SearchableSelect
                        options={[
                          {
                            value: "",
                            label: isRtl
                              ? "تغییر داده نشود"
                              : "Do not change",
                          },
                          ...["Highest", "High", "Medium", "Low", "Lowest"].map(
                            (p) => ({
                              value: p,
                              label: priorityLabels[language][p] || p,
                            })
                          ),
                        ]}
                        value={bulkPriority}
                        onChange={(val) => setBulkPriority(val)}
                        isRtl={isRtl}
                      />
                    </Field>

                    <Field>
                      <FieldLabel>
                        {isRtl ? "کامپوننت" : "Component"}
                      </FieldLabel>
                      <SearchableSelect
                        options={[
                          {
                            value: "",
                            label: isRtl
                              ? "تغییر داده نشود"
                              : "Do not change",
                          },
                          {
                            value: "CLEAR_FIELD",
                            label: isRtl
                              ? "پاک کردن کامپوننت"
                              : "Clear component",
                          },
                          ...availableComponents.map((comp) => ({
                            value: comp,
                            label: comp,
                          })),
                        ]}
                        value={bulkComponent}
                        onChange={(val) => setBulkComponent(val)}
                        showSearch={true}
                        isRtl={isRtl}
                      />
                    </Field>

                    {jiraConnected && (
                      <Field>
                        <FieldLabel>
                          {isRtl ? "اسپرینت" : "Sprint"}
                        </FieldLabel>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={[
                                {
                                  value: "",
                                  label: isRtl
                                    ? "تغییر داده نشود"
                                    : "Do not change",
                                },
                                {
                                  value: "CLEAR_FIELD",
                                  label: isRtl
                                    ? "انتقال به بکلاگ (بدون اسپرینت)"
                                    : "Send to backlog",
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
                              isRtl={isRtl}
                            />
                          </div>
                          {availableSprints.length === 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              disabled={fetchingSprints}
                              onClick={onFetchSprints}
                              title={
                                isRtl ? "بارگذاری اسپرینت‌ها" : "Fetch Sprints"
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
                          {isRtl ? "مسئول (Assignee)" : "Assignee"}
                        </FieldLabel>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={[
                                {
                                  value: "",
                                  label: isRtl
                                    ? "تغییر داده نشود"
                                    : "Do not change",
                                },
                                {
                                  value: "CLEAR_FIELD",
                                  label: isRtl
                                    ? "بدون مسئول (Unassigned)"
                                    : "Clear assignee",
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
                              isRtl={isRtl}
                            />
                          </div>
                          {availableUsers.length === 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              disabled={fetchingUsers}
                              onClick={onFetchUsers}
                              title={
                                isRtl ? "بارگذاری کاربران" : "Fetch Users"
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
                          {isRtl ? "ریلیز / نسخه" : "Release / Version"}
                        </FieldLabel>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              options={[
                                {
                                  value: "",
                                  label: isRtl
                                    ? "تغییر داده نشود"
                                    : "Do not change",
                                },
                                {
                                  value: "CLEAR_FIELD",
                                  label: isRtl
                                    ? "پاک کردن ریلیز"
                                    : "Clear release",
                                },
                                ...availableVersions.map((version) => ({
                                  value: version.id,
                                  label: version.name,
                                  sublabel: version.released
                                    ? `(${isRtl ? "منتشر شده" : "released"})`
                                    : "",
                                })),
                              ]}
                              value={bulkRelease}
                              onChange={(val) => setBulkRelease(val)}
                              showSearch={true}
                              isRtl={isRtl}
                            />
                          </div>
                          {availableVersions.length === 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              disabled={fetchingVersions}
                              onClick={onFetchVersions}
                              title={
                                isRtl ? "بارگذاری ریلیزها" : "Fetch Releases"
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
                    {isRtl
                      ? `اعمال تغییرات روی ${selectedIds.length} تیکت`
                      : `Apply changes to ${selectedIds.length} tickets`}
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

          return (
            <Card
              key={issue.id}
              id={`issue-card-${issue.id}`}
              className={cn(
                "transition-all duration-200",
                issue.status === "success" && "ring-success/40",
                issue.status === "failed" && "ring-destructive/40",
                isEpic &&
                  issue.status !== "success" &&
                  issue.status !== "failed" &&
                  "ring-primary/25"
              )}
            >
              <CardHeader className="border-b bg-muted/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {issue.status !== "success" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(issue.id)}
                        onChange={() => toggleSelectIssue(issue.id)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    )}

                    <Badge variant={getIssueTypeBadgeVariant(issue.issuetype)}>
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

                    <span className="font-mono text-[11px] text-muted-foreground">
                      #{issue.id}
                    </span>

                    <Badge variant={getPriorityBadgeStyles(issue.selectedPriority)}>
                      {priorityLabels[language][
                        issue.selectedPriority || "Medium"
                      ] ||
                        issue.selectedPriority ||
                        "Medium"}
                    </Badge>

                    {issue.status === "success" && issue.createdKey && (
                      <Badge variant="success" className="font-mono">
                        <CheckCircle2 data-icon="inline-start" />
                        {issue.createdKey}
                      </Badge>
                    )}

                    {issue.status === "creating" && (
                      <Badge variant="warning">
                        <Spinner data-icon="inline-start" />
                        {t.creating}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isEditing && issue.status !== "success" && (
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
                        title={
                          isRtl ? "بازبینی با هوش مصنوعی" : "Review with AI"
                        }
                      >
                        <Sparkles data-icon="inline-start" />
                        <span className="hidden sm:inline">
                          {isRtl ? "بازبینی مجدد" : "Re-Review"}
                        </span>
                      </Button>
                    )}

                    {!isEditing && issue.status !== "success" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditClick(issue)}
                        title={t.edit}
                      >
                        <Edit2 data-icon="inline-start" />
                        <span className="hidden sm:inline">{t.edit}</span>
                      </Button>
                    )}

                    {jiraConnected &&
                      issue.status !== "success" &&
                      !isEditing && (
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
                            ? isRtl
                              ? "به‌روزرسانی در جیرا"
                              : "Update in Jira"
                            : issue.status === "failed"
                              ? t.rePublish
                              : t.createInJira}
                        </Button>
                      )}

                    {issue.status === "success" && issue.createdKey && (
                      <a
                        href={getJiraBrowseUrl(issue.createdKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "bg-success text-success-foreground hover:bg-success/90"
                        )}
                      >
                        {isRtl ? "مشاهده در جیرا" : "Open in Jira"}
                        <ExternalLink data-icon="inline-end" />
                      </a>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-4">
                {isEditing ? (
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
                          })
                        }
                        isRtl={isRtl}
                      />
                    </Field>

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
                        {isRtl ? "اولویت (Priority)" : "Priority"}
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
                          label: priorityLabels[language][p] || p,
                        }))}
                        value={editForm.selectedPriority || "Medium"}
                        onChange={(val) =>
                          setEditForm({ ...editForm, selectedPriority: val })
                        }
                        isRtl={isRtl}
                      />
                    </Field>

                    {availableComponents.length > 0 && (
                      <Field>
                        <FieldLabel>
                          {isRtl ? "کامپوننت جیرا" : "Jira Component"}
                        </FieldLabel>
                        <SearchableSelect
                          options={[
                            {
                              value: "",
                              label: isRtl
                                ? "بدون کامپوننت"
                                : "No Component",
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
                          isRtl={isRtl}
                        />
                      </Field>
                    )}

                    {jiraConnected && (
                      <Field>
                        <FieldLabel>
                          {isRtl ? "مسئول (Assignee)" : "Assignee"}
                        </FieldLabel>
                        {fetchingUsers ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <Spinner />
                            <span className="text-xs text-muted-foreground">
                              {isRtl
                                ? "در حال بارگذاری کاربران..."
                                : "Loading Users..."}
                            </span>
                          </div>
                        ) : (
                          <SearchableSelect
                            options={[
                              {
                                value: "",
                                label: isRtl
                                  ? "تخصیص داده نشده"
                                  : "Unassigned",
                              },
                              ...getSortedUsers(availableUsers).map((user) => {
                                const storedFreq = (() => {
                                  try {
                                    const stored = localStorage.getItem(
                                      "jira_assignee_frequency"
                                    );
                                    return stored ? JSON.parse(stored) : {};
                                  } catch {
                                    return {};
                                  }
                                })();
                                const freqVal = storedFreq[user.name] || 0;
                                return {
                                  value: user.name,
                                  label: user.displayName,
                                  sublabel:
                                    freqVal > 0
                                      ? `${isRtl ? "پرکاربرد" : "Frequent"} (${freqVal})`
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
                            isRtl={isRtl}
                          />
                        )}
                      </Field>
                    )}

                    {jiraConnected && isEpic && (
                      <Field>
                        <FieldLabel>
                          {isRtl
                            ? "ریلیز (Fix Version)"
                            : "Release (Fix Version)"}
                        </FieldLabel>
                        {fetchingVersions ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <Spinner />
                            <span className="text-xs text-muted-foreground">
                              {isRtl
                                ? "در حال بارگذاری نسخه‌ها..."
                                : "Loading Versions..."}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <SearchableSelect
                                options={[
                                  {
                                    value: "",
                                    label: isRtl
                                      ? "انتخاب نشده"
                                      : "None / Unreleased",
                                  },
                                  ...availableVersions.map((version) => ({
                                    value: version.id,
                                    label: version.name,
                                    sublabel: version.released
                                      ? `(${isRtl ? "منتشر شده" : "released"})`
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
                                isRtl={isRtl}
                              />
                            </div>
                            {availableVersions.length === 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={fetchingVersions}
                                onClick={onFetchVersions}
                                title={
                                  isRtl
                                    ? "دریافت مجدد نسخه‌ها"
                                    : "Reload Versions"
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

                    {jiraConnected && !isEpic && (
                      <Field>
                        <FieldLabel>
                          {isRtl ? "اسپرینت (Sprint)" : "Sprint"}
                        </FieldLabel>
                        {fetchingSprints ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <Spinner />
                            <span className="text-xs text-muted-foreground">
                              {isRtl
                                ? "در حال بارگذاری اسپرینت‌ها..."
                                : "Loading Sprints..."}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <SearchableSelect
                                options={[
                                  {
                                    value: "",
                                    label: isRtl
                                      ? "تخصیص داده نشده (بکلاگ)"
                                      : "Backlog",
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
                                isRtl={isRtl}
                              />
                            </div>
                            {availableSprints.length === 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={fetchingSprints}
                                onClick={onFetchSprints}
                                title={
                                  isRtl
                                    ? "دریافت مجدد اسپرینت‌ها"
                                    : "Reload Sprints"
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
                    <h4
                      className="text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base"
                      dir="auto"
                    >
                      {issue.summary}
                    </h4>

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
                              {isRtl
                                ? "لینک شده به اپیک موجود:"
                                : "Linked to Existing Epic:"}{" "}
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
                                    label: isRtl ? "انتخاب نشده" : "None",
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
                                isRtl={isRtl}
                              />
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {isRtl ? "یا شناسه:" : "or Key:"}
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
                                title={
                                  isRtl
                                    ? "بارگذاری اپیک‌های موجود جیرا"
                                    : "Fetch existing Epics from Jira"
                                }
                              >
                                {fetchingEpics ? <Spinner /> : <RefreshCw />}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                      <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                        <span className="inline-block size-2 rounded-full bg-destructive" />
                        <span>
                          {isRtl
                            ? "اولویت انتخاب شده:"
                            : "Selected Priority:"}{" "}
                          <Badge
                            variant={getPriorityBadgeStyles(
                              issue.selectedPriority
                            )}
                          >
                            {priorityLabels[language][
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
                            {isRtl ? "تغییر اولویت:" : "Change Priority:"}
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
                                label: priorityLabels[language][p] || p,
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
                              isRtl={isRtl}
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
                            {isRtl
                              ? "کامپوننت انتخاب شده:"
                              : "Selected Component:"}{" "}
                            {issue.selectedComponent ? (
                              <Badge variant="outline">
                                {issue.selectedComponent}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {isRtl ? "هیچ" : "None"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {isRtl
                                ? "تغییر کامپوننت:"
                                : "Change Component:"}
                            </span>
                            <div className="flex-1">
                              <SearchableSelect
                                options={[
                                  {
                                    value: "",
                                    label: isRtl
                                      ? "بدون کامپوننت"
                                      : "No Component",
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
                                isRtl={isRtl}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {jiraConnected && isEpic && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="inline-block size-2 rounded-full bg-success" />
                          <span>
                            {isRtl
                              ? "ریلیز انتخاب شده:"
                              : "Selected Release:"}{" "}
                            {issue.selectedRelease ? (
                              <Badge variant="outline">
                                {availableVersions.find(
                                  (v) => v.id === issue.selectedRelease
                                )?.name || issue.selectedRelease}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {isRtl ? "هیچ" : "None"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {isRtl ? "تغییر ریلیز:" : "Change Release:"}
                            </span>
                            {fetchingVersions ? (
                              <Spinner />
                            ) : (
                              <div className="flex-1">
                                <SearchableSelect
                                  options={[
                                    {
                                      value: "",
                                      label: isRtl ? "انتخاب نشده" : "None",
                                    },
                                    ...availableVersions.map((version) => ({
                                      value: version.id,
                                      label: version.name,
                                      sublabel: version.released
                                        ? `(${isRtl ? "منتشر شده" : "released"})`
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
                                  isRtl={isRtl}
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
                                title={
                                  isRtl ? "بارگذاری ریلیزها" : "Fetch Releases"
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

                    {jiraConnected && !isEpic && (
                      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:flex-row sm:items-center">
                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="inline-block size-2 rounded-full bg-primary" />
                          <span>
                            {isRtl
                              ? "اسپرینت انتخاب شده:"
                              : "Selected Sprint:"}{" "}
                            {issue.selectedSprint ? (
                              <Badge variant="outline">
                                {availableSprints.find(
                                  (s) => String(s.id) === issue.selectedSprint
                                )?.name || issue.selectedSprint}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {isRtl ? "بکلاگ" : "Backlog"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {isRtl ? "تغییر اسپرینت:" : "Change Sprint:"}
                            </span>
                            {fetchingSprints ? (
                              <Spinner />
                            ) : (
                              <div className="flex-1">
                                <SearchableSelect
                                  options={[
                                    {
                                      value: "",
                                      label: isRtl ? "بکلاگ" : "Backlog",
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
                                  isRtl={isRtl}
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
                                title={
                                  isRtl
                                    ? "بارگذاری اسپرینت‌ها"
                                    : "Fetch Sprints"
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
                            {isRtl ? "مسئول (Assignee):" : "Assignee:"}{" "}
                            {issue.selectedAssignee ? (
                              <Badge variant="outline">
                                {availableUsers.find(
                                  (u) => u.name === issue.selectedAssignee
                                )?.displayName || issue.selectedAssignee}
                              </Badge>
                            ) : (
                              <span className="font-normal italic text-muted-foreground">
                                {isRtl ? "تخصیص داده نشده" : "Unassigned"}
                              </span>
                            )}
                          </span>
                        </div>

                        {issue.status !== "success" && (
                          <div className="flex min-w-[160px] items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                              {isRtl ? "تغییر مسئول:" : "Change Assignee:"}
                            </span>
                            {fetchingUsers ? (
                              <Spinner />
                            ) : (
                              <div className="flex-1">
                                <SearchableSelect
                                  options={[
                                    {
                                      value: "",
                                      label: isRtl
                                        ? "تخصیص داده نشده"
                                        : "Unassigned",
                                    },
                                    ...getSortedUsers(availableUsers).map(
                                      (user) => {
                                        const storedFreq = (() => {
                                          try {
                                            const stored = localStorage.getItem(
                                              "jira_assignee_frequency"
                                            );
                                            return stored
                                              ? JSON.parse(stored)
                                              : {};
                                          } catch {
                                            return {};
                                          }
                                        })();
                                        const freqVal =
                                          storedFreq[user.name] || 0;
                                        return {
                                          value: user.name,
                                          label: user.displayName,
                                          sublabel:
                                            freqVal > 0
                                              ? `${isRtl ? "پرکاربرد" : "Frequent"} (${freqVal})`
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
                                  isRtl={isRtl}
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
                                title={
                                  isRtl ? "بارگذاری کاربران" : "Fetch Users"
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
                            {isRtl
                              ? "بازبینی و اصلاح متن با هوش مصنوعی"
                              : "AI Re-Review & Refinement"}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {isRtl
                            ? "دستورالعمل یا پرامپت اصلاحی خود را بنویسید (مثلاً: بخش فرضیات را اضافه کن، یا لحن متن را رسمی‌تر کن)"
                            : "Provide custom refinement instructions (e.g. 'Add assumptions section', or 'Make the tone more professional')"}
                        </p>
                        <Textarea
                          rows={3}
                          value={reRefinePrompt}
                          onChange={(e) => setReRefinePrompt(e.target.value)}
                          placeholder={
                            isRtl
                              ? "مثال: سناریوی خطا (Error flow) را به سناریوها اضافه کن..."
                              : "e.g. Include error handling scenarios in the description..."
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
                              {isRtl ? "انصراف" : "Cancel"}
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
                              {isAIProcessing
                                ? isRtl
                                  ? "در حال اصلاح..."
                                  : "Refining..."
                                : isRtl
                                  ? "اعمال و اصلاح"
                                  : "Apply & Refine"}
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
