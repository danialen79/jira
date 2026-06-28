import { useState } from 'react';
import { RefinedIssue, JiraEpic, JiraCredentials, ConnectionConfig, Language, JiraUser, JiraVersion, JiraSprint } from '../types';
import { MarkdownPreview } from './MarkdownPreview';
import { 
  Play, CheckCircle2, AlertCircle, Edit2, Check, X, Tag, ExternalLink, 
  Layers, FileText, ArrowUpRight, HelpCircle, RefreshCw, Layers2
} from 'lucide-react';

interface RefinedListProps {
  language: Language;
  issues: RefinedIssue[];
  onIssuesChange: (issues: RefinedIssue[]) => void;
  credentials: JiraCredentials;
  projectKey: string;
  config: ConnectionConfig;
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
    subtitle: "Review, edit, and publish your generated Jira structures. You can create them individually or trigger a smart bulk publication.",
    bulkCreate: "Bulk Publish Structure",
    publishingAll: "Bulk publishing structure in progress...",
    filterAll: "All Tickets",
    filterEpics: "Epics Only",
    filterStories: "Stories Only",
    emptyState: "No refined tickets yet. Input your requirements in the left panel and click 'Refine with Gemini AI' to get started.",
    issueType: "Issue Type",
    epic: "Epic",
    story: "Story",
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
    linkHelp: "When bulk publishing, Epics are automatically created first. Then, stories are linked using the newly returned Epic keys.",
    errorOccurred: "Error:",
    rePublish: "Retry Publishing",
    noEpicsToLink: "No existing epics found. Connect to Jira to fetch."
  },
  fa: {
    title: "محیط کار برد اصلاح شده",
    subtitle: "تیکت‌های سازماندهی شده را بازبینی، ویرایش و در جیرا منتشر کنید. می‌توانید تیکت‌ها را تکی منتشر کنید یا از انتشار هوشمند گروهی بهره ببرید.",
    bulkCreate: "انتشار هوشمند گروهی",
    publishingAll: "در حال انتشار خودکار و گام‌به‌گام ساختار تیکت‌ها...",
    filterAll: "همه تیکت‌ها",
    filterEpics: "فقط اپیک‌ها",
    filterStories: "فقط استوری‌ها",
    emptyState: "هنوز تیکتی تولید نشده است. در پنل سمت چپ پیش‌نویس‌ها را وارد کرده و دکمه ساختاربندی را بزنید.",
    issueType: "نوع تیکت",
    epic: "اپیک (Epic)",
    story: "استوری (Story)",
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
    linkHelp: "در زمان انتشار گروهی، ابتدا اپیک‌ها ساخته می‌شوند. سپس استوری‌ها به طور خودکار به کلیدهای واقعی دریافتی متصل می‌گردند.",
    errorOccurred: "خطا در جیرا:",
    rePublish: "تلاش مجدد",
    noEpicsToLink: "اپیک موجودی در پروژه پیدا نشد. به جیرا متصل شوید."
  }
};

export default function RefinedList({
  language,
  issues,
  onIssuesChange,
  credentials,
  projectKey,
  config,
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
  onFetchSprints
}: RefinedListProps) {
  const t = translations[language];
  const isRtl = language === 'fa';

  const [filter, setFilter] = useState<'all' | 'epics' | 'stories'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ summary: string; description: string; suggestedLabels: string[]; selectedComponent?: string; selectedAssignee?: string; selectedSprint?: string; selectedRelease?: string }>({
    summary: "",
    description: "",
    suggestedLabels: [],
    selectedComponent: "",
    selectedAssignee: "",
    selectedSprint: "",
    selectedRelease: ""
  });
  const [newLabel, setNewLabel] = useState("");
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // Single issue publish helper
  const publishSingleIssue = async (issueId: string, currentIssues: RefinedIssue[]) => {
    const updatedIssues = [...currentIssues];
    const index = updatedIssues.findIndex(i => i.id === issueId);
    if (index === -1) return;

    updatedIssues[index].status = 'creating';
    updatedIssues[index].error = undefined;
    onIssuesChange([...updatedIssues]);

    const targetIssue = updatedIssues[index];

    // Determine parent Epic Key
    let epicKey = targetIssue.selectedEpicKey;
    if (!epicKey && targetIssue.epicReference) {
      // Find if parent Epic was already created in this draft list
      const parentEpic = updatedIssues.find(i => i.id === targetIssue.epicReference && i.issuetype === 'Epic');
      if (parentEpic && parentEpic.createdKey) {
        epicKey = parentEpic.createdKey;
      }
    }

    try {
      const response = await fetch('/api/jira/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey,
          config,
          issue: {
            summary: targetIssue.summary,
            description: targetIssue.description,
            issuetype: targetIssue.issuetype,
            suggestedLabels: targetIssue.suggestedLabels,
            epicKey,
            selectedComponent: targetIssue.selectedComponent, // Passes to server.ts!
            selectedAssignee: targetIssue.selectedAssignee,
            selectedSprint: targetIssue.selectedSprint,
            selectedRelease: targetIssue.selectedRelease
          }
        })
      });

      const data = await response.json();
      const freshIssues = [...updatedIssues];
      const freshIndex = freshIssues.findIndex(i => i.id === issueId);

      if (response.ok && data.success) {
        freshIssues[freshIndex].status = 'success';
        freshIssues[freshIndex].createdKey = data.key;
      } else {
        freshIssues[freshIndex].status = 'failed';
        freshIssues[freshIndex].error = data.error || "Failed to create issue.";
      }
      onIssuesChange([...freshIssues]);
      return data;
    } catch (err: any) {
      const freshIssues = [...updatedIssues];
      const freshIndex = freshIssues.findIndex(i => i.id === issueId);
      freshIssues[freshIndex].status = 'failed';
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
      const epics = stateIssues.filter(i => i.issuetype === 'Epic' && i.status !== 'success');
      for (const epic of epics) {
        try {
          const result = await publishSingleIssue(epic.id, stateIssues);
          if (result && result.success) {
            // Re-fetch state because publishSingleIssue updates it in React
            stateIssues = stateIssues.map(i => i.id === epic.id ? { ...i, status: 'success', createdKey: result.key } : i);
          }
        } catch (e) {
          console.error("Failed to publish Epic:", epic.summary, e);
        }
      }

      // 2. Publish all Stories
      const stories = stateIssues.filter(i => i.issuetype === 'Story' && i.status !== 'success');
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
      selectedRelease: issue.selectedRelease || ""
    });
    setNewLabel("");
  };

  const handleSaveEdit = (id: string) => {
    const updated = issues.map(issue => {
      if (issue.id === id) {
        return {
          ...issue,
          summary: editForm.summary,
          description: editForm.description,
          suggestedLabels: editForm.suggestedLabels,
          selectedComponent: editForm.selectedComponent || undefined,
          selectedAssignee: editForm.selectedAssignee || undefined,
          selectedSprint: editForm.selectedSprint || undefined,
          selectedRelease: editForm.selectedRelease || undefined
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
        suggestedLabels: [...editForm.suggestedLabels, cleanLabel]
      });
    }
    setNewLabel("");
  };

  const handleRemoveLabel = (label: string) => {
    setEditForm({
      ...editForm,
      suggestedLabels: editForm.suggestedLabels.filter(l => l !== label)
    });
  };

  const handleEpicLinkOverride = (issueId: string, epicKey: string) => {
    const updated = issues.map(issue => {
      if (issue.id === issueId) {
        return { ...issue, selectedEpicKey: epicKey || undefined };
      }
      return issue;
    });
    onIssuesChange(updated);
  };

  const filteredIssues = issues.filter(issue => {
    if (filter === 'epics') return issue.issuetype === 'Epic';
    if (filter === 'stories') return issue.issuetype === 'Story';
    return true;
  });

  const getJiraBrowseUrl = (key: string) => {
    const baseUrl = credentials.url.trim().replace(/\/+$/, "");
    return `${baseUrl}/browse/${key}`;
  };

  return (
    <div className="space-y-4" id="refined-board-panel">
      {/* Header and Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" />
              {t.title}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Filter Buttons */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/50">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-md transition duration-150 cursor-pointer ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {t.filterAll}
              </button>
              <button
                type="button"
                onClick={() => setFilter('epics')}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-md transition duration-150 cursor-pointer ${filter === 'epics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {t.filterEpics}
              </button>
              <button
                type="button"
                onClick={() => setFilter('stories')}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-md transition duration-150 cursor-pointer ${filter === 'stories' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {t.filterStories}
              </button>
            </div>

            {/* Bulk Publish Button */}
            {issues.length > 0 && (
              <button
                type="button"
                disabled={bulkPublishing || !jiraConnected}
                onClick={handleBulkPublish}
                className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg transition duration-150 shadow-sm disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                {bulkPublishing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.publishingAll}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>{t.bulkCreate}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {issues.length > 0 && !jiraConnected && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {isRtl 
                ? "برای ساخت خودکار تیکت‌ها در جیرا، ابتدا اطلاعات اتصال به سرور جیرا (در بالای صفحه) را وارد کرده و دکمه تست اتصال را بزنید."
                : "To publish these tickets to Jira, please configure your Jira Server Connection at the top of the page first and press Test Connection."}
            </span>
          </div>
        )}

        {issues.length > 0 && jiraConnected && (
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 py-1.5 px-3 rounded-md">
            <HelpCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>{t.linkHelp}</span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredIssues.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center" id="board-empty-state">
          <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mb-4 border border-slate-100">
            <Layers2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">{isRtl ? "تیکتی یافت نشد" : "Workspace Empty"}</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">{t.emptyState}</p>
        </div>
      )}

      {/* Issue Cards */}
      <div className="space-y-3.5">
        {filteredIssues.map((issue) => {
          const isEditing = editingId === issue.id;
          const isEpic = issue.issuetype === 'Epic';
          
          // Get draft parent epic summary
          let parentEpicDraft: RefinedIssue | undefined;
          if (issue.epicReference) {
            parentEpicDraft = issues.find(i => i.id === issue.epicReference && i.issuetype === 'Epic');
          }

          return (
            <div
              key={issue.id}
              className={`bg-white rounded-xl border transition-all duration-200 shadow-sm overflow-hidden ${
                issue.status === 'success' ? 'border-emerald-200 bg-emerald-50/5' :
                issue.status === 'failed' ? 'border-red-200 bg-red-50/5' :
                isEpic ? 'border-blue-100/80 hover:border-blue-200' : 'border-slate-200 hover:border-slate-300'
              }`}
              id={`issue-card-${issue.id}`}
            >
              {/* Card Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100/60 flex flex-wrap items-start justify-between gap-3 bg-slate-50/30">
                <div className="flex items-center gap-2.5">
                  {/* Issue Type Badge */}
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                    isEpic ? 'bg-blue-50 text-blue-700' : 'bg-sky-50 text-sky-700'
                  }`}>
                    {isEpic ? <Layers className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    {isEpic ? t.epic : t.story}
                  </span>

                  {/* Draft ID label */}
                  <span className="text-[11px] font-mono text-slate-400">#{issue.id}</span>

                  {/* Jira Link or Status badge */}
                  {issue.status === 'success' && issue.createdKey && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      {issue.createdKey}
                    </span>
                  )}

                  {issue.status === 'creating' && (
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                      {t.creating}
                    </span>
                  )}
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-1.5">
                  {!isEditing && issue.status !== 'success' && (
                    <button
                      type="button"
                      onClick={() => handleEditClick(issue)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition duration-150 text-xs flex items-center gap-1 font-medium cursor-pointer"
                      title={t.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t.edit}</span>
                    </button>
                  )}

                  {/* Publish Single issue button */}
                  {jiraConnected && issue.status !== 'success' && !isEditing && (
                    <button
                      type="button"
                      disabled={issue.status === 'creating' || bulkPublishing}
                      onClick={() => publishSingleIssue(issue.id, issues)}
                      className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md transition shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      {issue.status === 'failed' ? t.rePublish : t.createInJira}
                    </button>
                  )}

                  {issue.status === 'success' && issue.createdKey && (
                    <a
                      href={getJiraBrowseUrl(issue.createdKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md transition flex items-center gap-1 shadow-sm font-sans"
                    >
                      <span>{isRtl ? "مشاهده در جیرا" : "Open in Jira"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 space-y-4">
                {isEditing ? (
                  /* EDITING MODE */
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {t.summary}
                      </label>
                      <input
                        type="text"
                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/30"
                        value={editForm.summary}
                        onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                        dir="auto"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {t.description}
                      </label>
                      <textarea
                        className="w-full h-44 text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 font-sans leading-relaxed bg-slate-50/30"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        dir="auto"
                      />
                    </div>

                    {/* Component Selector in Edit Mode */}
                    {availableComponents.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isRtl ? "کامپوننت جیرا" : "Jira Component"}
                        </label>
                        <select
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-white font-medium text-slate-700"
                          value={editForm.selectedComponent || ""}
                          onChange={(e) => setEditForm({ ...editForm, selectedComponent: e.target.value })}
                        >
                          <option value="">-- {isRtl ? "انتخاب نشده" : "None"} --</option>
                          {availableComponents.map(comp => (
                            <option key={comp} value={comp}>{comp}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Assignee Selector in Edit Mode */}
                    {jiraConnected && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isRtl ? "مسئول (Assignee)" : "Assignee"}
                        </label>
                        {fetchingUsers ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            <span className="text-xs text-slate-400">{isRtl ? "در حال بارگذاری کاربران..." : "Loading Users..."}</span>
                          </div>
                        ) : (
                          <select
                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-white font-medium text-slate-700"
                            value={editForm.selectedAssignee || ""}
                            onChange={(e) => setEditForm({ ...editForm, selectedAssignee: e.target.value })}
                          >
                            <option value="">-- {isRtl ? "تخصیص داده نشده" : "Unassigned"} --</option>
                            {availableUsers.map(user => (
                              <option key={user.name} value={user.name}>
                                {user.displayName} ({user.name})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Release (fixVersions) Selector for Epics in Edit Mode */}
                    {jiraConnected && isEpic && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isRtl ? "ریلیز (Fix Version)" : "Release (Fix Version)"}
                        </label>
                        {fetchingVersions ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            <span className="text-xs text-slate-400">{isRtl ? "در حال بارگذاری نسخه‌ها..." : "Loading Versions..."}</span>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <select
                              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-white font-medium text-slate-700"
                              value={editForm.selectedRelease || ""}
                              onChange={(e) => setEditForm({ ...editForm, selectedRelease: e.target.value })}
                            >
                              <option value="">-- {isRtl ? "انتخاب نشده" : "None / Unreleased"} --</option>
                              {availableVersions.map(version => (
                                <option key={version.id} value={version.id}>
                                  {version.name} {version.released ? `(${isRtl ? 'منتشر شده' : 'released'})` : ''}
                                </option>
                              ))}
                            </select>
                            {availableVersions.length === 0 && (
                              <button
                                type="button"
                                disabled={fetchingVersions}
                                onClick={onFetchVersions}
                                className="p-2 border border-slate-200 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition shrink-0 cursor-pointer flex items-center justify-center animate-none"
                                title={isRtl ? "دریافت مجدد نسخه‌ها" : "Reload Versions"}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${fetchingVersions ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sprint Selector for Stories in Edit Mode */}
                    {jiraConnected && !isEpic && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isRtl ? "اسپرینت (Sprint)" : "Sprint"}
                        </label>
                        {fetchingSprints ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            <span className="text-xs text-slate-400">{isRtl ? "در حال بارگذاری اسپرینت‌ها..." : "Loading Sprints..."}</span>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <select
                              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-white font-medium text-slate-700"
                              value={editForm.selectedSprint || ""}
                              onChange={(e) => setEditForm({ ...editForm, selectedSprint: e.target.value })}
                            >
                              <option value="">-- {isRtl ? "تخصیص داده نشده (بکلاگ)" : "Backlog"} --</option>
                              {availableSprints.map(sprint => (
                                <option key={sprint.id} value={sprint.id}>
                                  {sprint.name} {sprint.boardName ? `[${sprint.boardName}]` : ''} ({sprint.state})
                                </option>
                              ))}
                            </select>
                            {availableSprints.length === 0 && (
                              <button
                                type="button"
                                disabled={fetchingSprints}
                                onClick={onFetchSprints}
                                className="p-2 border border-slate-200 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition shrink-0 cursor-pointer flex items-center justify-center"
                                title={isRtl ? "دریافت مجدد اسپرینت‌ها" : "Reload Sprints"}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${fetchingSprints ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Save / Cancel buttons */}
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium rounded-lg transition cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(issue.id)}
                        className="px-3.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t.save}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VIEW MODE */
                  <div className="space-y-3.5">
                    {/* Title */}
                    <h4 className="text-sm sm:text-base font-semibold text-slate-900 font-sans tracking-tight leading-snug" dir="auto">
                      {issue.summary}
                    </h4>

                    {/* Epic link associations logic for Stories */}
                    {!isEpic && (
                      <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-slate-500 font-medium">
                          {parentEpicDraft ? (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                              {t.epicLink} <strong className="text-slate-800 font-semibold">#{issue.epicReference}</strong> ({parentEpicDraft.summary})
                            </span>
                          ) : issue.selectedEpicKey ? (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                              {isRtl ? "لینک شده به اپیک موجود:" : "Linked to Existing Epic:"} <strong className="text-slate-800 font-mono font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">{issue.selectedEpicKey}</strong>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">{t.noEpicLink}</span>
                          )}
                        </div>

                        {/* Dropdown to link existing Jira epics if connected */}
                        {jiraConnected && issue.status !== 'success' && (
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                              {t.existingEpics}
                            </label>
                            <select
                              value={issue.selectedEpicKey || ""}
                              onChange={(e) => handleEpicLinkOverride(issue.id, e.target.value)}
                              className="text-[11px] font-medium bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none max-w-[160px] truncate"
                            >
                              <option value="">-- {isRtl ? "انتخاب نشده" : "None"} --</option>
                              {existingEpics.map((epic) => (
                                <option key={epic.key} value={epic.key}>
                                  {epic.key} - {epic.summary}
                                </option>
                              ))}
                            </select>
                            {existingEpics.length === 0 && (
                              <button
                                type="button"
                                disabled={fetchingEpics}
                                onClick={onFetchEpics}
                                className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                title={isRtl ? "بارگذاری اپیک‌های موجود جیرا" : "Fetch existing Epics from Jira"}
                              >
                                <RefreshCw className={`w-3 h-3 ${fetchingEpics ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Component Selector (View Mode) */}
                    {availableComponents.length > 0 && (
                      <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-slate-500 font-medium flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span>
                            {isRtl ? "کامپوننت انتخاب شده:" : "Selected Component:"}{" "}
                            {issue.selectedComponent ? (
                              <strong className="text-slate-800 font-semibold bg-indigo-50 border border-indigo-200/50 px-1.5 py-0.5 rounded text-[10px]">
                                {issue.selectedComponent}
                              </strong>
                            ) : (
                              <span className="text-slate-400 italic font-normal">{isRtl ? "هیچ" : "None"}</span>
                            )}
                          </span>
                        </div>
                        
                        {issue.status !== 'success' && (
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                              {isRtl ? "تغییر کامپوننت:" : "Change Component:"}
                            </label>
                            <select
                              value={issue.selectedComponent || ""}
                              onChange={(e) => {
                                const updated = issues.map(iss => iss.id === issue.id ? { ...iss, selectedComponent: e.target.value || undefined } : iss);
                                onIssuesChange(updated);
                              }}
                              className="text-[11px] font-medium bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none max-w-[160px] truncate"
                            >
                              <option value="">-- {isRtl ? "بدون کامپوننت" : "No Component"} --</option>
                              {availableComponents.map(comp => (
                                <option key={comp} value={comp}>{comp}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Release Selector (View Mode) */}
                    {jiraConnected && isEpic && (
                      <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-slate-500 font-medium flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-teal-500"></span>
                          <span>
                            {isRtl ? "ریلیز انتخاب شده:" : "Selected Release:"}{" "}
                            {issue.selectedRelease ? (
                              <strong className="text-slate-800 font-semibold bg-teal-50 border border-teal-200/50 px-1.5 py-0.5 rounded text-[10px]">
                                {availableVersions.find(v => v.id === issue.selectedRelease)?.name || issue.selectedRelease}
                              </strong>
                            ) : (
                              <span className="text-slate-400 italic font-normal">{isRtl ? "هیچ" : "None"}</span>
                            )}
                          </span>
                        </div>
                        
                        {issue.status !== 'success' && (
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                              {isRtl ? "تغییر ریلیز:" : "Change Release:"}
                            </label>
                            {fetchingVersions ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                            ) : (
                              <select
                                value={issue.selectedRelease || ""}
                                onChange={(e) => {
                                  const updated = issues.map(iss => iss.id === issue.id ? { ...iss, selectedRelease: e.target.value || undefined } : iss);
                                  onIssuesChange(updated);
                                }}
                                className="text-[11px] font-medium bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none max-w-[160px] truncate"
                              >
                                <option value="">-- {isRtl ? "انتخاب نشده" : "None"} --</option>
                                {availableVersions.map(version => (
                                  <option key={version.id} value={version.id}>
                                    {version.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            {availableVersions.length === 0 && (
                              <button
                                type="button"
                                disabled={fetchingVersions}
                                onClick={onFetchVersions}
                                className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                title={isRtl ? "بارگذاری ریلیزها" : "Fetch Releases"}
                              >
                                <RefreshCw className={`w-3 h-3 ${fetchingVersions ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Sprint Selector (View Mode) */}
                    {jiraConnected && !isEpic && (
                      <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-slate-500 font-medium flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-violet-500"></span>
                          <span>
                            {isRtl ? "اسپرینت انتخاب شده:" : "Selected Sprint:"}{" "}
                            {issue.selectedSprint ? (
                              <strong className="text-slate-800 font-semibold bg-violet-50 border border-violet-200/50 px-1.5 py-0.5 rounded text-[10px]">
                                {availableSprints.find(s => String(s.id) === issue.selectedSprint)?.name || issue.selectedSprint}
                              </strong>
                            ) : (
                              <span className="text-slate-400 italic font-normal">{isRtl ? "بکلاگ" : "Backlog"}</span>
                            )}
                          </span>
                        </div>
                        
                        {issue.status !== 'success' && (
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                              {isRtl ? "تغییر اسپرینت:" : "Change Sprint:"}
                            </label>
                            {fetchingSprints ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                            ) : (
                              <select
                                value={issue.selectedSprint || ""}
                                onChange={(e) => {
                                  const updated = issues.map(iss => iss.id === issue.id ? { ...iss, selectedSprint: e.target.value || undefined } : iss);
                                  onIssuesChange(updated);
                                }}
                                className="text-[11px] font-medium bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none max-w-[160px] truncate"
                              >
                                <option value="">-- {isRtl ? "بکلاگ" : "Backlog"} --</option>
                                {availableSprints.map(sprint => (
                                  <option key={sprint.id} value={sprint.id}>
                                    {sprint.name} {sprint.boardName ? `[${sprint.boardName}]` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            {availableSprints.length === 0 && (
                              <button
                                type="button"
                                disabled={fetchingSprints}
                                onClick={onFetchSprints}
                                className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                title={isRtl ? "بارگذاری اسپرینت‌ها" : "Fetch Sprints"}
                              >
                                <RefreshCw className={`w-3 h-3 ${fetchingSprints ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Assignee Selector (View Mode) */}
                    {jiraConnected && (
                      <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="text-slate-500 font-medium flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>
                            {isRtl ? "مسئول (Assignee):" : "Assignee:"}{" "}
                            {issue.selectedAssignee ? (
                              <strong className="text-slate-800 font-semibold bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded text-[10px]">
                                {availableUsers.find(u => u.name === issue.selectedAssignee)?.displayName || issue.selectedAssignee}
                              </strong>
                            ) : (
                              <span className="text-slate-400 italic font-normal">{isRtl ? "تخصیص داده نشده" : "Unassigned"}</span>
                            )}
                          </span>
                        </div>
                        
                        {issue.status !== 'success' && (
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                              {isRtl ? "تغییر مسئول:" : "Change Assignee:"}
                            </label>
                            {fetchingUsers ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                            ) : (
                              <select
                                value={issue.selectedAssignee || ""}
                                onChange={(e) => {
                                  const updated = issues.map(iss => iss.id === issue.id ? { ...iss, selectedAssignee: e.target.value || undefined } : iss);
                                  onIssuesChange(updated);
                                }}
                                className="text-[11px] font-medium bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none max-w-[160px] truncate"
                              >
                                <option value="">-- {isRtl ? "تخصیص داده نشده" : "Unassigned"} --</option>
                                {availableUsers.map(user => (
                                  <option key={user.name} value={user.name}>
                                    {user.displayName} ({user.name})
                                  </option>
                                ))}
                              </select>
                            )}
                            {availableUsers.length === 0 && (
                              <button
                                type="button"
                                disabled={fetchingUsers}
                                onClick={onFetchUsers}
                                className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                title={isRtl ? "بارگذاری کاربران" : "Fetch Users"}
                              >
                                <RefreshCw className={`w-3 h-3 ${fetchingUsers ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Refined Description Rendering */}
                    <div className="p-3.5 bg-slate-50/30 rounded-lg border border-slate-100 font-sans" dir="auto">
                      <MarkdownPreview text={issue.description} />
                    </div>

                    {/* Tags footer */}
                    <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                      <Tag className="w-3.5 h-3.5 text-blue-500" />
                      <span className="bg-blue-50 text-blue-700 font-bold text-[10px] px-2 py-0.5 rounded-md border border-blue-200">
                        agent
                      </span>
                    </div>

                    {/* Error Indicator if failed */}
                    {issue.status === 'failed' && issue.error && (
                      <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs flex items-start gap-2 leading-relaxed">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">{t.errorOccurred}</span>
                          <p className="mt-0.5 font-medium">{issue.error}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
