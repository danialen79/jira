import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  ArrowRight, 
  PlusCircle, 
  Trash2, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  Edit3, 
  BarChart2, 
  Plus, 
  Check, 
  X,
  HelpCircle
} from 'lucide-react';
import { Language, RefinedIssue, JiraVersion, JiraEpic, JiraCredentials } from '../types';
import CustomSelect from './CustomSelect';

interface JiraRoadmapProps {
  language: Language;
  issues: RefinedIssue[];
  onIssuesChange: (updated: RefinedIssue[]) => void;
  credentials: JiraCredentials;
  projectKey: string;
  availableVersions: JiraVersion[];
  onFetchVersions: () => Promise<void>;
  fetchingVersions: boolean;
  existingEpics: JiraEpic[];
}

interface LocalVersionDates {
  startDate: string;
  releaseDate: string;
  description: string;
  capacity?: number; // Target capacity in story points or count
}

const translations = {
  en: {
    title: "Product Manager Release Roadmap",
    subtitle: "Plan and structure your releases, schedule Epics, define timelines, and track capacity like a pro.",
    loadingVersions: "Loading Jira Releases...",
    fetchBtn: "Fetch Jira Releases",
    noVersions: "No releases found. Create a custom release below to start planning.",
    unassignedBacklog: "Unscheduled Epics Pool",
    unassignedBacklogDesc: "These Epics do not have any Release (Fix Version) assigned. Drag or select a Release to schedule them.",
    scheduleEpic: "Schedule to Release",
    startDate: "Start Date",
    releaseDate: "Release Date",
    duration: "Duration",
    days: "days",
    notPlanned: "Not planned",
    clickToPlan: "Click to set timeline dates",
    activeRelease: "Active Release Plan",
    details: "Release Metrics & HUD",
    capacity: "Target Capacity",
    capacityLimit: "Stories Limit",
    capacityWarning: "Capacity alert! Too many items scheduled.",
    capacityNormal: "Capacity healthy.",
    epicsInRelease: "Epics scheduled in this release",
    noEpicsInRelease: "No Epics scheduled in this release. Use the scheduling tools below or drag Epics in.",
    storiesInEpic: "Stories inside",
    addCustomRelease: "Create Custom Release",
    releaseName: "Release / Version Name",
    addBtn: "Add Release",
    saveSuccess: "Saved successfully!",
    saveFailed: "Save failed.",
    saving: "Saving details...",
    jiraSync: "Sync with Jira Server",
    localSandbox: "Local Sandbox Mode",
    viewStories: "View Stories",
    emptyEpic: "No refined stories belong to this epic."
  },
  fa: {
    title: "مدیریت نقشه راه و ریلیزها (Product Roadmap)",
    subtitle: "نسخه‌های ریلیز خود را برنامه‌ریزی کنید، اپیک‌ها را زمان‌بندی کنید، خطوط زمانی بکشید و ظرفیت تیم را رصد کنید.",
    loadingVersions: "در حال بارگذاری نسخه‌ها از جیرا...",
    fetchBtn: "بارگذاری ریلیزها از جیرا",
    noVersions: "هیچ ریلیزی پیدا نشد. یک نسخه دلخواه زیر ایجاد کنید تا برنامه‌ریزی شروع شود.",
    unassignedBacklog: "مخزن اپیک‌های زمان‌بندی نشده (Backlog)",
    unassignedBacklogDesc: "این اپیک‌ها هنوز به هیچ نسخه یا ریلیزی اختصاص داده نشده‌اند. نسخه مورد نظر را انتخاب کنید تا زمان‌بندی شوند.",
    scheduleEpic: "زمان‌بندی در ریلیز",
    startDate: "تاریخ شروع",
    releaseDate: "تاریخ ریلیز (پایان)",
    duration: "مدت زمان",
    days: "روز",
    notPlanned: "برنامه‌ریزی نشده",
    clickToPlan: "برای تنظیم تاریخ کلیک کنید",
    activeRelease: "طرح زمان‌بندی ریلیز",
    details: "جزئیات ظرفیت و هاب آمار (HUD)",
    capacity: "ظرفیت هدف تیکت‌ها",
    capacityLimit: "حد نصاب استوری‌ها",
    capacityWarning: "هشدار ظرفیت! تعداد کارها بیش از ظرفیت تعریف شده است.",
    capacityNormal: "ظرفیت متعادل و مناسب است.",
    epicsInRelease: "اپیک‌های تخصیص‌یافته به این ریلیز",
    noEpicsInRelease: "هیچ اپیکی در این ریلیز زمان‌بندی نشده است. از منوهای زیر برای تخصیص استفاده کنید.",
    storiesInEpic: "استوری‌های داخل اپیک",
    addCustomRelease: "ایجاد ریلیز / نسخه جدید",
    releaseName: "نام ریلیز (مثلاً نسخه 1.2.0)",
    addBtn: "افزودن ریلیز جدید",
    saveSuccess: "با موفقیت ذخیره شد!",
    saveFailed: "ذخیره ناموفق بود.",
    saving: "در حال ذخیره‌سازی در جیرا...",
    jiraSync: "همگام‌سازی با جیرا",
    localSandbox: "حالت لوکال شبیه‌سازی شده",
    viewStories: "مشاهده استوری‌ها",
    emptyEpic: "هیچ استوری اصلاح شده‌ای برای این اپیک یافت نشد."
  }
};

export default function JiraRoadmap({
  language,
  issues,
  onIssuesChange,
  credentials,
  projectKey,
  availableVersions,
  onFetchVersions,
  fetchingVersions,
  existingEpics
}: JiraRoadmapProps) {
  const t = translations[language];
  const isRtl = language === 'fa';

  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [localVersions, setLocalVersions] = useState<JiraVersion[]>([]);
  const [versionMetadata, setVersionMetadata] = useState<Record<string, LocalVersionDates>>({});
  
  // Custom created sandbox versions
  const [newReleaseName, setNewReleaseName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // States for Editing Dates
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editReleaseDate, setEditReleaseDate] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCapacity, setEditCapacity] = useState<number>(10);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string | null>(null);

  // Epics Expanded view
  const [expandedEpicId, setExpandedEpicId] = useState<string | null>(null);

  // Sync available versions from parent & local state
  useEffect(() => {
    // Read local metadata
    try {
      const savedMeta = localStorage.getItem('jira_roadmap_meta');
      if (savedMeta) {
        setVersionMetadata(JSON.parse(savedMeta));
      }

      const savedCustomVers = localStorage.getItem('jira_roadmap_custom_versions');
      const customVers: JiraVersion[] = savedCustomVers ? JSON.parse(savedCustomVers) : [];

      // Combine parents fetched versions with local custom versions
      const combined = [...availableVersions];
      customVers.forEach(cv => {
        if (!combined.some(v => v.id === cv.id)) {
          combined.push(cv);
        }
      });

      setLocalVersions(combined);
      if (combined.length > 0 && !activeVersionId) {
        setActiveVersionId(combined[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [availableVersions]);

  // Save metadata to local storage helper
  const saveMetadata = (updated: Record<string, LocalVersionDates>) => {
    setVersionMetadata(updated);
    localStorage.setItem('jira_roadmap_meta', JSON.stringify(updated));
  };

  // Add custom release (Sandbox or offline)
  const handleCreateRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReleaseName.trim()) return;

    const newId = "custom-ver-" + Date.now();
    const newVer: JiraVersion = {
      id: newId,
      name: newReleaseName.trim(),
      released: false
    };

    const updatedCustom = [...localVersions, newVer];
    setLocalVersions(updatedCustom);

    // Save custom versions
    const savedCustomVers = localStorage.getItem('jira_roadmap_custom_versions');
    const existingCustom: JiraVersion[] = savedCustomVers ? JSON.parse(savedCustomVers) : [];
    localStorage.setItem('jira_roadmap_custom_versions', JSON.stringify([...existingCustom, newVer]));

    // Initialize metadata
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14); // default 2 weeks
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const updatedMeta = {
      ...versionMetadata,
      [newId]: {
        startDate: todayStr,
        releaseDate: targetDateStr,
        description: isRtl ? "ریلیز برنامه‌ریزی شده جدید" : "Newly planned release version",
        capacity: 10
      }
    };
    saveMetadata(updatedMeta);

    setActiveVersionId(newId);
    setNewReleaseName("");
    setShowAddForm(false);
  };

  // Delete custom release
  const handleDeleteCustomRelease = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = localVersions.filter(v => v.id !== id);
    setLocalVersions(updated);

    const savedCustomVers = localStorage.getItem('jira_roadmap_custom_versions');
    if (savedCustomVers) {
      const existingCustom: JiraVersion[] = JSON.parse(savedCustomVers);
      localStorage.setItem('jira_roadmap_custom_versions', JSON.stringify(existingCustom.filter(v => v.id !== id)));
    }

    const updatedMeta = { ...versionMetadata };
    delete updatedMeta[id];
    saveMetadata(updatedMeta);

    if (activeVersionId === id && updated.length > 0) {
      setActiveVersionId(updated[0].id);
    }
  };

  // Open Edit Dialog/Inline Panel
  const startEditingDates = (ver: JiraVersion) => {
    const meta = versionMetadata[ver.id] || {};
    setEditingVersionId(ver.id);
    setEditStartDate(meta.startDate || ver.startDate || "");
    setEditReleaseDate(meta.releaseDate || ver.releaseDate || "");
    setEditDesc(meta.description || ver.description || "");
    setEditCapacity(meta.capacity || 10);
    setSaveStatusMsg(null);
  };

  // Save changes (Optionally pushes to Jira Server if connected, always saves locally)
  const saveVersionDetails = async (versionId: string) => {
    setSavingId(versionId);
    setSaveStatusMsg(t.saving);

    // Save locally first
    const updatedMeta = {
      ...versionMetadata,
      [versionId]: {
        startDate: editStartDate,
        releaseDate: editReleaseDate,
        description: editDesc,
        capacity: editCapacity
      }
    };
    saveMetadata(updatedMeta);

    const isJiraConnected = credentials.url && (credentials.token || credentials.password);
    const isCustom = versionId.startsWith("custom-ver-");

    if (isJiraConnected && !isCustom) {
      try {
        const response = await fetch('/api/jira/update-version', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creds: credentials,
            versionId: versionId,
            updateData: {
              startDate: editStartDate || undefined,
              releaseDate: editReleaseDate || undefined,
              description: editDesc || undefined
            }
          })
        });

        const data = await response.json();
        if (response.ok) {
          setSaveStatusMsg(t.saveSuccess);
          setTimeout(() => {
            setEditingVersionId(null);
            setSavingId(null);
            setSaveStatusMsg(null);
            onFetchVersions(); // refresh
          }, 1000);
        } else {
          throw new Error(data.error || "Failed to update version in Jira Server.");
        }
      } catch (err: any) {
        console.error(err);
        setSaveStatusMsg(`${t.saveFailed}: ${err.message}`);
        setTimeout(() => setSavingId(null), 3000);
      }
    } else {
      // Local sandbox success
      setSaveStatusMsg(t.saveSuccess);
      setTimeout(() => {
        setEditingVersionId(null);
        setSavingId(null);
        setSaveStatusMsg(null);
      }, 1000);
    }
  };

  // Find all epics in issues or fetched epics
  // Active Issues in the workspace
  const workspaceEpics = issues.filter(iss => iss.issuetype === 'Epic');
  
  // Combine workspace Epics and existing Jira Epics
  const allAvailableEpics = [...workspaceEpics.map(e => ({ key: e.id, summary: e.summary, isLocal: true }))];
  existingEpics.forEach(je => {
    if (!allAvailableEpics.some(e => e.key === je.key)) {
      allAvailableEpics.push({ key: je.key, summary: je.summary, isLocal: false });
    }
  });

  // Helper to find which version an epic belongs to
  // An epic in the workspace has `selectedRelease` corresponding to a version ID or Name
  const getEpicRelease = (epicKey: string): string | undefined => {
    // 1. Check in our workspace refined issues
    const wsEpic = issues.find(iss => iss.id === epicKey && iss.issuetype === 'Epic');
    if (wsEpic && wsEpic.selectedRelease) {
      return wsEpic.selectedRelease;
    }
    
    // 2. Or check saved mapping in localStorage for existing Jira Epics or custom epics
    const savedEpicMapping = localStorage.getItem('jira_epic_release_mapping');
    if (savedEpicMapping) {
      const mapping = JSON.parse(savedEpicMapping);
      return mapping[epicKey];
    }

    return undefined;
  };

  // Assign Epic to a Release
  const handleAssignEpicToRelease = (epicKey: string, versionId: string | undefined) => {
    // If it is a workspace local refined issue
    const isLocal = issues.some(iss => iss.id === epicKey);
    if (isLocal) {
      const updated = issues.map(iss => {
        if (iss.id === epicKey) {
          return { ...iss, selectedRelease: versionId };
        }
        return iss;
      });
      onIssuesChange(updated);
    } else {
      // It is an existing Jira Epic, store layout locally in browser
      const savedEpicMapping = localStorage.getItem('jira_epic_release_mapping');
      const mapping = savedEpicMapping ? JSON.parse(savedEpicMapping) : {};
      
      if (versionId) {
        mapping[epicKey] = versionId;
      } else {
        delete mapping[epicKey];
      }
      localStorage.setItem('jira_epic_release_mapping', JSON.stringify(mapping));
      
      // Trigger local component update by re-mapping
      setLocalVersions([...localVersions]);
    }
  };

  // Calculate duration in days between startDate and releaseDate
  const getDurationDays = (ver: JiraVersion) => {
    const meta = versionMetadata[ver.id] || {};
    const sDate = meta.startDate || ver.startDate;
    const rDate = meta.releaseDate || ver.releaseDate;

    if (!sDate || !rDate) return null;
    const start = new Date(sDate);
    const end = new Date(rDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate stories of a specific Epic
  const getStoriesForEpic = (epicKey: string) => {
    // Filter active issues that reference this epicKey (either by epicReference or custom linked epic)
    return issues.filter(iss => 
      iss.issuetype === 'Story' && 
      (iss.epicReference === epicKey || iss.selectedEpicKey === epicKey)
    );
  };

  // Calculate stats of stories/epics assigned to a Release
  const getReleaseStats = (versionId: string) => {
    // Find all epics assigned to this version
    const assignedEpics = allAvailableEpics.filter(e => getEpicRelease(e.key) === versionId);
    
    // Find all stories belonging to those epics, or directly assigned to this version
    let totalStoriesCount = 0;
    let completedStoriesCount = 0;

    assignedEpics.forEach(epic => {
      const stories = getStoriesForEpic(epic.key);
      totalStoriesCount += stories.length;
      completedStoriesCount += stories.filter(s => s.status === 'success').length;
    });

    // Also count stories directly assigned to this version that have no epic
    const directStories = issues.filter(iss => 
      iss.issuetype === 'Story' && 
      iss.selectedRelease === versionId && 
      !iss.epicReference && 
      !iss.selectedEpicKey
    );

    totalStoriesCount += directStories.length;
    completedStoriesCount += directStories.filter(s => s.status === 'success').length;

    const progressPercent = totalStoriesCount > 0 
      ? Math.round((completedStoriesCount / totalStoriesCount) * 100) 
      : 0;

    return {
      epicsCount: assignedEpics.length,
      storiesCount: totalStoriesCount,
      completedStories: completedStoriesCount,
      progressPercent
    };
  };

  const activeVersion = localVersions.find(v => v.id === activeVersionId);
  const activeStats = activeVersion ? getReleaseStats(activeVersion.id) : null;
  const activeMeta = activeVersion ? (versionMetadata[activeVersion.id] || {}) : {};
  const activeCapacity = activeMeta.capacity || 10;
  const isOverCapacity = activeStats && activeStats.storiesCount > activeCapacity;

  // Epics scheduled in active release
  const activeScheduledEpics = activeVersion 
    ? allAvailableEpics.filter(epic => getEpicRelease(epic.key) === activeVersion.id)
    : [];

  // Epics backlog (not assigned to any version)
  const unscheduledEpics = allAvailableEpics.filter(epic => !getEpicRelease(epic.key));

  return (
    <div className="space-y-6">
      {/* HUD Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <BarChart2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{t.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {credentials.url ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {t.jiraSync}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200/50">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              {t.localSandbox}
            </span>
          )}

          <button
            onClick={() => {
              if (credentials.url) {
                onFetchVersions();
              }
            }}
            disabled={fetchingVersions || !credentials.url}
            className="flex items-center gap-1 text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-600 px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetchingVersions ? 'animate-spin' : ''}`} />
            {isRtl ? "بروزرسانی جیرا" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Releases Timeline Gantt Grid (col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isRtl ? "نسخه‌ها و خط زمان (Releases GANTT)" : "Releases & Timeline GANTT"}
            </h4>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              {isRtl ? "ریلیز فرضی" : "Add Release"}
            </button>
          </div>

          {/* Add custom version form */}
          {showAddForm && (
            <form onSubmit={handleCreateRelease} className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 animate-fade-in">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                {t.releaseName}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newReleaseName}
                  onChange={(e) => setNewReleaseName(e.target.value)}
                  placeholder="e.g. v2.1.0-beta"
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                  dir="auto"
                />
                <button
                  type="submit"
                  className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shrink-0"
                >
                  {t.addBtn}
                </button>
              </div>
            </form>
          )}

          {/* Releases Timeline Stack */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {localVersions.length === 0 ? (
              <div className="p-6 bg-white border border-slate-100 rounded-xl text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 leading-relaxed">{t.noVersions}</p>
              </div>
            ) : (
              localVersions.map(ver => {
                const isActive = ver.id === activeVersionId;
                const stats = getReleaseStats(ver.id);
                const meta = versionMetadata[ver.id] || {};
                const sDate = meta.startDate || ver.startDate;
                const rDate = meta.releaseDate || ver.releaseDate;
                const duration = getDurationDays(ver);
                const isCustom = ver.id.startsWith("custom-ver-");

                return (
                  <div
                    key={ver.id}
                    onClick={() => setActiveVersionId(ver.id)}
                    className={`p-4 bg-white rounded-xl border transition-all duration-150 cursor-pointer relative overflow-hidden ${
                      isActive 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-md' 
                        : 'border-slate-200/80 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          ver.released ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></span>
                        <h5 className="font-bold text-sm text-slate-800">{ver.name}</h5>
                      </div>

                      <div className="flex items-center gap-1">
                        {isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustomRelease(ver.id, e)}
                            className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-slate-50 transition"
                            title={isRtl ? "حذف ریلیز فرضی" : "Delete custom release"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                          {stats.epicsCount} {isRtl ? "اپیک" : "Epics"}
                        </span>
                      </div>
                    </div>

                    {/* Timeline dates row */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {sDate && rDate ? (
                        <div className="flex items-center gap-1 font-medium font-sans">
                          <span>{sDate}</span>
                          <ArrowRight className="w-2.5 h-2.5 mx-0.5 text-slate-300" />
                          <span>{rDate}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100/60 rounded px-1.5 ml-1">
                            {duration} {t.days}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-500 italic font-medium">{t.clickToPlan}</span>
                      )}
                    </div>

                    {/* Progress Bar inside Timeline */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>{stats.storiesCount} {isRtl ? "استوری" : "Stories"}</span>
                        <span>{stats.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${stats.progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Release Planner Workspace & Dashboard HUD (col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {activeVersion ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-6">
              
              {/* Release Header Details & Inline Edit triggers */}
              <div className="border-b border-slate-100 pb-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.activeRelease}</span>
                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                      {activeVersion.name}
                      {activeVersion.released && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                          {isRtl ? "انتشار یافته" : "Released"}
                        </span>
                      )}
                    </h3>
                  </div>

                  {editingVersionId !== activeVersion.id && (
                    <button
                      onClick={() => startEditingDates(activeVersion)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100/80 transition px-3 py-1.5 rounded-lg"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {isRtl ? "ویرایش خط زمان" : "Edit Timeline"}
                    </button>
                  )}
                </div>

                {/* Inline Edit Form Panel */}
                {editingVersionId === activeVersion.id ? (
                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {t.startDate}
                        </label>
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {t.releaseDate}
                        </label>
                        <input
                          type="date"
                          value={editReleaseDate}
                          onChange={(e) => setEditReleaseDate(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {t.capacityLimit}
                        </label>
                        <input
                          type="number"
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(Number(e.target.value))}
                          className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {isRtl ? "توضیحات ریلیز" : "Release Notes/Description"}
                        </label>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                          placeholder="e.g. Core features, stable build"
                          dir="auto"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {saveStatusMsg ? (
                        <span className="text-xs font-semibold text-slate-500">{saveStatusMsg}</span>
                      ) : (
                        <span></span>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingVersionId(null)}
                          className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                        >
                          {isRtl ? "لغو" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={savingId === activeVersion.id}
                          onClick={() => saveVersionDetails(activeVersion.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isRtl ? "ثبت تغییرات" : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {activeMeta.description || activeVersion.description || (isRtl ? "توضیحی برای این ریلیز ثبت نشده است." : "No description registered for this release.")}
                  </p>
                )}
              </div>

              {/* HUD / Metrics Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">{isRtl ? "بازه خط زمانی" : "Duration"}</span>
                    <strong className="text-sm font-bold text-slate-800 font-sans">
                      {getDurationDays(activeVersion) ? `${getDurationDays(activeVersion)} ${t.days}` : "N/A"}
                    </strong>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">{isRtl ? "تعداد اپیک‌ها" : "Epics Count"}</span>
                    <strong className="text-sm font-bold text-slate-800 font-sans">{activeStats?.epicsCount}</strong>
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                  isOverCapacity 
                    ? 'bg-amber-50/50 border-amber-200' 
                    : 'bg-emerald-50/30 border-emerald-200/50'
                }`}>
                  <div className={`p-2 rounded-lg ${
                    isOverCapacity ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">{t.capacity}</span>
                    <div className="flex items-baseline gap-1">
                      <strong className="text-sm font-bold text-slate-800 font-sans">
                        {activeStats?.storiesCount} / {activeCapacity}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-normal">({t.storiesInEpic})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning label if over capacity */}
              {isOverCapacity && (
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2 text-xs text-amber-800 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{t.capacityWarning}</span>
                </div>
              )}

              {/* Scheduled Epics inside active release */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  {t.epicsInRelease} ({activeScheduledEpics.length})
                </h4>

                <div className="space-y-2.5">
                  {activeScheduledEpics.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      {t.noEpicsInRelease}
                    </p>
                  ) : (
                    activeScheduledEpics.map(epic => {
                      const stories = getStoriesForEpic(epic.key);
                      const isExpanded = expandedEpicId === epic.key;

                      return (
                        <div key={epic.key} className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-sm">
                          {/* Epic Header Row */}
                          <div className="flex items-center justify-between p-3 bg-slate-50/70 border-b border-slate-100 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="bg-purple-100 text-purple-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono select-all">
                                {epic.key}
                              </span>
                              <span className="text-xs font-bold text-slate-800 truncate" dir="auto">{epic.summary}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleAssignEpicToRelease(epic.key, undefined)}
                                className="text-[10px] text-red-500 font-semibold hover:bg-red-50 px-2 py-1 rounded transition border border-red-200/30"
                                title={isRtl ? "خروج از ریلیز" : "Unschedule"}
                              >
                                {isRtl ? "حذف" : "Remove"}
                              </button>

                              <button
                                onClick={() => setExpandedEpicId(isExpanded ? null : epic.key)}
                                className="flex items-center gap-1 text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-50 transition"
                              >
                                {t.viewStories} ({stories.length})
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Epic expanded Stories list */}
                          {isExpanded && (
                            <div className="p-3 bg-slate-50/30 space-y-2 animate-fade-in divide-y divide-slate-100">
                              {stories.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic text-center py-2">{t.emptyEpic}</p>
                              ) : (
                                stories.map(story => (
                                  <div key={story.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        story.status === 'success' ? 'bg-emerald-500' : 'bg-slate-400'
                                      }`}></span>
                                      <span className="text-slate-500 font-mono text-[10px] shrink-0 select-all">{story.id}</span>
                                      <span className="text-slate-700 font-medium truncate" dir="auto">{story.summary}</span>
                                    </div>

                                    <div>
                                      {story.status === 'success' ? (
                                        <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-100">
                                          {isRtl ? "منتشر شده" : "Published"}
                                        </span>
                                      ) : (
                                        <span className="bg-slate-100 text-slate-600 text-[9px] font-semibold px-1.5 py-0.5 rounded">
                                          {isRtl ? "پیش‌نویس" : "Draft"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Drag/Reassign Epic backpool scheduler */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">{t.unassignedBacklog}</h4>
                <p className="text-[11px] text-slate-400 mb-3">{t.unassignedBacklogDesc}</p>

                {unscheduledEpics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2.5 border border-slate-100 bg-slate-50/50 rounded-xl text-center">
                    {isRtl ? "همه اپیک‌ها زمان‌بندی شده‌اند!" : "All Epics are fully scheduled!"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {unscheduledEpics.map(epic => (
                      <div 
                        key={epic.key}
                        className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm text-xs"
                      >
                        <span className="bg-purple-100 text-purple-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono select-all">
                          {epic.key}
                        </span>
                        <span className="font-bold truncate max-w-[120px] sm:max-w-[200px]" dir="auto">{epic.summary}</span>
                        
                        <div className="flex items-center gap-1 shrink-0 min-w-[120px]">
                          <label className="text-[9px] text-slate-400 font-bold uppercase whitespace-nowrap">{t.scheduleEpic}:</label>
                          <div className="flex-1">
                            <CustomSelect
                              options={[
                                { value: "", label: isRtl ? "انتخاب" : "Select" },
                                ...localVersions.map(v => ({ value: v.id, label: v.name }))
                              ]}
                              value=""
                              onChange={(val) => {
                                if (val) {
                                  handleAssignEpicToRelease(epic.key, val);
                                }
                              }}
                              isRtl={isRtl}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium">{t.noVersions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
