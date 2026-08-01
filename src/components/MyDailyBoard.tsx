import React, { useState, useEffect } from 'react';
import { JiraCredentials, Language, JiraUser } from '../types';
import { 
  ClipboardList, RefreshCw, Search, Filter, Clock, Send, 
  Sparkles, CheckCircle, AlertCircle, HelpCircle, User, 
  ChevronRight, Play, Loader2, Check, CheckSquare, PlusCircle,
  ChevronDown, Trash2, ExternalLink
} from 'lucide-react';

interface MyDailyBoardProps {
  language: Language;
  credentials: JiraCredentials;
  projectKey: string;
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
  parentType: 'existing' | 'new';
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
  status?: 'pending' | 'creating-parent' | 'creating-subtask' | 'logging' | 'success' | 'failed' | 'transitioning';
  error?: string;
}

const translations = {
  en: {
    title: "Daily My Work & Board",
    subtitle: "Check active tickets for the current project, log time spent, or use AI to parse your daily summary and log work in batch.",
    loadError: "Failed to load project tickets. Please verify your Jira connection and project key in Tab 1.",
    notConnected: "Jira Connection Required",
    notConnectedDesc: "Please connect to your self-hosted Jira Server first in '1. Connection & Config' tab to view your daily board.",
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
    aiBoxDesc: "Enter your daily accomplishments in plain text (English or Persian). The AI will identify matching tickets, distribute your hours, and write professional worklog descriptions.",
    aiPromptPlaceholder: "e.g., Today I spent 3 hours on debugging the signup SMS verification (PROJ-12), and 4 hours writing API documentation for user profiles.",
    aiPromptPlaceholderFa: "مثال: امروز ۳ ساعت روی دیباگ کردن تایید پیامکی ثبت نام کار کردم و ۴ ساعت مستندات API پروفایل کاربرها رو نوشتم.",
    aiGenerateBtn: "Analyze & Plan Log",
    aiGenerating: "Analyzing your work...",
    aiPlanTitle: "AI Proposed Worklog Plan",
    aiPlanDesc: "Review and edit the suggested logs before posting to Jira.",
    aiPublishSelected: "Submit Selected Logs to Jira",
    aiPublishing: "Publishing logs...",
    aiPublishSuccess: "All selected worklogs published successfully!",
    noMatches: "Gemini couldn't match your text to any active issues. Please check the ticket keys or try clarifying your prompt.",
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
    selectedUserHelp: "Showing active tasks and analyzing daily work for this user.",
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
    geminiModelLabel: "Gemini Model:",
    geminiModelFlashDesc: "⚡ Gemini 3.5 Flash (Fast / Default)",
    geminiModelProDesc: "🧠 Gemini 3.1 Pro (Deep Reasoning)",
    geminiModelLiteDesc: "🍃 Gemini 3.1 Flash Lite (Lightweight / Ultra-fast)"
  },
  fa: {
    title: "میز کار و بورد روزانه من",
    subtitle: "بررسی تیکت‌های فعال در پروژه جاری، ثبت دستی زمان کاری، یا استفاده از هوش مصنوعی برای تحلیل و ثبت دسته‌ای کارهای روزانه.",
    loadError: "خطا در دریافت تیکت‌های پروژه. لطفاً اتصال جیرا و کلید پروژه را در تب اول بررسی کنید.",
    notConnected: "نیاز به اتصال به جیرا",
    notConnectedDesc: "برای مشاهده بورد روزانه، ابتدا در تب «۱. اتصال و تنظیمات جیرا» به سرور جیرا خود متصل شوید.",
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
    aiBoxDesc: "گزارش کارهای روزانه خود را به زبان عامیانه (فارسی یا انگلیسی) وارد کنید. هوش مصنوعی تیکت‌های مرتبط را پیدا کرده، زمان را تقسیم می‌کند و توضیحات رسمی و حرفه‌ای برای هر تیکت می‌نویسد.",
    aiPromptPlaceholder: "مثال: امروز ۳ ساعت روی دیباگ کردن تایید پیامکی ثبت نام کار کردم و ۴ ساعت مستندات API پروفایل کاربرها رو نوشتم.",
    aiPromptPlaceholderFa: "مثال: امروز ۳ ساعت روی دیباگ کردن تایید پیامکی ثبت نام کار کردم و ۴ ساعت مستندات API پروفایل کاربرها رو نوشتم.",
    aiGenerateBtn: "تحلیل هوشمند و برنامه‌ریزی کارکرد",
    aiGenerating: "در حال تحلیل کارهای روزانه...",
    aiPlanTitle: "برنامه پیشنهادی هوش مصنوعی",
    aiPlanDesc: "پیشنهادات را بررسی کنید و تیکت‌هایی که می‌خواهید ثبت شوند را تایید کنید.",
    aiPublishSelected: "ثبت موارد انتخاب شده در جیرا",
    aiPublishing: "در حال ثبت در جیرا...",
    aiPublishSuccess: "تمامی ساعت‌های کاری با موفقیت در جیرا ثبت شدند!",
    noMatches: "هوش مصنوعی نتوانست متنی مرتبط با تیکت‌های فعال پیدا کند. لطفاً توضیحات خود را دقیق‌تر بنویسید یا کلیدهای تیکت را بررسی کنید.",
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
    selectedUserHelp: "نمایش تیکت‌های فعال و تحلیل گزارش کارکرد روزانه برای کاربر انتخاب‌شده.",
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
    geminiModelLabel: "مدل جمنای:",
    geminiModelFlashDesc: "⚡ جمنای ۳.۵ فلش (سریع / پیش‌فرض)",
    geminiModelProDesc: "🧠 جمنای ۳.۱ پرو (استدلال دقیق‌تر)",
    geminiModelLiteDesc: "🍃 جمنای ۳.۱ فلش لایت (سبک و فوق سریع)"
  }
};

const getLocalDatetimeString = (date = new Date()) => {
  const tzoffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  return localISOTime;
};

export default function MyDailyBoard({ language, credentials, projectKey, jiraUsers }: MyDailyBoardProps) {
  const t = translations[language];
  const isRtl = language === 'fa';

  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('ALL');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Initialize selectedAssignee based on credentials.username and fetched users list
  useEffect(() => {
    if (jiraUsers && jiraUsers.length > 0) {
      const cleanUsername = (credentials.username || '').trim().toLowerCase();
      if (cleanUsername) {
        const match = jiraUsers.find(u => 
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
    } else if (credentials.username) {
      setSelectedAssignee(credentials.username);
    } else {
      setSelectedAssignee('ALL');
    }
  }, [jiraUsers, credentials.username]);

  // Helper matcher to verify if issue belongs to selected target user
  const matchesSelectedAssignee = (issue: JiraIssue, targetUsername: string) => {
    if (!targetUsername || targetUsername === 'ALL') return true;

    const cleanTarget = targetUsername.trim().toLowerCase();
    const targetPrefix = cleanTarget.includes('@') ? cleanTarget.split('@')[0] : cleanTarget;

    const issueAssignee = (issue.assignee || "").trim().toLowerCase();
    const issueAssigneeEmail = (issue.assigneeEmail || "").trim().toLowerCase();
    const issueAssigneeKey = (issue.assigneeKey || "").trim().toLowerCase();
    const issueAssigneeDisplayName = (issue.assigneeDisplayName || "").trim().toLowerCase();

    // Find the user details if available
    const targetUserObj = jiraUsers.find(u => u.name.toLowerCase() === cleanTarget);
    const targetDisplayName = targetUserObj ? targetUserObj.displayName.trim().toLowerCase() : '';
    const targetEmail = targetUserObj && targetUserObj.emailAddress ? targetUserObj.emailAddress.trim().toLowerCase() : '';

    if (
      issueAssignee === cleanTarget ||
      issueAssigneeKey === cleanTarget ||
      issueAssigneeEmail === cleanTarget ||
      (issueAssignee && issueAssignee === targetPrefix) ||
      (issueAssigneeKey && issueAssigneeKey === targetPrefix) ||
      (issueAssigneeEmail && issueAssigneeEmail.split('@')[0] === targetPrefix) ||
      (issueAssignee && (issueAssignee.includes(targetPrefix) || targetPrefix.includes(issueAssignee)) && issueAssignee.length > 3 && targetPrefix.length > 3)
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
        issueAssigneeEmail.split('@')[0] === targetEmail.split('@')[0]
      ) {
        return true;
      }
    }

    return false;
  };

  // Manual Log State
  const [activeLogIssue, setActiveLogIssue] = useState<JiraIssue | null>(null);
  const [logTime, setLogTime] = useState('');
  const [logComment, setLogComment] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded Worklogs
  const [expandedIssueKey, setExpandedIssueKey] = useState<string | null>(null);

  // Recent Logs State
  const [recentLogs, setRecentLogs] = useState<RecentLogItem[]>(() => {
    try {
      const saved = localStorage.getItem('jira_recent_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to read recent logs", e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jira_recent_logs', JSON.stringify(recentLogs));
    } catch (e) {
      console.error("Failed to save recent logs", e);
    }
  }, [recentLogs]);

  // AI Planner State
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('jira_selected_gemini_model');
      if (saved === 'gemini-2.0-flash-lite') {
        return 'gemini-3.1-flash-lite';
      }
      return saved || 'gemini-3.5-flash';
    } catch (e) {
      return 'gemini-3.5-flash';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jira_selected_gemini_model', selectedModel);
    } catch (e) {
      console.error("Failed to save selected Gemini model", e);
    }
  }, [selectedModel]);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiPlan, setAiPlan] = useState<AIWorklogPlanItem[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [publishingAiLogs, setPublishingAiLogs] = useState(false);
  const [aiPublishSuccessMsg, setAiPublishSuccessMsg] = useState<string | null>(null);

  // Initialize
  const isConnected = credentials && credentials.url && projectKey;

  const fetchIssues = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jira/my-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey: projectKey
        })
      });
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
  const uniqueTypes = Array.from(new Set(issues.map(i => i.issuetype).filter(t => t !== 'Epic')));
  const uniqueStatuses = Array.from(new Set(issues.map(i => i.status)));

  // Filter logic
  const filteredIssues = issues.filter(issue => {
    // Search query match
    const matchSearch = 
      (issue.key || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.summary || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.assignee || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.assigneeDisplayName || "").toLowerCase().includes(searchQuery.toLowerCase());

    // Type match
    const matchType = selectedType === 'ALL' || issue.issuetype === selectedType;

    // Status match
    const matchStatus = selectedStatus === 'ALL' || issue.status === selectedStatus;

    // Target user assignee match
    const matchAssignee = matchesSelectedAssignee(issue, selectedAssignee);

    return matchSearch && matchType && matchStatus && matchAssignee && issue.issuetype !== 'Epic';
  });

  // Handle Manual Log Submit
  const handleLogWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLogIssue || !logTime.trim()) return;

    setSubmittingLog(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/jira/worklog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          issueKey: activeLogIssue.key,
          timeSpent: logTime.trim(),
          comment: logComment.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(t.logSuccess);
        setLogTime('');
        setLogComment('');
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
    const parentCandidates = issues.filter(issue => issue.issuetype !== 'Epic' && issue.issuetype !== 'Sub-task');

    try {
      const res = await fetch('/api/jira/ai-worklog-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          issues: parentCandidates, // Send candidates so Gemini can find parents
          language: language,
          model: selectedModel
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.proposals && data.proposals.length > 0) {
          // Initialize AI proposals with client-side state
          setAiPlan(data.proposals.map((item: any, idx: number) => ({
            id: `proposal-${idx}-${Date.now()}`,
            parentType: item.parentType,
            parentKey: item.parentKey || '',
            candidateParentKeys: item.candidateParentKeys || [],
            proposedParentStory: item.proposedParentStory || { summary: '', description: '' },
            subTaskSummary: item.subTaskSummary,
            timeSpent: item.timeSpent,
            comment: item.comment,
            started: getLocalDatetimeString(),
            selected: true,
            status: 'pending'
          })));
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
    const selectedLogs = aiPlan.filter(item => item.selected);
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
          if (item.parentType === 'new') {
            item.status = 'creating-parent';
            setAiPlan([...currentPlan]);

            const parentRes = await fetch('/api/jira/create-issue', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                creds: credentials,
                projectKey,
                issue: {
                  summary: item.proposedParentStory?.summary || "New Story from AI Worklog",
                  description: item.proposedParentStory?.description || "Created automatically from AI worklog daily log analysis.",
                  issuetype: 'Story'
                }
              })
            });

            const parentData = await parentRes.json();
            if (parentRes.ok && parentData.success && parentData.key) {
              resolvedParentKey = parentData.key;
            } else {
              throw new Error(parentData.error || "Failed to create parent Story");
            }
          }

          if (!resolvedParentKey) {
            throw new Error("No parent Story key found or specified.");
          }

          // Step 2: Create Sub-task under parent key assigned to target selected user
          item.status = 'creating-subtask';
          setAiPlan([...currentPlan]);

          const subtaskRes = await fetch('/api/jira/create-issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creds: credentials,
              projectKey,
              issue: {
                summary: item.subTaskSummary,
                description: item.comment,
                issuetype: 'Sub-task',
                parentKey: resolvedParentKey,
                selectedAssignee: selectedAssignee !== 'ALL' ? selectedAssignee : credentials.username
              }
            })
          });

          const subtaskData = await subtaskRes.json();
          if (!subtaskRes.ok || !subtaskData.success || !subtaskData.key) {
            throw new Error(subtaskData.error || "Failed to create Sub-task");
          }

          const resolvedSubtaskKey = subtaskData.key;

          // Step 2.5: Transition newly created Sub-task to Done
          item.status = 'transitioning';
          setAiPlan([...currentPlan]);

          try {
            const transitionRes = await fetch('/api/jira/transition-to-done', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                creds: credentials,
                issueKey: resolvedSubtaskKey
              })
            });
            const transitionData = await transitionRes.json();
            if (!transitionRes.ok || transitionData.success === false) {
              console.warn(`Could not transition ${resolvedSubtaskKey} to Done:`, transitionData.error || transitionData.message);
            } else {
              console.log(`Successfully transitioned ${resolvedSubtaskKey} to Done`);
            }
          } catch (tErr) {
            console.error("Transition error ignored to prevent worklog block", tErr);
          }

          // Step 3: Log work directly on the newly created Sub-task
          item.status = 'logging';
          setAiPlan([...currentPlan]);

          let formattedStarted = undefined;
          if (item.started) {
            try {
              formattedStarted = new Date(item.started).toISOString();
            } catch (dtErr) {
              console.error("Failed to parse start date/time", dtErr);
            }
          }

          const logRes = await fetch('/api/jira/worklog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creds: credentials,
              issueKey: resolvedSubtaskKey,
              timeSpent: item.timeSpent,
              comment: item.comment,
              started: formattedStarted
            })
          });

          const logData = await logRes.json();
          if (logRes.ok && logData.success) {
            item.status = 'success';

            // Add successful item to recent logs list
            const newRecentItem: RecentLogItem = {
              issueKey: resolvedSubtaskKey,
              summary: item.subTaskSummary,
              parentKey: resolvedParentKey,
              timeSpent: item.timeSpent,
              comment: item.comment,
              timestamp: new Date().toISOString(),
              url: `${credentials.url.replace(/\/$/, '')}/browse/${resolvedSubtaskKey}`
            };
            setRecentLogs(prev => [newRecentItem, ...prev].slice(0, 10));

          } else {
            throw new Error(logData.error || "Failed to submit worklog to newly created Sub-task");
          }

        } catch (err: any) {
          console.error("Failed to publish proposal item:", err);
          item.status = 'failed';
          item.error = err.message || "An error occurred";
        }

        setAiPlan([...currentPlan]);
      }

      // Check if any failed or if all succeeded
      const hasFailed = currentPlan.some(item => item.selected && item.status === 'failed');
      if (!hasFailed) {
        setAiPublishSuccessMsg(t.aiPublishSuccess);
        setAiPlan([]);
        setAiPrompt('');
      } else {
        setAiPublishSuccessMsg(language === 'fa' ? "برخی موارد با خطا مواجه شدند. جزئیات خطا را بازبینی کنید." : "Some items failed to register. Please review the errors below.");
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

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center max-w-xl mx-auto space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">{t.notConnected}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {t.notConnectedDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-850 rounded-xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-lg text-white">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                {t.title}
              </h3>
            </div>
            <p className="text-xs text-indigo-150 leading-relaxed max-w-3xl">
              {t.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchIssues}
            disabled={loading}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t.refreshBtn}</span>
          </button>
        </div>
      </div>

      {/* Target User Selector at the top of the Daily Board */}
      <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-0.5">
              {t.targetUserLabel}
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              {t.selectedUserHelp}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-80" id="assignee-combobox-container">
            <button
              type="button"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-800 rounded-lg px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-left"
            >
              <span className="truncate">
                {selectedAssignee === 'ALL' 
                  ? `🌟 ${t.allUsersOption}` 
                  : `👤 ${jiraUsers.find(u => u.name === selectedAssignee)?.displayName || selectedAssignee} (${selectedAssignee})`}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-1.5" />
            </button>

            {showUserDropdown && (
              <>
                {/* Overlay background to close the dropdown when clicking outside */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => {
                    setShowUserDropdown(false);
                    setUserSearchQuery('');
                  }}
                />
                
                <div className="absolute right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-fade-in max-h-72">
                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder={t.searchUserPlaceholder}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-56 divide-y divide-slate-50">
                    {/* ALL Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssignee('ALL');
                        setShowUserDropdown(false);
                        setUserSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold transition hover:bg-slate-50 flex items-center justify-between ${
                        selectedAssignee === 'ALL' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>🌟 {t.allUsersOption}</span>
                      {selectedAssignee === 'ALL' && <Check className="w-3.5 h-3.5 text-blue-600 font-bold" />}
                    </button>

                    {/* Filtered Jira Users list */}
                    {jiraUsers
                      .filter(u => {
                        const query = userSearchQuery.toLowerCase();
                        return (
                          u.displayName.toLowerCase().includes(query) ||
                          u.name.toLowerCase().includes(query) ||
                          (u.emailAddress && u.emailAddress.toLowerCase().includes(query))
                        );
                      })
                      .map((u) => {
                        const isSelected = selectedAssignee === u.name;
                        return (
                          <button
                            key={u.name}
                            type="button"
                            onClick={() => {
                              setSelectedAssignee(u.name);
                              setShowUserDropdown(false);
                              setUserSearchQuery('');
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition hover:bg-slate-50 flex items-center justify-between ${
                              isSelected ? 'text-blue-600 bg-blue-50/50 font-bold' : 'text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex flex-col text-left">
                              <span className="truncate">👤 {u.displayName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">@{u.name}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 font-bold" />}
                          </button>
                        );
                      })}

                    {/* Empty state inside dropdown */}
                    {jiraUsers.filter(u => {
                      const query = userSearchQuery.toLowerCase();
                      return (
                        u.displayName.toLowerCase().includes(query) ||
                        u.name.toLowerCase().includes(query) ||
                        (u.emailAddress && u.emailAddress.toLowerCase().includes(query))
                      );
                    }).length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        {language === 'fa' ? "هیچ کاربری یافت نشد" : "No users found"}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5 text-xs text-red-800 font-medium animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">{isRtl ? "خطای سیستم جیرا" : "Jira System Error"}</span>
            <p className="text-red-700 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Left Column (AI Log Assist) & Right Column (Ticket Board) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: AI Worklog Assist */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              <h4 className="text-sm font-bold text-slate-900">{t.aiBoxTitle}</h4>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {t.aiBoxDesc}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-150 rounded-lg p-2.5">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                {t.geminiModelLabel}
              </span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="gemini-3.5-flash">{t.geminiModelFlashDesc}</option>
                <option value="gemini-3.1-pro-preview">{t.geminiModelProDesc}</option>
                <option value="gemini-3.1-flash-lite">{t.geminiModelLiteDesc}</option>
              </select>
            </div>

            <div className="space-y-3">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={isRtl ? t.aiPromptPlaceholderFa : t.aiPromptPlaceholder}
                rows={4}
                className="w-full rounded-lg border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 outline-none leading-relaxed"
                style={{ direction: isRtl ? 'rtl' : 'ltr' }}
              />

              <button
                type="button"
                onClick={handleGenerateAIPlan}
                disabled={aiPlanning || !aiPrompt.trim() || issues.length === 0}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-lg text-xs shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {aiPlanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.aiGenerating}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t.aiGenerateBtn}</span>
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiPublishSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs flex items-center gap-2 font-medium">
                <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>{aiPublishSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* AI Worklog Proposal Plan */}
          {aiPlan.length > 0 && (
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 sm:p-5 shadow-md space-y-4 animate-fade-in border border-slate-800">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{t.aiPlanTitle}</h4>
                <p className="text-[10px] text-slate-400">{t.aiPlanDesc}</p>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {aiPlan.map((item, index) => (
                  <div key={item.id} className="p-4 bg-slate-800/90 rounded-xl border border-slate-700 space-y-4 text-left">
                    
                    {/* Header with Selection and Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => {
                            const updated = [...aiPlan];
                            updated[index].selected = !updated[index].selected;
                            setAiPlan(updated);
                          }}
                          className="rounded text-indigo-600 bg-slate-700 border-slate-600 h-4 w-4 cursor-pointer focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-xs font-bold text-slate-200">
                          {t.proposalHeader} #{index + 1}
                        </span>
                      </div>

                      {/* Status and Actions */}
                      <div className="flex items-center gap-2">
                        {item.status && item.status !== 'pending' && (
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                            item.status === 'success' 
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : item.status === 'failed'
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                          }`}>
                            {item.status === 'success' && `✓ ${t.statusSuccess}`}
                            {item.status === 'failed' && `✕ ${t.statusFailed}`}
                            {item.status === 'creating-parent' && `${t.statusCreatingParent}`}
                            {item.status === 'creating-subtask' && `${t.statusCreatingSubtask}`}
                            {item.status === 'transitioning' && `${t.statusTransitioning}`}
                            {item.status === 'logging' && `${t.statusLogging}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Parent Story Block */}
                    <div className="p-3 bg-slate-850 rounded-lg border border-slate-750 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider">
                          {t.parentStoryLabel}
                        </span>
                        <div className="flex rounded bg-slate-750 p-0.5 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...aiPlan];
                              updated[index].parentType = 'existing';
                              setAiPlan(updated);
                            }}
                            className={`px-2 py-0.5 rounded transition ${item.parentType === 'existing' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            {t.existingParentOption}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...aiPlan];
                              updated[index].parentType = 'new';
                              setAiPlan(updated);
                            }}
                            className={`px-2 py-0.5 rounded transition ${item.parentType === 'new' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            {t.newParentOption}
                          </button>
                        </div>
                      </div>

                      {item.parentType === 'existing' ? (
                        <div className="space-y-1">
                          <select
                            value={item.parentKey || ''}
                            onChange={(e) => {
                              const updated = [...aiPlan];
                              updated[index].parentKey = e.target.value;
                              setAiPlan(updated);
                            }}
                            className="w-full bg-slate-850 hover:bg-slate-800 border border-slate-755 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none font-bold cursor-pointer"
                          >
                            <option value="">{t.selectParentPlaceholder}</option>
                            {item.candidateParentKeys && item.candidateParentKeys.length > 0 && (
                              <optgroup label={t.chooseFromCandidates}>
                                {item.candidateParentKeys.map(k => {
                                  const issueObj = issues.find(i => i.key === k);
                                  return (
                                    <option key={`cand-${k}`} value={k}>
                                      {k} {issueObj ? ` - ${issueObj.summary}` : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                            <optgroup label={t.allStoriesDropdown}>
                              {issues.filter(i => i.issuetype !== 'Epic' && i.issuetype !== 'Sub-task').map(p => (
                                <option key={`parent-${p.key}`} value={p.key}>
                                  {p.key} - {p.summary} ({p.issuetype})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2 text-left">
                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t.newStorySummaryLabel}</label>
                            <input
                              type="text"
                              value={item.proposedParentStory?.summary || ''}
                              onChange={(e) => {
                                const updated = [...aiPlan];
                                updated[index].proposedParentStory = {
                                  summary: e.target.value,
                                  description: updated[index].proposedParentStory?.description || ''
                                };
                                setAiPlan(updated);
                              }}
                              className="w-full bg-slate-850 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t.newStoryDescLabel}</label>
                            <textarea
                              rows={2}
                              value={item.proposedParentStory?.description || ''}
                              onChange={(e) => {
                                const updated = [...aiPlan];
                                updated[index].proposedParentStory = {
                                  summary: updated[index].proposedParentStory?.summary || '',
                                  description: e.target.value
                                };
                                setAiPlan(updated);
                              }}
                              className="w-full bg-slate-850 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-medium"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sub-task Block */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-left">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                          {t.subTaskTitleLabel}
                        </label>
                        <input
                          type="text"
                          value={item.subTaskSummary}
                          onChange={(e) => {
                            const updated = [...aiPlan];
                            updated[index].subTaskSummary = e.target.value;
                            setAiPlan(updated);
                          }}
                          className="w-full bg-slate-850 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                          {t.timeSpentLabel}
                        </label>
                        <input
                          type="text"
                          value={item.timeSpent}
                          onChange={(e) => {
                            const updated = [...aiPlan];
                            updated[index].timeSpent = e.target.value;
                            setAiPlan(updated);
                          }}
                          className="w-full bg-slate-850 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                          {t.startTimeLabel}
                        </label>
                        <input
                          type="datetime-local"
                          value={item.started || ''}
                          onChange={(e) => {
                            const updated = [...aiPlan];
                            updated[index].started = e.target.value;
                            setAiPlan(updated);
                          }}
                          className="w-full bg-slate-850 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-bold"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>

                    {/* Worklog Comment */}
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider">
                        {t.worklogCommentLabel}
                      </label>
                      <textarea
                        rows={2}
                        value={item.comment}
                        onChange={(e) => {
                          const updated = [...aiPlan];
                          updated[index].comment = e.target.value;
                          setAiPlan(updated);
                        }}
                        className="w-full bg-slate-850 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    {/* Error Display */}
                    {item.error && (
                      <div className="p-2.5 bg-red-950/40 border border-red-900 text-[11px] text-red-400 font-medium rounded-lg text-left">
                        ⚠️ {item.error}
                      </div>
                    )}

                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handlePublishAILogs}
                disabled={publishingAiLogs || aiPlan.filter(i => i.selected).length === 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-extrabold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {publishingAiLogs ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.aiPublishing}</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    <span>{t.aiPublishSelected} ({aiPlan.filter(i => i.selected).length})</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Quick manual work log modal/form if any ticket is active */}
          {activeLogIssue && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-md p-4 sm:p-5 space-y-4 animate-fade-in relative">
              <button
                type="button"
                onClick={() => setActiveLogIssue(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
              
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-950">
                  {t.quickLogTitle}: <span className="font-mono text-xs font-extrabold text-blue-600">{activeLogIssue.key}</span>
                </h4>
              </div>

              <p className="text-xs text-slate-500 leading-snug font-medium">
                {activeLogIssue.summary}
              </p>

              <form onSubmit={handleLogWork} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t.logTimeLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={logTime}
                    onChange={(e) => setLogTime(e.target.value)}
                    placeholder="e.g. 2h 30m, 45m, 1d"
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t.logCommentLabel}
                  </label>
                  <textarea
                    value={logComment}
                    onChange={(e) => setLogComment(e.target.value)}
                    placeholder="Write a brief comment about what was done..."
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none leading-relaxed"
                  />
                </div>

                {successMsg && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingLog}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg text-xs transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{submittingLog ? t.logging : t.logBtn}</span>
                </button>
              </form>
            </div>
          )}

          {/* Recently Logged Tasks (Recent Logs list) */}
          {recentLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 animate-pulse" />
                  <h4 className="text-sm font-bold text-slate-900">{t.recentLogsTitle}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(isRtl ? "آیا مایل به پاک کردن لیست آخرین‌ها هستید؟" : "Clear the recent logs list?")) {
                      setRecentLogs([]);
                    }
                  }}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded transition flex items-center gap-1 cursor-pointer text-xs font-bold border border-slate-200 bg-slate-50"
                  title={t.clearRecentBtn}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.clearRecentBtn}</span>
                </button>
              </div>

              <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                {recentLogs.map((log, index) => (
                  <div 
                    key={`${log.issueKey}-${index}`} 
                    className="group bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-150 p-3.5 text-left transition-all duration-150 space-y-2.5 relative shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="font-mono font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded shadow-sm">
                            {log.issueKey}
                          </span>
                          {log.parentKey && (
                            <span className="text-slate-400 font-mono">
                              (Parent: {log.parentKey})
                            </span>
                          )}
                          <span className="text-slate-400 font-medium">
                            • {new Date(log.timestamp).toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors">
                          {log.summary}
                        </h5>
                      </div>

                      {/* Open in Jira Link Button */}
                      <a 
                        href={log.url} 
                        target="_blank" 
                        rel="noreferrer"
                        referrerPolicy="no-referrer"
                        className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg border border-blue-100 transition shadow-sm shrink-0 flex items-center gap-1 text-[10px] font-bold"
                      >
                        <span>{isRtl ? "مشاهده" : "Open"}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-150/50 pt-2 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t.timeSpentLabel}: <strong className="text-slate-700">{log.timeSpent}</strong></span>
                      </div>
                      {log.comment && (
                        <div className="w-full text-[11px] text-slate-500 italic bg-white/50 border border-slate-100 rounded px-2 py-1 mt-1 leading-normal font-medium">
                          {log.comment}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Project Issues Board */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Filtering bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-medium text-slate-700"
                />
              </div>

              {/* Active user display indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-bold text-blue-800 shrink-0 self-start sm:self-auto">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {selectedAssignee === 'ALL' ? t.allUsersOption : (jiraUsers.find(u => u.name === selectedAssignee)?.displayName || selectedAssignee)}
                </span>
              </div>

            </div>

            {/* Advance dropdown filters */}
            <div className="flex flex-wrap gap-2 pt-1.5 border-t border-slate-100/80">
              
              {/* Select Type */}
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer pr-6 appearance-none"
                >
                  <option value="ALL">{t.filterType}</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <Filter className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Select Status */}
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer pr-6 appearance-none"
                >
                  <option value="ALL">{t.filterStatus}</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <Filter className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

            </div>
          </div>

          {/* Issue list */}
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-sans leading-relaxed">
                {t.loadingIssues}
              </p>
            </div>
          ) : filteredIssues.length > 0 ? (
            <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
              {filteredIssues.map((issue) => {
                const isExpanded = expandedIssueKey === issue.key;
                
                return (
                  <div 
                    key={issue.key} 
                    className="bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 shadow-sm overflow-hidden transition-all duration-150"
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        
                        {/* Header: Key, Type, Priority, Status */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="font-mono font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded shadow-sm">
                            {issue.key}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-bold border ${
                            issue.issuetype === 'Epic' ? 'bg-purple-50 text-purple-700 border-purple-150' :
                            issue.issuetype === 'Bug' ? 'bg-rose-50 text-rose-700 border-rose-150' :
                            'bg-amber-50 text-amber-700 border-amber-150'
                          }`}>
                            {issue.issuetype}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            issue.priority === 'Highest' || issue.priority === 'High' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-500'
                          }`}>
                            {issue.priority}
                          </span>
                          <span className="ml-auto sm:ml-0 px-2 py-0.5 font-extrabold bg-slate-100 text-slate-700 rounded border border-slate-200 uppercase tracking-wider text-[10px]">
                            {issue.status}
                          </span>
                        </div>

                        {/* Title */}
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug pt-0.5">
                          {issue.summary}
                        </h5>

                        {/* Assignee & estimate progress details */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-500 font-medium">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {issue.assigneeDisplayName 
                                ? issue.assigneeDisplayName 
                                : issue.assignee 
                                  ? `@${issue.assignee}` 
                                  : <span className="italic text-slate-400">{t.unassigned}</span>}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {t.ticketTimeLogged}: <strong className="text-slate-800">{formatTimeSpent(issue.timespent)}</strong>
                            </span>
                            {issue.timeoriginalestimate > 0 && (
                              <span className="text-[10px] text-slate-400">
                                ({t.originalEstimate}: {formatTimeSpent(issue.timeoriginalestimate)})
                              </span>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedIssueKey(isExpanded ? null : issue.key);
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                        >
                          {isExpanded ? t.hideLogs : t.showLogs}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLogIssue(issue);
                            setLogTime('');
                            setLogComment('');
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm hover:shadow transition flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>{t.logBtn}</span>
                        </button>
                      </div>

                    </div>

                    {/* Expandable historical worklogs section */}
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-150 px-4 py-3.5 space-y-2.5 animate-slide-down">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isRtl ? "سوابق ساعت کاری ثبت شده" : "Logged Worklog History"}
                        </span>
                        
                        {issue.worklogs && issue.worklogs.length > 0 ? (
                          <div className="space-y-2">
                            {issue.worklogs.map((wl) => (
                              <div key={wl.id} className="bg-white rounded-lg border border-slate-150 p-2.5 text-xs flex justify-between gap-3 items-start shadow-sm">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                    <span className="font-bold text-slate-700">{wl.author}</span>
                                    <span>•</span>
                                    <span>{new Date(wl.created).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US')}</span>
                                  </div>
                                  <p className="text-slate-600 leading-relaxed font-medium">
                                    {wl.comment || <span className="italic text-slate-400">{isRtl ? "بدون توضیح" : "No description"}</span>}
                                  </p>
                                </div>
                                <span className="font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 shrink-0 text-[10px] font-mono">
                                  {wl.timeSpent}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">
                            {t.noWorklogsLogged}
                          </p>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">{isRtl ? "هیچ تیکتی یافت نشد" : "No Tickets Found"}</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                {t.noIssuesFound}
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
