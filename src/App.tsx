import { useState, useEffect } from 'react';
import { JiraCredentials, RefinedIssue, ConnectionConfig, JiraProject, JiraEpic, JiraComponent, Language, JiraUser, JiraVersion, JiraSprint } from './types';
import JiraConfig from './components/JiraConfig';
import DraftInput from './components/DraftInput';
import RefinedList from './components/RefinedList';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, ShieldCheck, AlertCircle, RefreshCw, Languages, 
  Layers, Settings, Github, Check, GitCommit, Link, Terminal
} from 'lucide-react';

const appTranslations = {
  en: {
    heroTitle: "Jira Server AI Refiner & Publisher",
    heroSubtitle: "Structure unstructured drafts, raw notes, or bullet points into beautiful, Agile-ready stories and epics. Review, refine, and seamlessly publish them directly to your self-hosted Jira Server with automated Epic links.",
    jiraStatus: "Jira Status",
    connected: "Connected",
    disconnected: "Not Configured",
    draftSection: "1. Draft & Refine with AI",
    boardSection: "2. Review & Publish to Jira",
    keyCheck: "Missing Gemini API Key",
    keyExplain: "Ensure GEMINI_API_KEY is defined in your Secrets in the AI Studio panel to enable story parsing.",
    toastSuccess: "Stories refined successfully by Gemini!",
    toastError: "Refinement failed. Please check your inputs.",
    connectionAlert: "Please connect to Jira Server first to use the publish features.",
    tabConnect: "1. Jira Connection & Config",
    tabWorkspace: "2. Story Refiner Workspace"
  },
  fa: {
    heroTitle: "تنظیم‌کننده و سازنده خودکار تیکت‌های جیرا (Self-Hosted)",
    heroSubtitle: "نیازمندی‌ها، ایده‌ها و پیش‌نویس‌های نامنظم خود را به استوری‌ها و اپیک‌های استاندارد، تمیز و مهندسی‌شده تبدیل کنید. سپس آن‌ها را مستقیماً همراه با پیوند خودکار اپیک‌ها در سرور جیرای سازمان خود منتشر کنید.",
    jiraStatus: "وضعیت جیرا",
    connected: "متصل شده",
    disconnected: "پیکربندی نشده",
    draftSection: "۱. ثبت پیش‌نویس و اصلاح با هوش مصنوعی",
    boardSection: "۲. بازبینی تیکت‌ها و انتشار در جیرا",
    keyCheck: "کلید Gemini پیدا نشد",
    keyExplain: "لطفاً کلید هوش مصنوعی GEMINI_API_KEY را در بخش Secrets پنل کاربری خود در AI Studio تعریف کنید.",
    toastSuccess: "اصلاح و تنظیم ساختار تیکت‌ها توسط هوش مصنوعی با موفقیت انجام شد!",
    toastError: "خطا در برقراری ارتباط با هوش مصنوعی. لطفاً ورودی‌ها را بررسی کنید.",
    connectionAlert: "جهت استفاده از ویژگی‌های انتشار، ابتدا به سرور جیرا متصل شوید.",
    tabConnect: "۱. اتصال و تنظیمات جیرا",
    tabWorkspace: "۲. کارگاه ساخت و اصلاح تیکت‌ها"
  }
};

export default function App() {
  // We default to Farsi ('fa') because the user prompted in Persian, but offer fluent English switching
  const [language, setLanguage] = useState<Language>('fa');
  const t = appTranslations[language];
  const isRtl = language === 'fa';

  // ---------------- STATE DEFINITIONS ----------------
  const [activeTab, setActiveTab] = useState<'connect' | 'workspace'>('connect');

  const [credentials, setCredentials] = useState<JiraCredentials>({
    url: "",
    authType: "pat",
    token: "",
    username: "",
    password: ""
  });
  
  const [projectKey, setProjectKey] = useState("");
  const [config, setConfig] = useState<ConnectionConfig>({
    epicNameField: "customfield_10008",
    epicLinkField: "customfield_10014",
    sprintFieldId: "customfield_10010"
  });

  const [jiraConnected, setJiraConnected] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<JiraProject[]>([]);
  const [existingEpics, setExistingEpics] = useState<JiraEpic[]>([]);
  const [fetchingEpics, setFetchingEpics] = useState(false);

  // Components fetching & manual configurations
  const [availableComponents, setAvailableComponents] = useState<JiraComponent[]>([]);
  const [fetchingComponents, setFetchingComponents] = useState(false);
  const [manualComponentsText, setManualComponentsText] = useState("");

  // Users fetching
  const [jiraUsers, setJiraUsers] = useState<JiraUser[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  // Versions and Sprints fetching
  const [jiraVersions, setJiraVersions] = useState<JiraVersion[]>([]);
  const [fetchingVersions, setFetchingVersions] = useState(false);
  const [jiraSprints, setJiraSprints] = useState<JiraSprint[]>([]);
  const [fetchingSprints, setFetchingSprints] = useState(false);

  // Issues generated from Gemini API
  const [issues, setIssues] = useState<RefinedIssue[]>([]);
  const [refining, setRefining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ---------------- EFFECT: LOCAL STORAGE LOAD ----------------
  useEffect(() => {
    try {
      const savedCreds = localStorage.getItem('jira_creds');
      const savedProject = localStorage.getItem('jira_project_key');
      const savedConfig = localStorage.getItem('jira_config');
      const savedIssues = localStorage.getItem('jira_refined_issues');
      const savedManualComps = localStorage.getItem('jira_manual_components');

      if (savedCreds) setCredentials(JSON.parse(savedCreds));
      if (savedProject) setProjectKey(savedProject);
      if (savedConfig) setConfig(JSON.parse(savedConfig));
      if (savedIssues) setIssues(JSON.parse(savedIssues));
      if (savedManualComps) setManualComponentsText(savedManualComps);
    } catch (e) {
      console.error("Error loading saved local settings", e);
    }
  }, []);

  // Sync issues to localStorage when updated
  useEffect(() => {
    if (issues.length > 0) {
      localStorage.setItem('jira_refined_issues', JSON.stringify(issues));
    } else {
      localStorage.removeItem('jira_refined_issues');
    }
  }, [issues]);

  // Sync manual components
  useEffect(() => {
    localStorage.setItem('jira_manual_components', manualComponentsText);
  }, [manualComponentsText]);

  // ---------------- ACTION HANDLERS ----------------
  const handleRefine = async (draftText: string, customPrompt: string) => {
    setRefining(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftText,
          customPrompt,
          projectKey
        })
      });

      const data = await response.json();
      if (response.ok && data.issues) {
        // Map raw issues from Gemini into application active issues
        const formatted: RefinedIssue[] = data.issues.map((issue: any) => ({
          ...issue,
          status: 'draft',
          suggestedLabels: issue.suggestedLabels || []
        }));
        setIssues(formatted);
        setSuccessMsg(t.toastSuccess);
        
        // Scroll smoothly to results
        setTimeout(() => {
          document.getElementById('refined-board-panel')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      } else {
        setErrorMsg(data.error || t.toastError);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to contact refinement endpoint.");
    } finally {
      setRefining(false);
    }
  };

  const fetchExistingEpics = async () => {
    if (!credentials.url || !projectKey) return;
    setFetchingEpics(true);
    try {
      const response = await fetch('/api/jira/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setExistingEpics(data.epics || []);
      }
    } catch (e) {
      console.error("Failed to fetch existing Jira epics", e);
    } finally {
      setFetchingEpics(false);
    }
  };

  const fetchComponents = async () => {
    if (!credentials.url || !projectKey) return;
    setFetchingComponents(true);
    try {
      const response = await fetch('/api/jira/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAvailableComponents(data.components || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira components", e);
    } finally {
      setFetchingComponents(false);
    }
  };

  const fetchJiraUsers = async () => {
    if (!credentials.url || !projectKey) return;
    setFetchingUsers(true);
    try {
      const response = await fetch('/api/jira/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setJiraUsers(data.users || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira users", e);
    } finally {
      setFetchingUsers(false);
    }
  };

  const fetchJiraVersions = async () => {
    if (!credentials.url || !projectKey) return;
    setFetchingVersions(true);
    try {
      const response = await fetch('/api/jira/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setJiraVersions(data.versions || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira versions", e);
    } finally {
      setFetchingVersions(false);
    }
  };

  const fetchJiraSprints = async () => {
    if (!credentials.url || !projectKey) return;
    setFetchingSprints(true);
    try {
      const response = await fetch('/api/jira/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creds: credentials,
          projectKey
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setJiraSprints(data.sprints || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira sprints", e);
    } finally {
      setFetchingSprints(false);
    }
  };

  // Trigger epics, components and users fetch whenever Jira connects or project key changes
  useEffect(() => {
    if (jiraConnected && projectKey) {
      fetchExistingEpics();
      fetchComponents();
      fetchJiraUsers();
      fetchJiraVersions();
      fetchJiraSprints();
    } else {
      setExistingEpics([]);
      setAvailableComponents([]);
      setJiraUsers([]);
      setJiraVersions([]);
      setJiraSprints([]);
    }
  }, [jiraConnected, projectKey]);

  const clearIssues = () => {
    setIssues([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div 
      className={`min-h-screen bg-[#F8FAFC] text-slate-900 pb-16`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Dynamic Header Banner */}
      <header className="bg-[#0F172A] border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-blue-500 rounded-md flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {isRtl ? "تنظیم‌کننده و سازنده‌خودکار جیرا" : "Jira AI Ticket Creator"} <span className="text-blue-400 font-normal">Self-Host</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                {isRtl ? "ویژه نسخه‌های سلف‌هاست و دیتاسنتر" : "Enterprise Jira Server Integration"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Jira Connection Pill */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold font-sans ${jiraConnected ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-slate-800/80 border-slate-700 text-slate-300'}`}>
              <span className={`h-2 w-2 rounded-full ${jiraConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span>{t.jiraStatus}: {jiraConnected ? t.connected : t.disconnected}</span>
            </div>

            {/* Language Switcher Button */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700/80 rounded-lg transition duration-150 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'fa' ? 'English' : 'فارسی'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Decorative Hero Callout */}
        <div className="text-start space-y-2.5 max-w-4xl">
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            {t.heroTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-sans max-w-3xl">
            {t.heroSubtitle}
          </p>
        </div>

        {/* Status Messages */}
        <AnimatePresence mode="popLayout">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-800 max-w-5xl"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{isRtl ? "خطایی رخ داد:" : "An error occurred:"}</span>
                <p className="mt-0.5 font-medium leading-relaxed">{errorMsg}</p>
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-sm text-emerald-800 max-w-5xl cursor-pointer"
              onClick={() => setSuccessMsg(null)}
            >
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{isRtl ? "عملیات موفقیت‌آمیز:" : "Success:"}</span>
                <p className="mt-0.5 font-medium leading-relaxed">{successMsg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Switching Menu */}
        <div className="flex border-b border-slate-200 gap-1 sm:gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('connect')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              activeTab === 'connect'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            {t.tabConnect}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('workspace');
              // Automatically pull updates if connected when switching to workspace
              if (jiraConnected && projectKey) {
                fetchExistingEpics();
                fetchComponents();
                fetchJiraUsers();
              }
            }}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
              activeTab === 'workspace'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {t.tabWorkspace}
            {issues.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {issues.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Connection & Configurations */}
        {activeTab === 'connect' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1">
              <JiraConfig
                language={language}
                credentials={credentials}
                onCredentialsChange={setCredentials}
                projectKey={projectKey}
                onProjectKeyChange={setProjectKey}
                config={config}
                onConfigChange={setConfig}
                onConnectionStatusChange={setJiraConnected}
                availableProjects={availableProjects}
                onAvailableProjectsChange={setAvailableProjects}
              />
            </div>

            {/* Manual Components Config Panel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {isRtl ? "پیکربندی کامپوننت‌های جیرا" : "Configure Jira Components"}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isRtl
                      ? "کامپوننت‌های پروژه را از سرور جیرا دریافت کرده‌ایم. اگر نتوانستید وصل شوید، می‌توانید کامپوننت‌ها را به صورت دستی با ویرگول جدا کرده و بنویسید."
                      : "Components are loaded from Jira project. If needed, you can manually override or type them here (comma separated)."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {isRtl ? "کامپوننت‌های دریافت شده از جیرا" : "Components Fetched from Jira"}
                  </label>
                  {fetchingComponents ? (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 py-3">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span>{isRtl ? "در حال بارگذاری..." : "Loading..."}</span>
                    </div>
                  ) : availableComponents.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200/60 max-h-32 overflow-y-auto">
                      {availableComponents.map((comp) => (
                        <span key={comp.id} className="text-[11px] bg-slate-200/80 text-slate-700 py-0.5 px-2 rounded font-medium border border-slate-200">
                          {comp.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-3">
                      {isRtl ? "هیچ کامپوننتی یافت نشد. ارتباط خود را بررسی کنید." : "No components loaded from Jira yet."}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {isRtl ? "افزودن دستی کامپوننت‌ها (با ویرگول جدا کنید)" : "Manually Enter Components (Comma separated)"}
                  </label>
                  <input
                    type="text"
                    className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition bg-slate-50/30"
                    placeholder={isRtl ? "مثال: UI, Core, Backend, DevOps" : "e.g., UI, Core, Backend, DevOps"}
                    value={manualComponentsText}
                    onChange={(e) => setManualComponentsText(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    {isRtl
                      ? "سیستم لیست نهایی کامپوننت‌ها را از مجموع موارد دریافت شده جیرا و ورودی‌های دستی شما تشکیل می‌دهد."
                      : "The final list combines components loaded from Jira with those manually typed above."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Story Refiner Workspace */}
        {activeTab === 'workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
            {/* Column A: Drafts Panel */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-1">
                <Sparkles className="w-4 h-4 text-blue-500" />
                {t.draftSection}
              </h3>
              <DraftInput
                language={language}
                onRefine={handleRefine}
                loading={refining}
              />
            </div>

            {/* Column B: Interactive Review & Creation Board */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-500" />
                  {t.boardSection}
                </h3>
                {issues.length > 0 && (
                  <button
                    type="button"
                    onClick={clearIssues}
                    className="text-xs font-medium text-slate-400 hover:text-red-500 transition focus:outline-none cursor-pointer"
                  >
                    {isRtl ? "پاک کردن برد" : "Clear Board"}
                  </button>
                )}
              </div>

              <RefinedList
                language={language}
                issues={issues}
                onIssuesChange={setIssues}
                credentials={credentials}
                projectKey={projectKey}
                config={config}
                jiraConnected={jiraConnected}
                existingEpics={existingEpics}
                onFetchEpics={fetchExistingEpics}
                fetchingEpics={fetchingEpics}
                availableComponents={[
                  ...availableComponents.map(c => c.name),
                  ...manualComponentsText.split(',').map(s => s.trim()).filter(Boolean)
                ].filter((v, i, self) => self.indexOf(v) === i)}
                availableUsers={jiraUsers}
                fetchingUsers={fetchingUsers}
                onFetchUsers={fetchJiraUsers}
                availableVersions={jiraVersions}
                fetchingVersions={fetchingVersions}
                onFetchVersions={fetchJiraVersions}
                availableSprints={jiraSprints}
                fetchingSprints={fetchingSprints}
                onFetchSprints={fetchJiraSprints}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-6 border-t border-slate-200/60 text-center text-xs text-slate-400 font-mono flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          © 2026 Jira AI Workspace • Developed securely with server proxy
        </div>
        <div className="flex items-center gap-1 text-[11px] bg-slate-100 py-1 px-2.5 rounded-full border border-slate-200/40 text-slate-500">
          <GitCommit className="w-3.5 h-3.5" />
          <span>No credential tracking • Offline-safe design</span>
        </div>
      </footer>
    </div>
  );
}
