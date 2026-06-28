import React, { useState, useEffect } from 'react';
import { JiraCredentials, ConnectionConfig, JiraProject, Language } from '../types';
import { Settings, ShieldCheck, HelpCircle, RefreshCw, Server, Check, AlertCircle, Download, Upload } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface JiraConfigProps {
  language: Language;
  credentials: JiraCredentials;
  onCredentialsChange: (creds: JiraCredentials) => void;
  projectKey: string;
  onProjectKeyChange: (key: string) => void;
  config: ConnectionConfig;
  onConfigChange: (cfg: ConnectionConfig) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  availableProjects: JiraProject[];
  onAvailableProjectsChange: (projects: JiraProject[]) => void;
}

const translations = {
  en: {
    title: "Jira Server Connection",
    subtitle: "Configure your self-hosted Jira integration securely. All credentials are saved strictly in your local browser storage.",
    jiraUrl: "Jira Server URL",
    jiraUrlPlaceholder: "https://jira.yourcompany.com",
    authType: "Authentication Type",
    pat: "Personal Access Token (PAT)",
    basic: "Username + Password / API Token",
    token: "Personal Access Token",
    username: "Username",
    password: "Password / API Token",
    projectKey: "Jira Project Key",
    projectKeyPlaceholder: "e.g., PROJ",
    epicNameField: "Epic Name Custom Field ID",
    epicLinkField: "Epic Link Custom Field ID",
    testConnection: "Test Connection",
    testing: "Connecting...",
    connectedAs: "Connected as:",
    advanced: "Jira Server Custom Fields Mapping",
    advancedHelp: "Jira Server/Data Center uses custom fields for Epic Names and Epic Links. Change these if yours are different from standard defaults.",
    saveSuccess: "Saved securely to local browser storage!",
    failedToConnect: "Connection failed",
    selectProject: "Fetch & Select Projects",
    projectsFetched: "Successfully fetched projects",
    placeholderProject: "Select a fetched project",
    fieldExplain: "Standard Epic Name field is customfield_10008, Epic Link is customfield_10014, Sprint is customfield_10010.",
    urlHelp: "Provide the absolute URL to your company's self-hosted Jira dashboard.",
    sprintField: "Sprint Custom Field ID",
    export: "Export JSON",
    import: "Import JSON",
    importSuccess: "Settings imported successfully!",
    importError: "Failed to parse settings JSON."
  },
  fa: {
    title: "اتصال به سرور جیرا",
    subtitle: "تنظیمات اتصال به جیرا سلف‌هاست خود را به صورت امن پیکربندی کنید. مشخصات شما به صورت کاملاً محلی در مرورگر ذخیره می‌شود.",
    jiraUrl: "آدرس سرور جیرا (Self-Hosted URL)",
    jiraUrlPlaceholder: "https://jira.yourcompany.com",
    authType: "نوع احراز هویت",
    pat: "توکن دسترسی شخصی (PAT)",
    basic: "نام کاربری + رمز عبور یا توکن",
    token: "توکن دسترسی شخصی (PAT)",
    username: "نام کاربری",
    password: "رمز عبور / توکن API",
    projectKey: "کلید پروژه (Project Key)",
    projectKeyPlaceholder: "مثال: PROJ",
    epicNameField: "شناسه فیلد سفارشی نام اپیک (Epic Name Custom Field)",
    epicLinkField: "شناسه فیلد سفارشی لینک اپیک (Epic Link Custom Field)",
    testConnection: "بررسی و تست اتصال",
    testing: "در حال اتصال...",
    connectedAs: "متصل شده به عنوان:",
    advanced: "مکان‌یابی فیلدهای سفارشی پیشرفته جیرا",
    advancedHelp: "سرور جیرا (Data Center / Server) برای نام اپیک و پیوند اپیک از فیلدهای سفارشی استفاده می‌کند. در صورت تفاوت با مقادیر پیش‌فرض آن‌ها را تغییر دهید.",
    saveSuccess: "اطلاعات با موفقیت در حافظه مرورگر شما ذخیره شد!",
    failedToConnect: "خطا در تست اتصال",
    selectProject: "دریافت پروژه‌ها از سرور",
    projectsFetched: "لیست پروژه‌ها با موفقیت دریافت شد",
    placeholderProject: "انتخاب از پروژه‌های دریافت شده",
    fieldExplain: "فیلد پیش‌فرض نام اپیک customfield_10008، لینک اپیک customfield_15000/customfield_10014 و اسپرینت customfield_10010 است.",
    urlHelp: "آدرس کامل دسترسی به پنل جیرای شرکت خود را وارد نمایید.",
    sprintField: "شناسه فیلد سفارشی اسپرینت (Sprint Custom Field ID)",
    export: "خروجی تنظیمات",
    import: "ورود فایل تنظیمات",
    importSuccess: "تنظیمات اتصال با موفقیت وارد شد!",
    importError: "خطا در خواندن فایل پیکربندی JSON."
  }
};

export default function JiraConfig({
  language,
  credentials,
  onCredentialsChange,
  projectKey,
  onProjectKeyChange,
  config,
  onConfigChange,
  onConnectionStatusChange,
  availableProjects,
  onAvailableProjectsChange
}: JiraConfigProps) {
  const t = translations[language];
  const isRtl = language === 'fa';

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; user?: any } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fetchingProjects, setFetchingProjects] = useState(false);

  // Sync state to local storage when changed
  const saveToLocalStorage = () => {
    localStorage.setItem('jira_creds', JSON.stringify(credentials));
    localStorage.setItem('jira_project_key', projectKey);
    localStorage.setItem('jira_config', JSON.stringify(config));
  };

  useEffect(() => {
    saveToLocalStorage();
  }, [credentials, projectKey, config]);

  const testConnection = async () => {
    if (!credentials.url) {
      setTestResult({ success: false, message: isRtl ? "لطفاً آدرس جیرا را وارد کنید." : "Please provide a Jira Server URL." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    onConnectionStatusChange(false);

    try {
      const response = await fetch('/api/jira/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: `${t.connectedAs} ${data.user.displayName} (${data.user.emailAddress || data.user.name})`,
          user: data.user
        });
        onConnectionStatusChange(true);
        // Automatically fetch projects after successful test
        fetchProjects();
      } else {
        setTestResult({
          success: false,
          message: data.error || (isRtl ? "نام کاربری یا رمز عبور اشتباه است." : "Invalid credentials or URL.")
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to make request"
      });
    } finally {
      setTesting(false);
    }
  };

  const fetchProjects = async () => {
    if (!credentials.url) return;
    setFetchingProjects(true);
    try {
      const response = await fetch('/api/jira/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onAvailableProjectsChange(data.projects || []);
      }
    } catch (e) {
      console.error("Failed to fetch projects", e);
    } finally {
      setFetchingProjects(false);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ credentials, projectKey, config }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `jira-ai-connection-${projectKey || 'config'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.credentials) onCredentialsChange(parsed.credentials);
        if (parsed.projectKey) onProjectKeyChange(parsed.projectKey || '');
        if (parsed.config) onConfigChange(parsed.config);
        
        setTestResult({
          success: true,
          message: t.importSuccess
        });
      } catch (err) {
        setTestResult({
          success: false,
          message: t.importError
        });
      }
    };
    fileReader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="jira-config-panel">
      {/* Panel Header */}
      <div className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 font-sans">{t.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Export / Import Button Group */}
          <div className="flex items-center gap-1 border-r border-slate-200/60 pr-3 mr-1">
            <label className="py-1 px-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded transition duration-150 cursor-pointer flex items-center gap-1" title={t.import}>
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.import}</span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              type="button"
              onClick={handleExport}
              className="py-1 px-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded transition duration-150 cursor-pointer flex items-center gap-1"
              title={t.export}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.export}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${testResult?.success ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${testResult?.success ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-xs font-mono font-medium text-slate-600">
              {testResult?.success ? "Active" : "Setup"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Jira URL */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {t.jiraUrl}
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" title={t.urlHelp} />
          </label>
          <input
            type="text"
            className={`w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition duration-150 font-mono`}
            placeholder={t.jiraUrlPlaceholder}
            value={credentials.url}
            onChange={(e) => onCredentialsChange({ ...credentials, url: e.target.value })}
            dir="ltr"
          />
        </div>

        {/* Auth Type selection */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            {t.authType}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onCredentialsChange({ ...credentials, authType: 'pat' })}
              className={`text-xs font-medium py-2 px-3 rounded-lg border transition duration-150 ${credentials.authType === 'pat' ? 'bg-[#0F172A] border-[#0F172A] text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
            >
              {t.pat}
            </button>
            <button
              type="button"
              onClick={() => onCredentialsChange({ ...credentials, authType: 'basic' })}
              className={`text-xs font-medium py-2 px-3 rounded-lg border transition duration-150 ${credentials.authType === 'basic' ? 'bg-[#0F172A] border-[#0F172A] text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
            >
              {t.basic}
            </button>
          </div>
        </div>

        {/* Dynamic Credentials Inputs */}
        {credentials.authType === 'pat' ? (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {t.token}
            </label>
            <input
              type="password"
              className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition duration-150 font-mono"
              placeholder="••••••••••••••••••••••••"
              value={credentials.token || ''}
              onChange={(e) => onCredentialsChange({ ...credentials, token: e.target.value })}
              dir="ltr"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {t.username}
              </label>
              <input
                type="text"
                className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition duration-150 font-mono"
                placeholder="danial.enayati"
                value={credentials.username || ''}
                onChange={(e) => onCredentialsChange({ ...credentials, username: e.target.value })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {t.password}
              </label>
              <input
                type="password"
                className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition duration-150 font-mono"
                placeholder="••••••••••••"
                value={credentials.password || ''}
                onChange={(e) => onCredentialsChange({ ...credentials, password: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>
        )}

        {/* Project Key config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {t.projectKey}
            </label>
            <input
              type="text"
              className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition duration-150 font-mono"
              placeholder={t.projectKeyPlaceholder}
              value={projectKey}
              onChange={(e) => onProjectKeyChange(e.target.value.toUpperCase())}
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {isRtl ? "پروژه‌های دریافت شده" : "Fetched Jira Projects"}
            </label>
            <CustomSelect
              disabled={availableProjects.length === 0}
              options={[
                {
                  value: "",
                  label: availableProjects.length > 0 ? `-- ${t.placeholderProject} --` : `-- ${isRtl ? "اتصال را بررسی کنید" : "Test connection to load"} --`
                },
                ...availableProjects.map((proj) => ({
                  value: proj.key,
                  label: `${proj.key} - ${proj.name}`
                }))
              ]}
              value={availableProjects.some(p => p.key === projectKey) ? projectKey : ""}
              onChange={(val) => onProjectKeyChange(val)}
              showSearch={true}
              isRtl={isRtl}
            />
          </div>
        </div>

        {/* Collapsible Advanced Custom Fields config */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition font-medium focus:outline-none"
          >
            <Settings className={`w-3.5 h-3.5 transition duration-200 ${showAdvanced ? 'rotate-45' : ''}`} />
            {t.advanced}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 bg-slate-50 border border-slate-100 rounded-lg space-y-3">
              <p className="text-xs text-slate-500 flex items-start gap-1.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  {t.advancedHelp}
                  <br />
                  <span className="font-mono mt-1 block font-medium">{t.fieldExplain}</span>
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                    Epic Name Field (e.g. customfield_10008)
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white font-mono"
                    value={config.epicNameField}
                    onChange={(e) => onConfigChange({ ...config, epicNameField: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                    Epic Link Field (e.g. customfield_10014)
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white font-mono"
                    value={config.epicLinkField}
                    onChange={(e) => onConfigChange({ ...config, epicLinkField: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                    {language === 'fa' ? "شناسه فیلد اسپرینت" : "Sprint Field (e.g. customfield_10010)"}
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white font-mono"
                    value={config.sprintFieldId || ''}
                    placeholder="customfield_10010"
                    onChange={(e) => onConfigChange({ ...config, sprintFieldId: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Buttons and Result Display */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex-1">
            {testResult && (
              <div className={`p-2.5 rounded-lg flex items-start gap-2.5 text-xs ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                {testResult.success ? (
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                )}
                <span className="font-medium leading-relaxed">{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={testConnection}
              className={`py-2 px-4 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 active:bg-blue-800 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 ${isRtl ? 'font-sans' : 'font-sans'} cursor-pointer`}
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {t.testing}
                </>
              ) : (
                <>
                  <Server className="w-3.5 h-3.5" />
                  {t.testConnection}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
