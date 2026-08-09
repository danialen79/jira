import React, { useState, useEffect } from 'react';
import { JiraCredentials, ConnectionConfig, Language, EpicAuditItem, EpicAuditChildIssue } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Filter, 
  ChevronRight, ChevronLeft, ShieldCheck, Tag, ExternalLink, 
  CheckSquare, Square, ArrowLeft, ArrowRight, Info
} from 'lucide-react';

interface EpicComponentSyncProps {
  language: Language;
  credentials: JiraCredentials;
  projectKey: string;
  config: ConnectionConfig;
  jiraConnected: boolean;
}

const syncTranslations = {
  en: {
    title: "Epic Component Sync & Audit",
    subtitle: "Locate Epics that have components assigned, but whose connected Stories, Bugs, or Tasks are missing those components. Review and apply Epic components with 1-click confirmation.",
    connectFirst: "Please connect to Jira Server and select a project in Tab 1 first.",
    refreshBtn: "Refresh Data",
    loadingEpics: "Searching Epics and connected issues...",
    onlyMissingToggle: "Show only issues missing components",
    showAllToggle: "Show all connected issues",
    epicComponentLabel: "Epic Components:",
    noEpicsFound: "No Epics with components found in this project for the current filter.",
    pageLabel: "Page",
    ofLabel: "of",
    epicsTotal: "Total Epics:",
    selectedCount: "Selected",
    issuesSelected: "issue(s)",
    applyBtn: "Apply Epic Components to Selected Issues",
    confirmModalTitle: "Confirm Component Update",
    confirmModalDesc: "You are about to update the following Jira issues to inherit their parent Epic's components. Are you sure?",
    confirmBtn: "Yes, Confirm & Update in Jira",
    cancelBtn: "Cancel",
    updatingProgress: "Updating issues on Jira...",
    updateSuccess: "Successfully updated components on Jira!",
    noIssuesInEpic: "No child issues found under this Epic.",
    allHaveComponents: "All connected issues under this Epic already have components assigned.",
    currentComponents: "Current:",
    missingToAdd: "Will Add:",
    noComponentBadge: "No Component",
    selectAllEpic: "Select All in this Epic"
  },
  fa: {
    title: "همگام‌سازی و اعمال کامپوننت‌های اپیک",
    subtitle: "شناسایی اپیک‌هایی که دارای کامپوننت هستند اما استوری‌ها، باگ‌ها یا تسک‌های متصل به آن‌ها کامپوننت ندارند. مشاهده صفحه به صفحه (۱۰تایی) و اعمال کامپوننت با تایید شما.",
    connectFirst: "لطفاً ابتدا در تب اول به سرور جیرا متصل شده و یک پروژه انتخاب کنید.",
    refreshBtn: "به‌روزرسانی داده‌ها",
    loadingEpics: "در حال جستجوی اپیک‌ها و تیکت‌های متصل...",
    onlyMissingToggle: "فقط نمایش تیکت‌های بدون کامپوننت",
    showAllToggle: "نمایش تمام تیکت‌های متصل",
    epicComponentLabel: "کامپوننت‌های اپیک:",
    noEpicsFound: "هیچ اپیکِ دارای کامپوننتی برای فیلتر جاری یافت نشد.",
    pageLabel: "صفحه",
    ofLabel: "از",
    epicsTotal: "کل اپیک‌ها:",
    selectedCount: "تعداد انتخاب شده:",
    issuesSelected: "تیکت",
    applyBtn: "اعمال کامپوننت‌های اپیک روی تیکت‌های انتخاب‌شده",
    confirmModalTitle: "تایید به روزرسانی کامپوننت‌ها در جیرا",
    confirmModalDesc: "شما در حال اعمال کامپوننت‌های اپیک مادر بر روی تیکت‌های زیر در جیرا هستید. آیا تایید می‌کنید؟",
    confirmBtn: "تایید و ثبت نهایی در جیرا",
    cancelBtn: "انصراف",
    updatingProgress: "در حال به روزرسانی تیکت‌ها در سرور جیرا...",
    updateSuccess: "کامپوننت‌های تیکت‌ها با موفقیت در جیرا به روزرسانی شدند!",
    noIssuesInEpic: "هیچ تیکت فرعی متصلی زیر این اپیک یافت نشد.",
    allHaveComponents: "تمام تیکت‌های متصل به این اپیک دارای کامپوننت هستند.",
    currentComponents: "فعلی:",
    missingToAdd: "افزودن:",
    noComponentBadge: "بدون کامپوننت",
    selectAllEpic: "انتخاب همه تیکت‌های این اپیک"
  }
};

export default function EpicComponentSync({
  language,
  credentials,
  projectKey,
  config,
  jiraConnected
}: EpicComponentSyncProps) {
  const t = syncTranslations[language];
  const isRtl = language === 'fa';

  // State
  const [loading, setLoading] = useState(false);
  const [epics, setEpics] = useState<EpicAuditItem[]>([]);
  const [totalEpics, setTotalEpics] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<string[]>([]);
  
  // Modal & Async states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState("");
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Audit Data from Server
  const fetchAuditData = async (page: number = currentPage, overrideOnlyMissing?: boolean) => {
    if (!jiraConnected || !projectKey || !credentials.url) return;
    setLoading(true);
    setErrorMsg(null);
    setToastSuccess(null);

    const missingFilter = overrideOnlyMissing !== undefined ? overrideOnlyMissing : onlyMissing;
    const startAt = (page - 1) * pageSize;

    try {
      const res = await fetch('/api/jira/epic-components-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey,
          config,
          startAt,
          maxResults: pageSize,
          onlyWithComponents: true,
          onlyMissing: missingFilter
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEpics(data.epics || []);
        setTotalEpics(data.total || 0);
        // Clear selection on page load
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
    if (jiraConnected && projectKey) {
      fetchAuditData(currentPage);
    }
  }, [jiraConnected, projectKey, currentPage]);

  const totalPages = Math.ceil(totalEpics / pageSize) || 1;

  // Toggle single issue selection
  const toggleIssueSelection = (key: string) => {
    setSelectedIssueKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Toggle selection for an entire Epic
  const toggleEpicSelection = (epic: EpicAuditItem) => {
    const candidateIssues = epic.childIssues.filter(child => 
      onlyMissing ? child.missingComponents.length > 0 || child.components.length === 0 : true
    );
    const candidateKeys = candidateIssues.map(c => c.key);
    
    const allSelected = candidateKeys.every(k => selectedIssueKeys.includes(k));

    if (allSelected) {
      // Unselect all keys belonging to this epic
      setSelectedIssueKeys(prev => prev.filter(k => !candidateKeys.includes(k)));
    } else {
      // Add all missing candidate keys
      const newKeys = [...selectedIssueKeys];
      candidateKeys.forEach(k => {
        if (!newKeys.includes(k)) newKeys.push(k);
      });
      setSelectedIssueKeys(newKeys);
    }
  };

  // Get selected issues payload for approval modal
  const getSelectedUpdatesPayload = () => {
    const updatesMap: Record<string, string[]> = {};

    epics.forEach(epic => {
      epic.childIssues.forEach(child => {
        if (selectedIssueKeys.includes(child.key)) {
          // New components list = Union of existing components + Epic's components
          const combined = Array.from(new Set([...child.components, ...epic.components]));
          updatesMap[child.key] = combined;
        }
      });
    });

    return Object.entries(updatesMap).map(([issueKey, components]) => ({
      issueKey,
      components
    }));
  };

  // Execute Jira Bulk Update
  const handleConfirmUpdate = async () => {
    const payload = getSelectedUpdatesPayload();
    if (payload.length === 0) return;

    setUpdating(true);
    setUpdateProgress(isRtl ? "در حال ارسال اطلاعات به جیرا..." : "Sending updates to Jira...");
    setErrorMsg(null);

    try {
      const res = await fetch('/api/jira/bulk-update-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          updates: payload
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastSuccess(`${t.updateSuccess} (${data.updatedCount} / ${payload.length})`);
        setShowConfirmModal(false);
        setSelectedIssueKeys([]);
        // Refresh current page
        fetchAuditData(currentPage);
      } else {
        setErrorMsg(data.error || "Failed to update issue components.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to bulk update server endpoint.");
    } finally {
      setUpdating(false);
      setUpdateProgress("");
    }
  };

  if (!jiraConnected) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">{t.connectFirst}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t.title}</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                {t.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchAuditData(currentPage)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t.refreshBtn}</span>
          </button>
        </div>

        {/* Filter Controls & Stats Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-lg p-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 ms-1" />
            <button
              type="button"
              onClick={() => handleMissingToggle(true)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                onlyMissing ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.onlyMissingToggle}
            </button>
            <button
              type="button"
              onClick={() => handleMissingToggle(false)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                !onlyMissing ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.showAllToggle}
            </button>
          </div>

          <div className="flex items-center gap-4 text-slate-600 font-medium">
            <span>{t.epicsTotal} <strong className="text-slate-900">{totalEpics}</strong></span>
            <span>|</span>
            <span>{t.pageLabel} <strong className="text-blue-600">{currentPage}</strong> {t.ofLabel} {totalPages}</span>
          </div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {toastSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastSuccess}</span>
          </div>
          <button onClick={() => setToastSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900 font-bold">×</button>
        </div>
      )}

      {/* Epics List (10 per page) */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">{t.loadingEpics}</p>
        </div>
      ) : epics.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">{t.noEpicsFound}</h4>
        </div>
      ) : (
        <div className="space-y-4">
          {epics.map((epic) => {
            // Filter child issues based on view state
            const filteredChildIssues = epic.childIssues.filter(child => 
              onlyMissing ? child.missingComponents.length > 0 || child.components.length === 0 : true
            );

            const missingChildCount = epic.childIssues.filter(c => c.missingComponents.length > 0 || c.components.length === 0).length;

            const allFilteredSelected = filteredChildIssues.length > 0 && 
              filteredChildIssues.every(c => selectedIssueKeys.includes(c.key));

            return (
                <div 
                  key={epic.key}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden transition hover:border-slate-300"
                >
                {/* Epic Header Bar */}
                <div className="bg-slate-50/80 px-4 sm:px-5 py-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 font-mono text-xs font-bold rounded-md border border-purple-200">
                      {epic.key}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {epic.summary}
                    </h3>
                  </div>

                  {/* Epic Component Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-semibold me-1">
                      {t.epicComponentLabel}
                    </span>
                    {epic.components.length > 0 ? (
                      epic.components.map(comp => (
                        <span 
                          key={comp}
                          className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold rounded flex items-center gap-1"
                        >
                          <Tag className="w-3 h-3 text-indigo-500" />
                          {comp}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">--</span>
                    )}
                  </div>
                </div>

                {/* Connected Issues List */}
                <div className="p-4 sm:p-5">
                  {epic.childIssues.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-2">
                      {t.noIssuesInEpic}
                    </p>
                  ) : filteredChildIssues.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-emerald-700 bg-emerald-50/60 rounded-lg border border-emerald-100">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>{t.allHaveComponents}</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleEpicSelection(epic)}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 cursor-pointer font-bold lowercase tracking-normal"
                          >
                            {allFilteredSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                            <span>{t.selectAllEpic}</span>
                          </button>
                        </div>
                        <div>
                          {missingChildCount} {t.issuesSelected}
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {filteredChildIssues.map((child) => {
                          const isSelected = selectedIssueKeys.includes(child.key);
                          const isMissingComps = child.missingComponents.length > 0 || child.components.length === 0;

                          return (
                            <div 
                              key={child.key}
                              onClick={() => toggleIssueSelection(child.key)}
                              className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition ${
                                isSelected 
                                  ? 'bg-blue-50/70 border border-blue-200' 
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              {/* Left side: Checkbox, Issue Key, Type, Summary */}
                              <div className="flex items-start sm:items-center gap-3">
                                <button type="button" className="mt-0.5 sm:mt-0 text-slate-400">
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300" />
                                  )}
                                </button>

                                <span className="text-xs font-mono font-bold text-slate-700 shrink-0">
                                  {child.key}
                                </span>

                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                                  child.issuetype === 'Story' ? 'bg-emerald-100 text-emerald-800' :
                                  child.issuetype === 'Bug' ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {child.issuetype}
                                </span>

                                <span className="text-xs font-medium text-slate-900 line-clamp-1">
                                  {child.summary}
                                </span>
                              </div>

                              {/* Right side: Component Status & Action */}
                              <div className="flex items-center gap-2 text-[11px] shrink-0 ms-7 sm:ms-0">
                                <div className="flex items-center gap-1 text-slate-500 me-2">
                                  <span className="text-slate-400">{t.currentComponents}</span>
                                  {child.components.length > 0 ? (
                                    child.components.map(c => (
                                      <span key={c} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                                        {c}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] border border-amber-200 font-semibold">
                                      {t.noComponentBadge}
                                    </span>
                                  )}
                                </div>

                                {isMissingComps && (
                                  <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200/80 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                    <span>{t.missingToAdd}</span>
                                    {epic.components.map(ec => (
                                      <span key={ec} className="underline decoration-indigo-300">
                                        +{ec}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition disabled:opacity-40 cursor-pointer"
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span>{isRtl ? "صفحه قبل" : "Previous"}</span>
          </button>

          <div className="text-xs font-bold text-slate-700">
            {t.pageLabel} {currentPage} {t.ofLabel} {totalPages}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition disabled:opacity-40 cursor-pointer"
          >
            <span>{isRtl ? "صفحه بعد" : "Next"}</span>
            {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Sticky Bottom Action Bar when items selected */}
      <AnimatePresence>
        {selectedIssueKeys.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 max-w-xl w-[90%]"
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>{t.selectedCount} <strong className="text-blue-300 font-bold">{selectedIssueKeys.length}</strong> {t.issuesSelected}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="ms-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.applyBtn}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation & Progress Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.confirmModalTitle}</h3>
                <p className="text-xs text-slate-500 mt-1">{t.confirmModalDesc}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 text-xs">
              {getSelectedUpdatesPayload().map(item => (
                <div key={item.issueKey} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                  <span className="font-mono font-bold text-slate-800">{item.issueKey}</span>
                  <span className="text-indigo-600 font-semibold">{item.components.join(', ')}</span>
                </div>
              ))}
            </div>

            {updating && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs text-blue-800 font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>{updateProgress}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={updating}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmUpdate}
                disabled={updating}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {updating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{t.confirmBtn}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
