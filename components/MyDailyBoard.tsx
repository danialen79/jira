"use client";

import React, { useState, useEffect } from "react";
import { Language, JiraUser } from "@/lib/types";
import {
  ClipboardList,
  RefreshCw,
  Search,
  Clock,
  Send,
  Sparkles,
  CheckCircle,
  AlertCircle,
  User,
  PlusCircle,
  Trash2,
  ExternalLink,
  CheckSquare,
  X,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

interface MyDailyBoardProps {
  language: Language;
  jiraUrl: string;
  jiraUsername: string;
  jiraConnected: boolean;
  jiraUsers: JiraUser[];
}

interface Worklog {
  id: string;
  author: string;
  comment: string;
  timeSpent: string;
  timeSpentSeconds: number;
  created: string;
}

interface JiraIssue {
  key: string;
  id: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  assigneeDisplayName: string;
  assigneeEmail?: string;
  assigneeKey?: string;
  issuetype: string;
  timespent: number;
  timeoriginalestimate: number;
  worklogs: Worklog[];
  created: string;
}

interface RecentLogItem {
  issueKey: string;
  summary: string;
  parentKey?: string;
  timeSpent: string;
  comment: string;
  timestamp: string;
  url: string;
}

interface AIWorklogPlanItem {
  id: string;
  parentType: "existing" | "new";
  parentKey?: string;
  candidateParentKeys?: string[];
  proposedParentStory?: {
    summary: string;
    description: string;
  };
  subTaskSummary: string;
  timeSpent: string;
  comment: string;
  started?: string;
  selected?: boolean;
  status?:
    | "pending"
    | "creating-parent"
    | "creating-subtask"
    | "logging"
    | "success"
    | "failed"
    | "transitioning";
  error?: string;
}

type AIProvider = "gemini" | "avalai" | "arvan";

const translations = {
  en: {
    title: "Daily My Work & Board",
    subtitle:
      "Check active tickets for the current project, log time spent, or use AI to parse your daily summary and log work in batch.",
    loadError:
      "Failed to load project tickets. Please verify your Jira connection and project key in Tab 1.",
    notConnected: "Jira Connection Required",
    notConnectedDesc:
      "Please connect to your self-hosted Jira Server first in '1. Connection & Config' tab to view your daily board.",
    refreshBtn: "Refresh Board",
    loadingIssues: "Fetching project tickets from Jira...",
    searchPlaceholder: "Search by summary, key, or assignee...",
    filterType: "All Issue Types",
    filterStatus: "All Statuses",
    filterMineOnly: "Only Assigned to Me",
    filterAll: "All Assignees",
    ticketKey: "Key",
    ticketSummary: "Summary",
    ticketStatus: "Status",
    ticketAssignee: "Assignee",
    ticketTimeLogged: "Time Logged",
    unassigned: "Unassigned",
    noIssuesFound: "No issues found matching your filters in this project.",

    // Quick Log
    quickLogTitle: "Quick Work Log",
    logTimeLabel: "Time Spent (e.g. 2h, 45m)",
    logCommentLabel: "Description of work done",
    logBtn: "Log Work",
    logging: "Logging...",
    logSuccess: "Worklog submitted successfully!",

    // AI Section
    aiBoxTitle: "AI Daily Worklog Assistant",
    aiBoxDesc:
      "Enter your daily accomplishments in plain text (English or Persian). The AI will identify matching tickets, distribute your hours, and write professional worklog descriptions.",
    aiPromptPlaceholder:
      "e.g., Today I spent 3 hours on debugging the signup SMS verification (PROJ-12), and 4 hours writing API documentation for user profiles.",
    aiPromptPlaceholderFa:
      "مثال: امروز ۳ ساعت روی دیباگ کردن تایید پیامکی ثبت نام کار کردم و ۴ ساعت مستندات API پروفایل کاربرها رو نوشتم.",
    aiGenerateBtn: "Analyze & Plan Log",
    aiGenerating: "Analyzing your work...",
    aiPlanTitle: "AI Proposed Worklog Plan",
    aiPlanDesc: "Review and edit the suggested logs before posting to Jira.",
    aiPublishSelected: "Submit Selected Logs to Jira",
    aiPublishing: "Publishing logs...",
    aiPublishSuccess: "All selected worklogs published successfully!",
    noMatches:
      "Gemini couldn't match your text to any active issues. Please check the ticket keys or try clarifying your prompt.",
    hoursShort: "h",
    minutesShort: "m",
    secondsShort: "s",
    totalTimeSpent: "Total Spent",
    originalEstimate: "Original Estimate",
    showLogs: "Show Worklogs",
    hideLogs: "Hide Worklogs",
    noWorklogsLogged: "No worklogs logged on this issue yet.",
    targetUserLabel: "Show Board & Tasks for:",
    allUsersOption: "All Users / Team",
    selectedUserHelp:
      "Showing active tasks and analyzing daily work for this user.",
    proposalHeader: "Proposed Log Details",
    parentStoryLabel: "Parent Story (where Sub-task will be created)",
    existingParentOption: "Link to Existing Story",
    newParentOption: "Create New Story",
    subTaskTitleLabel: "Sub-task Summary",
    worklogCommentLabel: "Worklog Description",
    timeSpentLabel: "Time Spent",
    newStorySummaryLabel: "New Story Title",
    newStoryDescLabel: "New Story Description",
    selectParentPlaceholder: "Select parent story...",
    chooseFromCandidates: "Recommended Parent Candidates:",
    allStoriesDropdown: "All Project Stories/Bugs:",
    statusPending: "Pending Approval",
    statusCreatingParent: "Creating Parent Story...",
    statusCreatingSubtask: "Creating Sub-task...",
    statusLogging: "Logging Work...",
    statusSuccess: "Logged Successfully",
    statusFailed: "Failed",
    startTimeLabel: "Start Time",
    searchUserPlaceholder: "Search users...",
    statusTransitioning: "Moving Sub-task to Done...",
    recentLogsTitle: "Recently Created & Logged Sub-tasks",
    clearRecentBtn: "Clear List",
    clearRecentConfirmTitle: "Clear recent logs?",
    clearRecentConfirmDesc:
      "This removes the local list of recently created & logged sub-tasks. It does not delete anything in Jira.",
    clearRecentCancel: "Cancel",
    geminiModelLabel: "AI Model:",
    geminiModelFlashDesc: "⚡ Gemini 3.5 Flash (Fast / Default)",
    geminiModelProDesc: "🧠 Gemini 3.1 Pro (Deep Reasoning)",
    geminiModelLiteDesc: "🍃 Gemini 3.1 Flash Lite (Lightweight / Ultra-fast)",
    aiProviderLabel: "AI Provider:",
    avalaiModelDesc: "🟦 AvalAI gpt-4o-mini (OpenAI-compatible)",
    arvanModelDesc: "🟧 Arvan Gemini-3-Flash-Preview",
  },
  fa: {
    title: "میز کار و بورد روزانه من",
    subtitle:
      "بررسی تیکت‌های فعال در پروژه جاری، ثبت دستی زمان کاری، یا استفاده از هوش مصنوعی برای تحلیل و ثبت دسته‌ای کارهای روزانه.",
    loadError:
      "خطا در دریافت تیکت‌های پروژه. لطفاً اتصال جیرا و کلید پروژه را در تب اول بررسی کنید.",
    notConnected: "نیاز به اتصال به جیرا",
    notConnectedDesc:
      "برای مشاهده بورد روزانه، ابتدا در تب «۱. اتصال و تنظیمات جیرا» به سرور جیرا خود متصل شوید.",
    refreshBtn: "بروزرسانی بورد",
    loadingIssues: "در حال دریافت تیکت‌های پروژه از جیرا...",
    searchPlaceholder: "جستجو با عنوان، کلید تیکت یا مسئول...",
    filterType: "همه انواع تیکت",
    filterStatus: "همه وضعیت‌ها",
    filterMineOnly: "فقط تیکت‌های واگذار شده به من",
    filterAll: "همه اعضای تیم",
    ticketKey: "کلید",
    ticketSummary: "عنوان تیکت",
    ticketStatus: "وضعیت",
    ticketAssignee: "مسئول",
    ticketTimeLogged: "زمان ثبت شده",
    unassigned: "بدون مسئول",
    noIssuesFound: "هیچ تیکتی در این پروژه با فیلترهای شما مطابقت ندارد.",

    // Quick Log
    quickLogTitle: "ثبت سریع ساعت کاری",
    logTimeLabel: "زمان صرف شده (مانند 2h, 45m)",
    logCommentLabel: "توضیح کارهای انجام شده",
    logBtn: "ثبت در جیرا",
    logging: "در حال ثبت...",
    logSuccess: "ساعت کاری با موفقیت ثبت شد!",

    // AI Section
    aiBoxTitle: "دستیار هوشمند ثبت کارکرد (هوش مصنوعی)",
    aiBoxDesc:
      "گزارش کارهای روزانه خود را به زبان عامیانه (فارسی یا انگلیسی) وارد کنید. هوش مصنوعی تیکت‌های مرتبط را پیدا کرده، زمان را تقسیم می‌کند و توضیحات رسمی و حرفه‌ای برای هر تیکت می‌نویسد.",
    aiPromptPlaceholder:
      "مثال: امروز ۳ ساعت روی دیباگ کردن تایید پیامکی ثبت نام کار کردم و ۴ ساعت مستندات API پروفایل کاربرها رو نوشتم.",
    aiPromptPlaceholderFa:
      "مثال: امروز ۳ ساعت روی دیباگ کردن تایید پیامکی ثبت نام کار کردم و ۴ ساعت مستندات API پروفایل کاربرها رو نوشتم.",
    aiGenerateBtn: "تحلیل هوشمند و برنامه‌ریزی کارکرد",
    aiGenerating: "در حال تحلیل کارهای روزانه...",
    aiPlanTitle: "برنامه پیشنهادی هوش مصنوعی",
    aiPlanDesc:
      "پیشنهادات را بررسی کنید و تیکت‌هایی که می‌خواهید ثبت شوند را تایید کنید.",
    aiPublishSelected: "ثبت موارد انتخاب شده در جیرا",
    aiPublishing: "در حال ثبت در جیرا...",
    aiPublishSuccess: "تمامی ساعت‌های کاری با موفقیت در جیرا ثبت شدند!",
    noMatches:
      "هوش مصنوعی نتوانست متنی مرتبط با تیکت‌های فعال پیدا کند. لطفاً توضیحات خود را دقیق‌تر بنویسید یا کلیدهای تیکت را بررسی کنید.",
    hoursShort: "ساعت",
    minutesShort: "دقیقه",
    secondsShort: "ثانیه",
    totalTimeSpent: "کل زمان ثبت شده",
    originalEstimate: "تخمین اولیه",
    showLogs: "مشاهده جزئیات کارکردها",
    hideLogs: "پنهان‌سازی کارکردها",
    noWorklogsLogged: "هنوز هیچ گزارش کارکردی برای این تیکت ثبت نشده است.",
    targetUserLabel: "مشاهده بورد و تیکت‌های:",
    allUsersOption: "همه کاربران / تیم",
    selectedUserHelp:
      "نمایش تیکت‌های فعال و تحلیل گزارش کارکرد روزانه برای کاربر انتخاب‌شده.",
    proposalHeader: "جزئیات گزارش پیشنهادی",
    parentStoryLabel: "استوری والد (ساب‌تسک روی این تیکت ساخته می‌شود)",
    existingParentOption: "اتصال به استوری موجود در جیرا",
    newParentOption: "ایجاد استوری جدید والد",
    subTaskTitleLabel: "عنوان ساب‌تسک",
    worklogCommentLabel: "توضیح گزارش کارکرد (لاگ)",
    timeSpentLabel: "مدت زمان صرف‌شده",
    newStorySummaryLabel: "عنوان استوری جدید والد",
    newStoryDescLabel: "توضیحات استوری جدید والد",
    selectParentPlaceholder: "انتخاب استوری والد...",
    chooseFromCandidates: "تیکت‌های والد پیشنهادی هوش مصنوعی:",
    allStoriesDropdown: "همه استوری‌ها و تیکت‌های پروژه:",
    statusPending: "در انتظار تایید",
    statusCreatingParent: "در حال ساخت استوری والد...",
    statusCreatingSubtask: "در حال ساخت ساب‌تسک...",
    statusLogging: "در حال ثبت گزارش کارکرد...",
    statusSuccess: "با موفقیت ثبت شد",
    statusFailed: "خطا در فرآیند",
    startTimeLabel: "زمان شروع کارکرد",
    searchUserPlaceholder: "جستجوی کاربر...",
    statusTransitioning: "در حال تغییر وضعیت ساب‌تسک به Done...",
    recentLogsTitle: "آخرین ساب‌تسک‌های ساخته و ثبت‌شده",
    clearRecentBtn: "پاک کردن لیست",
    clearRecentConfirmTitle: "پاک کردن لیست آخرین‌ها؟",
    clearRecentConfirmDesc:
      "این کار فقط لیست محلی ساب‌تسک‌های اخیر را پاک می‌کند و چیزی در جیرا حذف نمی‌شود.",
    clearRecentCancel: "انصراف",
    geminiModelLabel: "مدل هوش مصنوعی:",
    geminiModelFlashDesc: "⚡ جمنای ۳.۵ فلش (سریع / پیش‌فرض)",
    geminiModelProDesc: "🧠 جمنای ۳.۱ پرو (استدلال دقیق‌تر)",
    geminiModelLiteDesc: "🍃 جمنای ۳.۱ فلش لایت (سبک و فوق سریع)",
    aiProviderLabel: "پروایدر هوش مصنوعی:",
    avalaiModelDesc: "🟦 آوالای gpt-4o-mini (سازگار با OpenAI)",
    arvanModelDesc: "🟧 آروان Gemini-3-Flash-Preview",
  },
};

const getLocalDatetimeString = (date = new Date()) => {
  const tzoffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = new Date(date.getTime() - tzoffset)
    .toISOString()
    .slice(0, 16);
  return localISOTime;
};

function planStatusVariant(
  status: AIWorklogPlanItem["status"]
): "success" | "destructive" | "secondary" {
  if (status === "success") return "success";
  if (status === "failed") return "destructive";
  return "secondary";
}

function issueTypeVariant(
  issuetype: string
): "destructive" | "secondary" | "warning" {
  if (issuetype === "Bug") return "destructive";
  if (issuetype === "Epic") return "secondary";
  return "warning";
}

export default function MyDailyBoard({
  language,
  jiraUrl,
  jiraUsername,
  jiraConnected,
  jiraUsers,
}: MyDailyBoardProps) {
  const t = translations[language];
  const isRtl = language === "fa";

  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");

  // Initialize selectedAssignee based on connected Jira user and fetched users list
  useEffect(() => {
    if (jiraUsers && jiraUsers.length > 0) {
      const cleanUsername = (jiraUsername || "").trim().toLowerCase();
      if (cleanUsername) {
        const match = jiraUsers.find(
          (u) =>
            u.name.toLowerCase() === cleanUsername ||
            (u.emailAddress && u.emailAddress.toLowerCase() === cleanUsername)
        );
        if (match) {
          setSelectedAssignee(match.name);
          return;
        }
      }
      // If we have users but no match, default to first user
      setSelectedAssignee(jiraUsers[0].name);
    } else if (jiraUsername) {
      setSelectedAssignee(jiraUsername);
    } else {
      setSelectedAssignee("ALL");
    }
  }, [jiraUsers, jiraUsername]);

  // Helper matcher to verify if issue belongs to selected target user
  const matchesSelectedAssignee = (issue: JiraIssue, targetUsername: string) => {
    if (!targetUsername || targetUsername === "ALL") return true;

    const cleanTarget = targetUsername.trim().toLowerCase();
    const targetPrefix = cleanTarget.includes("@")
      ? cleanTarget.split("@")[0]
      : cleanTarget;

    const issueAssignee = (issue.assignee || "").trim().toLowerCase();
    const issueAssigneeEmail = (issue.assigneeEmail || "").trim().toLowerCase();
    const issueAssigneeKey = (issue.assigneeKey || "").trim().toLowerCase();
    const issueAssigneeDisplayName = (issue.assigneeDisplayName || "")
      .trim()
      .toLowerCase();

    // Find the user details if available
    const targetUserObj = jiraUsers.find(
      (u) => u.name.toLowerCase() === cleanTarget
    );
    const targetDisplayName = targetUserObj
      ? targetUserObj.displayName.trim().toLowerCase()
      : "";
    const targetEmail =
      targetUserObj && targetUserObj.emailAddress
        ? targetUserObj.emailAddress.trim().toLowerCase()
        : "";

    if (
      issueAssignee === cleanTarget ||
      issueAssigneeKey === cleanTarget ||
      issueAssigneeEmail === cleanTarget ||
      (issueAssignee && issueAssignee === targetPrefix) ||
      (issueAssigneeKey && issueAssigneeKey === targetPrefix) ||
      (issueAssigneeEmail &&
        issueAssigneeEmail.split("@")[0] === targetPrefix) ||
      (issueAssignee &&
        (issueAssignee.includes(targetPrefix) ||
          targetPrefix.includes(issueAssignee)) &&
        issueAssignee.length > 3 &&
        targetPrefix.length > 3)
    ) {
      return true;
    }

    if (targetDisplayName && issueAssigneeDisplayName) {
      if (
        issueAssigneeDisplayName === targetDisplayName ||
        issueAssigneeDisplayName.includes(targetDisplayName) ||
        targetDisplayName.includes(issueAssigneeDisplayName)
      ) {
        return true;
      }
    }

    if (targetEmail && issueAssigneeEmail) {
      if (
        issueAssigneeEmail === targetEmail ||
        issueAssigneeEmail.split("@")[0] === targetEmail.split("@")[0]
      ) {
        return true;
      }
    }

    return false;
  };

  // Manual Log State
  const [activeLogIssue, setActiveLogIssue] = useState<JiraIssue | null>(null);
  const [logTime, setLogTime] = useState("");
  const [logComment, setLogComment] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded Worklogs
  const [expandedIssueKey, setExpandedIssueKey] = useState<string | null>(null);

  // Recent Logs State
  const [recentLogs, setRecentLogs] = useState<RecentLogItem[]>([]);
  const [clearRecentOpen, setClearRecentOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jira_recent_logs");
      if (saved) setRecentLogs(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to read recent logs", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("jira_recent_logs", JSON.stringify(recentLogs));
    } catch (e) {
      console.error("Failed to save recent logs", e);
    }
  }, [recentLogs]);

  // AI Planner State
  const [aiProvider, setAiProvider] = useState<AIProvider>("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash");

  useEffect(() => {
    try {
      const savedProvider = localStorage.getItem("jira_ai_provider");
      const savedModel =
        localStorage.getItem("jira_ai_model") ||
        localStorage.getItem("jira_selected_gemini_model");

      const providerCandidate: AIProvider =
        savedProvider === "avalai"
          ? "avalai"
          : savedProvider === "arvan"
            ? "arvan"
            : "gemini";

      setAiProvider(providerCandidate);

      if (savedModel) {
        if (providerCandidate === "gemini") {
          if (savedModel === "gemini-2.0-flash-lite") {
            setSelectedModel("gemini-3.1-flash-lite");
          } else {
            setSelectedModel(savedModel);
          }
        } else if (providerCandidate === "arvan") {
          setSelectedModel(
            savedModel === "gpt-4o-mini" || savedModel.startsWith("gemini-")
              ? "Gemini-3-Flash-Preview"
              : savedModel
          );
        } else {
          setSelectedModel(
            savedModel.startsWith("gemini-") ||
              savedModel === "Gemini-3-Flash-Preview"
              ? "gpt-4o-mini"
              : savedModel
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const geminiModels = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
    ];
    const avalaiModels = ["gpt-4o-mini"];
    const arvanModels = ["Gemini-3-Flash-Preview"];

    if (aiProvider === "gemini" && !geminiModels.includes(selectedModel)) {
      setSelectedModel("gemini-3.5-flash");
    }
    if (aiProvider === "avalai" && !avalaiModels.includes(selectedModel)) {
      setSelectedModel("gpt-4o-mini");
    }
    if (aiProvider === "arvan" && !arvanModels.includes(selectedModel)) {
      setSelectedModel("Gemini-3-Flash-Preview");
    }
  }, [aiProvider, selectedModel]);

  useEffect(() => {
    try {
      localStorage.setItem("jira_ai_provider", aiProvider);
      localStorage.setItem("jira_ai_model", selectedModel);
      // Legacy key for backward compatibility
      localStorage.setItem("jira_selected_gemini_model", selectedModel);
    } catch (e) {
      console.error("Failed to save selected AI config", e);
    }
  }, [aiProvider, selectedModel]);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiPlan, setAiPlan] = useState<AIWorklogPlanItem[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [publishingAiLogs, setPublishingAiLogs] = useState(false);
  const [aiPublishSuccessMsg, setAiPublishSuccessMsg] = useState<string | null>(
    null
  );

  // Initialize
  const isConnected = jiraConnected && !!jiraUrl;

  const fetchIssues = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jira/my-issues");
      const data = await res.json();
      if (res.ok && data.success) {
        setIssues(data.issues || []);
      } else {
        setError(data.error || t.loadError);
      }
    } catch (err: any) {
      setError(err.message || t.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchIssues();
    }
  }, [isConnected]);

  // Unique status list & issue type list for filter dropdowns
  const uniqueTypes = Array.from(
    new Set(issues.map((i) => i.issuetype).filter((type) => type !== "Epic"))
  );
  const uniqueStatuses = Array.from(new Set(issues.map((i) => i.status)));

  const typeFilterItems = [
    { label: t.filterType, value: "ALL" },
    ...uniqueTypes.map((type) => ({ label: type, value: type })),
  ];
  const statusFilterItems = [
    { label: t.filterStatus, value: "ALL" },
    ...uniqueStatuses.map((status) => ({ label: status, value: status })),
  ];

  const assigneeOptions = [
    { value: "ALL", label: `🌟 ${t.allUsersOption}` },
    ...jiraUsers.map((u) => ({
      value: u.name,
      label: `👤 ${u.displayName}`,
      sublabel: u.name,
    })),
  ];

  // Filter logic
  const filteredIssues = issues.filter((issue) => {
    // Search query match
    const matchSearch =
      (issue.key || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.summary || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.assignee || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.assigneeDisplayName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    // Type match
    const matchType = selectedType === "ALL" || issue.issuetype === selectedType;

    // Status match
    const matchStatus =
      selectedStatus === "ALL" || issue.status === selectedStatus;

    // Target user assignee match
    const matchAssignee = matchesSelectedAssignee(issue, selectedAssignee);

    return (
      matchSearch &&
      matchType &&
      matchStatus &&
      matchAssignee &&
      issue.issuetype !== "Epic"
    );
  });

  // Handle Manual Log Submit
  const handleLogWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLogIssue || !logTime.trim()) return;

    setSubmittingLog(true);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/jira/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: activeLogIssue.key,
          timeSpent: logTime.trim(),
          comment: logComment.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(t.logSuccess);
        setLogTime("");
        setLogComment("");
        setTimeout(() => {
          setActiveLogIssue(null);
          setSuccessMsg(null);
        }, 2000);
        // Refresh list to update spent times
        fetchIssues();
      } else {
        alert(data.error || "Failed to save worklog.");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setSubmittingLog(false);
    }
  };

  // Analyze Daily Prompt using AI
  const handleGenerateAIPlan = async () => {
    if (!aiPrompt.trim()) return;
    setAiPlanning(true);
    setAiPlan([]);
    setAiError(null);
    setAiPublishSuccessMsg(null);

    // Send only Story/Bug/Task issues as potential parent candidates
    const parentCandidates = issues.filter(
      (issue) => issue.issuetype !== "Epic" && issue.issuetype !== "Sub-task"
    );

    try {
      const res = await fetch("/api/jira/ai-worklog-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          issues: parentCandidates, // Send candidates so Gemini can find parents
          language: language,
          model: selectedModel,
          provider: aiProvider,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.proposals && data.proposals.length > 0) {
          // Initialize AI proposals with client-side state
          setAiPlan(
            data.proposals.map((item: any, idx: number) => ({
              id: `proposal-${idx}-${Date.now()}`,
              parentType: item.parentType,
              parentKey: item.parentKey || "",
              candidateParentKeys: item.candidateParentKeys || [],
              proposedParentStory: item.proposedParentStory || {
                summary: "",
                description: "",
              },
              subTaskSummary: item.subTaskSummary,
              timeSpent: item.timeSpent,
              comment: item.comment,
              started: getLocalDatetimeString(),
              selected: true,
              status: "pending",
            }))
          );
        } else {
          setAiError(t.noMatches);
        }
      } else {
        setAiError(data.error || "Failed to generate AI worklog plan.");
      }
    } catch (err: any) {
      setAiError(err.message || "An unexpected error occurred.");
    } finally {
      setAiPlanning(false);
    }
  };

  // Publish Selected AI Proposed Logs
  const handlePublishAILogs = async () => {
    const selectedLogs = aiPlan.filter((item) => item.selected);
    if (selectedLogs.length === 0) return;

    setPublishingAiLogs(true);
    setAiPublishSuccessMsg(null);

    // Create a mutable copy of aiPlan to update progress status live in UI
    let currentPlan = [...aiPlan];

    try {
      for (let i = 0; i < currentPlan.length; i++) {
        const item = currentPlan[i];
        if (!item.selected) continue;

        let resolvedParentKey = item.parentKey;

        try {
          // Step 1: If parent is new, create the parent Story in Jira
          if (item.parentType === "new") {
            item.status = "creating-parent";
            setAiPlan([...currentPlan]);

            const parentRes = await fetch("/api/jira/create-issue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                issue: {
                  summary:
                    item.proposedParentStory?.summary ||
                    "New Story from AI Worklog",
                  description:
                    item.proposedParentStory?.description ||
                    "Created automatically from AI worklog daily log analysis.",
                  issuetype: "Story",
                },
              }),
            });

            const parentData = await parentRes.json();
            if (parentRes.ok && parentData.success && parentData.key) {
              resolvedParentKey = parentData.key;
            } else {
              throw new Error(
                parentData.error || "Failed to create parent Story"
              );
            }
          }

          if (!resolvedParentKey) {
            throw new Error("No parent Story key found or specified.");
          }

          // Step 2: Create Sub-task under parent key assigned to target selected user
          item.status = "creating-subtask";
          setAiPlan([...currentPlan]);

          const subtaskRes = await fetch("/api/jira/create-issue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              issue: {
                summary: item.subTaskSummary,
                description: item.comment,
                issuetype: "Sub-task",
                parentKey: resolvedParentKey,
                selectedAssignee:
                  selectedAssignee !== "ALL" ? selectedAssignee : jiraUsername,
              },
            }),
          });

          const subtaskData = await subtaskRes.json();
          if (!subtaskRes.ok || !subtaskData.success || !subtaskData.key) {
            throw new Error(subtaskData.error || "Failed to create Sub-task");
          }

          const resolvedSubtaskKey = subtaskData.key;

          // Step 2.5: Transition newly created Sub-task to Done
          item.status = "transitioning";
          setAiPlan([...currentPlan]);

          try {
            const transitionRes = await fetch("/api/jira/transition-to-done", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                issueKey: resolvedSubtaskKey,
              }),
            });
            const transitionData = await transitionRes.json();
            if (!transitionRes.ok || transitionData.success === false) {
              console.warn(
                `Could not transition ${resolvedSubtaskKey} to Done:`,
                transitionData.error || transitionData.message
              );
            } else {
              console.log(
                `Successfully transitioned ${resolvedSubtaskKey} to Done`
              );
            }
          } catch (tErr) {
            console.error(
              "Transition error ignored to prevent worklog block",
              tErr
            );
          }

          // Step 3: Log work directly on the newly created Sub-task
          item.status = "logging";
          setAiPlan([...currentPlan]);

          let formattedStarted = undefined;
          if (item.started) {
            try {
              formattedStarted = new Date(item.started).toISOString();
            } catch (dtErr) {
              console.error("Failed to parse start date/time", dtErr);
            }
          }

          const logRes = await fetch("/api/jira/worklog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              issueKey: resolvedSubtaskKey,
              timeSpent: item.timeSpent,
              comment: item.comment,
              started: formattedStarted,
            }),
          });

          const logData = await logRes.json();
          if (logRes.ok && logData.success) {
            item.status = "success";

            // Add successful item to recent logs list
            const newRecentItem: RecentLogItem = {
              issueKey: resolvedSubtaskKey,
              summary: item.subTaskSummary,
              parentKey: resolvedParentKey,
              timeSpent: item.timeSpent,
              comment: item.comment,
              timestamp: new Date().toISOString(),
              url: `${(jiraUrl || "").replace(/\/$/, "")}/browse/${resolvedSubtaskKey}`,
            };
            setRecentLogs((prev) => [newRecentItem, ...prev].slice(0, 10));
          } else {
            throw new Error(
              logData.error ||
                "Failed to submit worklog to newly created Sub-task"
            );
          }
        } catch (err: any) {
          console.error("Failed to publish proposal item:", err);
          item.status = "failed";
          item.error = err.message || "An error occurred";
        }

        setAiPlan([...currentPlan]);
      }

      // Check if any failed or if all succeeded
      const hasFailed = currentPlan.some(
        (item) => item.selected && item.status === "failed"
      );
      if (!hasFailed) {
        setAiPublishSuccessMsg(t.aiPublishSuccess);
        setAiPlan([]);
        setAiPrompt("");
      } else {
        setAiPublishSuccessMsg(
          language === "fa"
            ? "برخی موارد با خطا مواجه شدند. جزئیات خطا را بازبینی کنید."
            : "Some items failed to register. Please review the errors below."
        );
      }
      fetchIssues(); // Refresh board
    } catch (err: any) {
      alert("Error occurred while publishing logs: " + err.message);
    } finally {
      setPublishingAiLogs(false);
    }
  };

  // Helper to format total seconds into human readable e.g., 2h 30m
  const formatTimeSpent = (seconds: number) => {
    if (!seconds) return "0h";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}${t.hoursShort} ${m}${t.minutesShort}`;
    if (h > 0) return `${h}${t.hoursShort}`;
    return `${m}${t.minutesShort}`;
  };

  const parentStoryOptions = (item: AIWorklogPlanItem) => {
    const candidateKeys = item.candidateParentKeys || [];
    const candidateOpts = candidateKeys.map((k) => {
      const issueObj = issues.find((i) => i.key === k);
      return {
        value: k,
        label: issueObj ? `${k} - ${issueObj.summary}` : k,
        sublabel: t.chooseFromCandidates,
      };
    });
    const allParents = issues
      .filter((i) => i.issuetype !== "Epic" && i.issuetype !== "Sub-task")
      .filter((p) => !candidateKeys.includes(p.key))
      .map((p) => ({
        value: p.key,
        label: `${p.key} - ${p.summary}`,
        sublabel: p.issuetype,
      }));
    return [...candidateOpts, ...allParents];
  };

  if (!isConnected) {
    return (
      <Empty className="mx-auto max-w-xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle className="text-warning" />
          </EmptyMedia>
          <EmptyTitle>{t.notConnected}</EmptyTitle>
          <EmptyDescription>{t.notConnectedDesc}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Intro Header */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-primary-foreground/10 p-2 text-primary-foreground">
                <ClipboardList className="size-5" />
              </div>
              <CardTitle className="text-base sm:text-lg">
                {t.title}
              </CardTitle>
            </div>
            <CardDescription className="max-w-3xl text-primary-foreground/80">
              {t.subtitle}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={fetchIssues}
            disabled={loading}
            className="self-start sm:self-auto"
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            {t.refreshBtn}
          </Button>
        </CardHeader>
      </Card>

      {/* Target User Selector */}
      <Card>
        <CardContent className="flex flex-col justify-between gap-4 pt-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary">
              <User className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h4 className="text-xs font-semibold tracking-wider text-foreground uppercase">
                {t.targetUserLabel}
              </h4>
              <p className="text-xs leading-normal text-muted-foreground">
                {t.selectedUserHelp}
              </p>
            </div>
          </div>

          <div className="w-full md:w-80">
            <SearchableSelect
              options={assigneeOptions}
              value={selectedAssignee}
              onChange={setSelectedAssignee}
              placeholder={t.searchUserPlaceholder}
              isRtl={isRtl}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>
            {isRtl ? "خطای سیستم جیرا" : "Jira System Error"}
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Main Grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left: AI Worklog Assist */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <CardTitle className="text-sm">{t.aiBoxTitle}</CardTitle>
              </div>
              <CardDescription>{t.aiBoxDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-4">
                <div className="flex flex-col justify-between gap-2 rounded-lg border bg-muted/40 p-2.5 sm:flex-row sm:items-center">
                  <Field className="gap-1.5 sm:flex-row sm:items-center">
                    <FieldLabel className="flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="size-3.5 text-primary" />
                      {t.aiProviderLabel}
                    </FieldLabel>
                    <SearchableSelect
                      options={[
                        { value: "gemini", label: "Gemini" },
                        { value: "avalai", label: "AvalAI" },
                        { value: "arvan", label: "Arvan AIaaS" },
                      ]}
                      value={aiProvider}
                      onChange={(val) => setAiProvider(val as AIProvider)}
                      isRtl={isRtl}
                      showSearch={false}
                      className="sm:w-40"
                    />
                  </Field>

                  <Field className="gap-1.5 sm:flex-row sm:items-center">
                    <FieldLabel className="flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="size-3.5 text-primary" />
                      {t.geminiModelLabel}
                    </FieldLabel>
                    <SearchableSelect
                      options={
                        aiProvider === "gemini"
                          ? [
                              {
                                value: "gemini-3.5-flash",
                                label: t.geminiModelFlashDesc,
                              },
                              {
                                value: "gemini-3.1-pro-preview",
                                label: t.geminiModelProDesc,
                              },
                              {
                                value: "gemini-3.1-flash-lite",
                                label: t.geminiModelLiteDesc,
                              },
                            ]
                          : aiProvider === "avalai"
                            ? [
                                {
                                  value: "gpt-4o-mini",
                                  label: t.avalaiModelDesc,
                                },
                              ]
                            : [
                                {
                                  value: "Gemini-3-Flash-Preview",
                                  label: t.arvanModelDesc,
                                },
                              ]
                      }
                      value={selectedModel}
                      onChange={setSelectedModel}
                      isRtl={isRtl}
                      showSearch={false}
                      className="sm:min-w-56"
                    />
                  </Field>
                </div>

                <Field>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={
                      isRtl ? t.aiPromptPlaceholderFa : t.aiPromptPlaceholder
                    }
                    rows={4}
                    dir={isRtl ? "rtl" : "ltr"}
                  />
                </Field>

                <Button
                  type="button"
                  className="w-full"
                  onClick={handleGenerateAIPlan}
                  disabled={aiPlanning || !aiPrompt.trim() || issues.length === 0}
                >
                  {aiPlanning ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Sparkles data-icon="inline-start" />
                  )}
                  {aiPlanning ? t.aiGenerating : t.aiGenerateBtn}
                </Button>

                {aiError ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{aiError}</AlertDescription>
                  </Alert>
                ) : null}

                {aiPublishSuccessMsg ? (
                  <Alert>
                    <CheckCircle className="text-success" />
                    <AlertDescription>{aiPublishSuccessMsg}</AlertDescription>
                  </Alert>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>

          {/* AI Worklog Proposal Plan */}
          {aiPlan.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xs tracking-wider uppercase">
                  {t.aiPlanTitle}
                </CardTitle>
                <CardDescription>{t.aiPlanDesc}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex max-h-[500px] flex-col gap-4 overflow-y-auto pe-1">
                  {aiPlan.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4 text-start"
                    >
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={!!item.selected}
                            onCheckedChange={(checked) => {
                              const updated = [...aiPlan];
                              updated[index].selected = !!checked;
                              setAiPlan(updated);
                            }}
                          />
                          <span className="text-xs font-bold text-foreground">
                            {t.proposalHeader} #{index + 1}
                          </span>
                        </div>

                        {item.status && item.status !== "pending" ? (
                          <Badge variant={planStatusVariant(item.status)}>
                            {item.status === "success" && `✓ ${t.statusSuccess}`}
                            {item.status === "failed" && `✕ ${t.statusFailed}`}
                            {item.status === "creating-parent" &&
                              t.statusCreatingParent}
                            {item.status === "creating-subtask" &&
                              t.statusCreatingSubtask}
                            {item.status === "transitioning" &&
                              t.statusTransitioning}
                            {item.status === "logging" && t.statusLogging}
                          </Badge>
                        ) : null}
                      </div>

                      <Separator />

                      {/* Parent Story Block */}
                      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                          <span className="text-[10px] font-extrabold tracking-wider text-primary uppercase">
                            {t.parentStoryLabel}
                          </span>
                          <ToggleGroup
                            value={[item.parentType]}
                            onValueChange={(v) => {
                              if (!v[0]) return;
                              const updated = [...aiPlan];
                              updated[index].parentType = v[0] as
                                | "existing"
                                | "new";
                              setAiPlan(updated);
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <ToggleGroupItem value="existing">
                              {t.existingParentOption}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="new">
                              {t.newParentOption}
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>

                        {item.parentType === "existing" ? (
                          <Field>
                            <SearchableSelect
                              options={parentStoryOptions(item)}
                              value={item.parentKey || ""}
                              onChange={(val) => {
                                const updated = [...aiPlan];
                                updated[index].parentKey = val;
                                setAiPlan(updated);
                              }}
                              placeholder={t.selectParentPlaceholder}
                              isRtl={isRtl}
                            />
                          </Field>
                        ) : (
                          <FieldGroup className="gap-2 text-start">
                            <Field>
                              <FieldLabel className="text-[10px] tracking-wider uppercase">
                                {t.newStorySummaryLabel}
                              </FieldLabel>
                              <Input
                                type="text"
                                value={item.proposedParentStory?.summary || ""}
                                onChange={(e) => {
                                  const updated = [...aiPlan];
                                  updated[index].proposedParentStory = {
                                    summary: e.target.value,
                                    description:
                                      updated[index].proposedParentStory
                                        ?.description || "",
                                  };
                                  setAiPlan(updated);
                                }}
                              />
                            </Field>
                            <Field>
                              <FieldLabel className="text-[10px] tracking-wider uppercase">
                                {t.newStoryDescLabel}
                              </FieldLabel>
                              <Textarea
                                rows={2}
                                value={
                                  item.proposedParentStory?.description || ""
                                }
                                onChange={(e) => {
                                  const updated = [...aiPlan];
                                  updated[index].proposedParentStory = {
                                    summary:
                                      updated[index].proposedParentStory
                                        ?.summary || "",
                                    description: e.target.value,
                                  };
                                  setAiPlan(updated);
                                }}
                              />
                            </Field>
                          </FieldGroup>
                        )}
                      </div>

                      {/* Sub-task Block */}
                      <div className="grid grid-cols-1 gap-3 text-start md:grid-cols-4">
                        <Field className="md:col-span-2">
                          <FieldLabel className="text-[10px] tracking-wider text-primary uppercase">
                            {t.subTaskTitleLabel}
                          </FieldLabel>
                          <Input
                            type="text"
                            value={item.subTaskSummary}
                            onChange={(e) => {
                              const updated = [...aiPlan];
                              updated[index].subTaskSummary = e.target.value;
                              setAiPlan(updated);
                            }}
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-[10px] tracking-wider text-primary uppercase">
                            {t.timeSpentLabel}
                          </FieldLabel>
                          <Input
                            type="text"
                            value={item.timeSpent}
                            onChange={(e) => {
                              const updated = [...aiPlan];
                              updated[index].timeSpent = e.target.value;
                              setAiPlan(updated);
                            }}
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-[10px] tracking-wider text-primary uppercase">
                            {t.startTimeLabel}
                          </FieldLabel>
                          <Input
                            type="datetime-local"
                            value={item.started || ""}
                            onChange={(e) => {
                              const updated = [...aiPlan];
                              updated[index].started = e.target.value;
                              setAiPlan(updated);
                            }}
                          />
                        </Field>
                      </div>

                      <Field className="text-start">
                        <FieldLabel className="text-[10px] tracking-wider text-primary uppercase">
                          {t.worklogCommentLabel}
                        </FieldLabel>
                        <Textarea
                          rows={2}
                          value={item.comment}
                          onChange={(e) => {
                            const updated = [...aiPlan];
                            updated[index].comment = e.target.value;
                            setAiPlan(updated);
                          }}
                        />
                      </Field>

                      {item.error ? (
                        <Alert variant="destructive">
                          <AlertCircle />
                          <AlertDescription>{item.error}</AlertDescription>
                        </Alert>
                      ) : null}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  onClick={handlePublishAILogs}
                  disabled={
                    publishingAiLogs ||
                    aiPlan.filter((i) => i.selected).length === 0
                  }
                >
                  {publishingAiLogs ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <CheckSquare data-icon="inline-start" />
                  )}
                  {publishingAiLogs
                    ? t.aiPublishing
                    : `${t.aiPublishSelected} (${aiPlan.filter((i) => i.selected).length})`}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Quick manual work log */}
          {activeLogIssue ? (
            <Card className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute end-3 top-3"
                onClick={() => setActiveLogIssue(null)}
              >
                <X />
              </Button>
              <CardHeader>
                <div className="flex items-center gap-2 pe-8">
                  <Clock className="size-5 text-primary" />
                  <CardTitle className="text-sm">
                    {t.quickLogTitle}:{" "}
                    <span className="font-mono text-xs text-primary">
                      {activeLogIssue.key}
                    </span>
                  </CardTitle>
                </div>
                <CardDescription>{activeLogIssue.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogWork}>
                  <FieldGroup className="gap-3.5">
                    <Field>
                      <FieldLabel htmlFor="log-time">{t.logTimeLabel}</FieldLabel>
                      <Input
                        id="log-time"
                        type="text"
                        required
                        value={logTime}
                        onChange={(e) => setLogTime(e.target.value)}
                        placeholder="e.g. 2h 30m, 45m, 1d"
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="log-comment">
                        {t.logCommentLabel}
                      </FieldLabel>
                      <Textarea
                        id="log-comment"
                        value={logComment}
                        onChange={(e) => setLogComment(e.target.value)}
                        placeholder="Write a brief comment about what was done..."
                        rows={2}
                      />
                    </Field>

                    {successMsg ? (
                      <Alert>
                        <CheckCircle className="text-success" />
                        <AlertDescription>{successMsg}</AlertDescription>
                      </Alert>
                    ) : null}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submittingLog}
                    >
                      {submittingLog ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Send data-icon="inline-start" />
                      )}
                      {submittingLog ? t.logging : t.logBtn}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {/* Recently Logged Tasks */}
          {recentLogs.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-5 text-success" />
                  <CardTitle className="text-sm">{t.recentLogsTitle}</CardTitle>
                </div>
                <AlertDialog
                  open={clearRecentOpen}
                  onOpenChange={setClearRecentOpen}
                >
                  <AlertDialogTrigger
                    render={<Button variant="outline" size="sm" />}
                  >
                    <Trash2 data-icon="inline-start" />
                    {t.clearRecentBtn}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t.clearRecentConfirmTitle}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.clearRecentConfirmDesc}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t.clearRecentCancel}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          setRecentLogs([]);
                          setClearRecentOpen(false);
                        }}
                      >
                        {t.clearRecentBtn}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent>
                <div className="flex max-h-72 flex-col gap-3.5 overflow-y-auto pe-1">
                  {recentLogs.map((log, index) => (
                    <div
                      key={`${log.issueKey}-${index}`}
                      className="group flex flex-col gap-2.5 rounded-xl border bg-muted/40 p-3.5 text-start"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <Badge variant="secondary" className="font-mono">
                              {log.issueKey}
                            </Badge>
                            {log.parentKey ? (
                              <span className="font-mono text-muted-foreground">
                                (Parent: {log.parentKey})
                              </span>
                            ) : null}
                            <span className="font-medium text-muted-foreground">
                              •{" "}
                              {new Date(log.timestamp).toLocaleTimeString(
                                language === "fa" ? "fa-IR" : "en-US",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                          <h5 className="text-xs leading-snug font-bold text-foreground group-hover:text-primary">
                            {log.summary}
                          </h5>
                        </div>

                        <Button
                          render={
                            <a
                              href={log.url}
                              target="_blank"
                              rel="noreferrer"
                              referrerPolicy="no-referrer"
                            />
                          }
                          nativeButton={false}
                          variant="outline"
                          size="xs"
                          className="shrink-0"
                        >
                          {isRtl ? "مشاهده" : "Open"}
                          <ExternalLink data-icon="inline-end" />
                        </Button>
                      </div>

                      <Separator />

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3.5 text-success" />
                          <span>
                            {t.timeSpentLabel}:{" "}
                            <strong className="text-foreground">
                              {log.timeSpent}
                            </strong>
                          </span>
                        </div>
                        {log.comment ? (
                          <div className="mt-1 w-full rounded border bg-card px-2 py-1 text-[11px] leading-normal font-medium text-muted-foreground italic">
                            {log.comment}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right: Project Issues Board */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card>
            <CardContent className="flex flex-col gap-3.5 pt-6">
              <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <InputGroup className="flex-1">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                  />
                </InputGroup>

                <Badge variant="secondary" className="shrink-0 self-start sm:self-auto">
                  <User data-icon="inline-start" />
                  {selectedAssignee === "ALL"
                    ? t.allUsersOption
                    : jiraUsers.find((u) => u.name === selectedAssignee)
                        ?.displayName || selectedAssignee}
                </Badge>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Select
                  items={typeFilterItems}
                  value={selectedType}
                  onValueChange={(v) => {
                    if (v != null) setSelectedType(String(v));
                  }}
                >
                  <SelectTrigger size="sm" className="w-auto min-w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {typeFilterItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Select
                  items={statusFilterItems}
                  value={selectedStatus}
                  onValueChange={(v) => {
                    if (v != null) setSelectedStatus(String(v));
                  }}
                >
                  <SelectTrigger size="sm" className="w-auto min-w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statusFilterItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Spinner className="size-8 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t.loadingIssues}
                </p>
              </CardContent>
            </Card>
          ) : filteredIssues.length > 0 ? (
            <div className="flex max-h-[640px] flex-col gap-3.5 overflow-y-auto pe-1">
              {filteredIssues.map((issue) => {
                const isExpanded = expandedIssueKey === issue.key;

                return (
                  <Card key={issue.key}>
                    <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start">
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <Badge variant="secondary" className="font-mono">
                            {issue.key}
                          </Badge>
                          <Badge variant={issueTypeVariant(issue.issuetype)}>
                            {issue.issuetype}
                          </Badge>
                          <Badge
                            variant={
                              issue.priority === "Highest" ||
                              issue.priority === "High"
                                ? "warning"
                                : "outline"
                            }
                          >
                            {issue.priority}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="ms-auto uppercase tracking-wider sm:ms-0"
                          >
                            {issue.status}
                          </Badge>
                        </div>

                        <h5 className="pt-0.5 text-xs leading-snug font-bold text-foreground sm:text-sm">
                          {issue.summary}
                        </h5>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] font-medium text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="size-3.5 shrink-0" />
                            <span>
                              {issue.assigneeDisplayName
                                ? issue.assigneeDisplayName
                                : issue.assignee
                                  ? `@${issue.assignee}`
                                  : (
                                      <span className="text-muted-foreground italic">
                                        {t.unassigned}
                                      </span>
                                    )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock className="size-3.5 shrink-0" />
                            <span>
                              {t.ticketTimeLogged}:{" "}
                              <strong className="text-foreground">
                                {formatTimeSpent(issue.timespent)}
                              </strong>
                            </span>
                            {issue.timeoriginalestimate > 0 ? (
                              <span className="text-[10px] text-muted-foreground">
                                ({t.originalEstimate}:{" "}
                                {formatTimeSpent(issue.timeoriginalestimate)})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setExpandedIssueKey(isExpanded ? null : issue.key);
                          }}
                        >
                          {isExpanded ? t.hideLogs : t.showLogs}
                        </Button>

                        <Button
                          type="button"
                          size="xs"
                          onClick={() => {
                            setActiveLogIssue(issue);
                            setLogTime("");
                            setLogComment("");
                          }}
                        >
                          <PlusCircle data-icon="inline-start" />
                          {t.logBtn}
                        </Button>
                      </div>
                    </CardContent>

                    {isExpanded ? (
                      <>
                        <Separator />
                        <CardContent className="flex flex-col gap-2.5 bg-muted/40 py-3.5">
                          <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                            {isRtl
                              ? "سوابق ساعت کاری ثبت شده"
                              : "Logged Worklog History"}
                          </span>

                          {issue.worklogs && issue.worklogs.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {issue.worklogs.map((wl) => (
                                <div
                                  key={wl.id}
                                  className="flex items-start justify-between gap-3 rounded-lg border bg-card p-2.5 text-xs"
                                >
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      <span className="font-bold text-foreground">
                                        {wl.author}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {new Date(wl.created).toLocaleDateString(
                                          language === "fa" ? "fa-IR" : "en-US"
                                        )}
                                      </span>
                                    </div>
                                    <p className="leading-relaxed font-medium text-muted-foreground">
                                      {wl.comment || (
                                        <span className="italic">
                                          {isRtl
                                            ? "بدون توضیح"
                                            : "No description"}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="secondary"
                                    className="shrink-0 font-mono text-[10px]"
                                  >
                                    {wl.timeSpent}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">
                              {t.noWorklogsLogged}
                            </p>
                          )}
                        </CardContent>
                      </>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Empty className="border border-dashed py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardList />
                </EmptyMedia>
                <EmptyTitle>
                  {isRtl ? "هیچ تیکتی یافت نشد" : "No Tickets Found"}
                </EmptyTitle>
                <EmptyDescription>{t.noIssuesFound}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
