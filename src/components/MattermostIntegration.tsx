import { useState, useEffect } from 'react';
import { Language } from '../types';
import { 
  MessageSquare, RefreshCw, Send, CheckCircle, AlertCircle, 
  HelpCircle, Copy, ExternalLink, ArrowLeft, ArrowRight, User
} from 'lucide-react';

interface MattermostIntegrationProps {
  language: Language;
  onImportDraft: (text: string) => void;
}

interface MattermostConfig {
  url: string;
  hasToken: boolean;
  configured: boolean;
}

interface MattermostDraft {
  id: string;
  channelId: string;
  channelName: string;
  rawText: string;
  cleanedText: string;
  userId: string;
  senderName: string;
  createdAt: number;
  isMention: boolean;
}

const translations = {
  en: {
    title: "Mattermost Bot Workspace",
    subtitle: "Test connection to your self-hosted Mattermost bot and fetch raw drafts/requirements directly from channels.",
    notConfigured: "Mattermost Bot Not Configured",
    configInstructions: "To enable direct drafting from Mattermost channels, please add the following environment variables to your `.env` file on your server:",
    copyBtn: "Copy",
    copied: "Copied!",
    refreshConfig: "Refresh Config",
    statusConnected: "Connected successfully to Mattermost!",
    statusError: "Failed to connect to Mattermost.",
    testBtn: "Test Bot Connection",
    fetchBtn: "Fetch Recent Drafts",
    testing: "Testing...",
    fetching: "Fetching Drafts...",
    botInfo: "Bot Information",
    username: "Username",
    id: "User ID",
    teams: "Active Teams",
    channelsCount: "Joined Channels",
    receivedDrafts: "Received Drafts & Mentioned Requirements",
    noDrafts: "No drafts found in joined channels. Try mentioning the bot first in Mattermost!",
    importBtn: "Import to Refiner",
    mentionBadge: "Mentioned",
    channelLabel: "Channel",
    senderLabel: "Sender",
    timeLabel: "Received",
    serverUrl: "Server URL",
    placeholderHelp: "How it works: Invite your bot to any channel in Mattermost, type your draft requirements (e.g. '@jira-bot build a new login system with email authentication'), and fetch them here instantly!",
    noTeamsJoined: "No teams joined. Please invite the bot account to a team in Mattermost UI."
  },
  fa: {
    title: "کارگاه بات مترموست (Mattermost)",
    subtitle: "بررسی وضعیت اتصال بات اختصاصی مترموست و دریافت مستقیم پیش‌نویس‌ها و نیازمندها از کانال‌های گفتگو.",
    notConfigured: "پیکربندی بات مترموست یافت نشد",
    configInstructions: "جهت فعال‌سازی دریافت مستقیم نیازمندی‌ها از مترموست، متغیرهای زیر را به فایل `.env` پروژه خود اضافه کنید:",
    copyBtn: "کپی متغیرها",
    copied: "کپی شد!",
    refreshConfig: "بروزرسانی پیکربندی",
    statusConnected: "اتصال به سرور مترموست با موفقیت برقرار شد!",
    statusError: "خطا در برقراری ارتباط با مترموست.",
    testBtn: "تست اتصال به بات",
    fetchBtn: "دریافت آخرین پیش‌نویس‌ها",
    testing: "در حال بررسی...",
    fetching: "در حال دریافت پیام‌ها...",
    botInfo: "اطلاعات بات مترموست",
    username: "نام کاربری بات",
    id: "شناسه کاربری",
    teams: "تیم‌های فعال",
    channelsCount: "کانال‌های مشترک‌شده",
    receivedDrafts: "پیش‌نویس‌ها و پیام‌های دریافتی",
    noDrafts: "هیچ پیامی در کانال‌های مشترک یافت نشد. بات را در یک کانال مترموست عضو کنید و با ذکر نام (@) پیام بفرستید!",
    importBtn: "انتقال به کارگاه هوش مصنوعی",
    mentionBadge: "منشن شده",
    channelLabel: "کانال",
    senderLabel: "فرستنده",
    timeLabel: "زمان ارسال",
    serverUrl: "آدرس سرور",
    placeholderHelp: "نحوه کارکرد: بات خود را به یک کانال در مترموست دعوت کنید، نیازمندی خود را بنویسید و آن را منشن کنید (مثال: '@jira-bot ساخت صفحه ورود با ایمیل'). سپس در این صفحه روی دکمه دریافت کلیک کنید تا متن مستقیماً وارد ویرایشگر شود!",
    noTeamsJoined: "تیمی یافت نشد. لطفاً اکانت بات را در رابط کاربری مترموست به یک تیم دعوت کنید."
  }
};

export default function MattermostIntegration({ language, onImportDraft }: MattermostIntegrationProps) {
  const t = translations[language];
  const isRtl = language === 'fa';

  const [config, setConfig] = useState<MattermostConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [fetchingDrafts, setFetchingDrafts] = useState(false);
  const [drafts, setDrafts] = useState<MattermostDraft[]>([]);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/mattermost/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to load Mattermost config", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch('/api/mattermost/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(data);
        // Automatically fetch drafts after successful test
        handleFetchDrafts();
      } else {
        setTestError(data.error || t.statusError);
      }
    } catch (err: any) {
      setTestError(err.message || t.statusError);
    } finally {
      setTesting(false);
    }
  };

  const handleFetchDrafts = async () => {
    setFetchingDrafts(true);
    setDraftsError(null);
    try {
      const res = await fetch('/api/mattermost/drafts', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setDrafts(data.drafts || []);
      } else {
        setDraftsError(data.error || "Failed to load drafts.");
      }
    } catch (err: any) {
      setDraftsError(err.message || "Failed to load drafts.");
    } finally {
      setFetchingDrafts(false);
    }
  };

  const handleCopyEnv = () => {
    const envText = `MATTERMOST_URL="https://your-mattermost-server.com"\nMATTERMOST_BOT_TOKEN="your-mm-bot-token"`;
    navigator.clipboard.writeText(envText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return "";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return isRtl ? "لحظاتی پیش" : "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return isRtl ? `${minutes} دقیقه پیش` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return isRtl ? `${hours} ساعت پیش` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return isRtl ? `${days} روز پیش` : `${days}d ago`;
  };

  if (loadingConfig) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-sans">
          {isRtl ? "در حال دریافت پیکربندی سرور..." : "Loading Mattermost server configurations..."}
        </p>
      </div>
    );
  }

  const isConfigured = config?.configured;

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500 rounded-lg text-white">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
              {t.title}
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            {t.subtitle}
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-12 translate-y-8">
          <MessageSquare className="w-64 h-64" />
        </div>
      </div>

      {!isConfigured ? (
        /* Not Configured State */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4 animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">{t.notConfigured}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t.configInstructions}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 relative group overflow-x-auto">
            <button
              type="button"
              onClick={handleCopyEnv}
              className="absolute top-3 right-3 bg-slate-800 text-slate-400 hover:text-white px-2.5 py-1 rounded text-[10px] border border-slate-700 transition cursor-pointer flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedText ? t.copied : t.copyBtn}</span>
            </button>
            <pre className="text-left select-all py-1">
{`# .env
MATTERMOST_URL="https://your-mattermost-instance.com"
MATTERMOST_BOT_TOKEN="your-bot-account-token"`}
            </pre>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3.5 rounded-lg border border-slate-150">
            <HelpCircle className="w-4.5 h-4.5 text-blue-500 shrink-0" />
            <p className="leading-relaxed">
              {t.placeholderHelp}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={loadConfig}
              className="px-4 py-2 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.refreshConfig}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Configured State */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Test & Bot Profile info */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {t.botInfo}
                </span>
                <span className={`h-2 w-2 rounded-full ${testResult ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
              </div>

              {testResult ? (
                <div className="space-y-3.5 animate-fade-in text-xs">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold">{t.statusConnected}</span>
                  </div>

                  <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                    <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{testResult.botUser.nickname || testResult.botUser.first_name || testResult.botUser.username}</p>
                      <p className="text-[10px] text-slate-400 font-mono">@{testResult.botUser.username}</p>
                    </div>
                  </div>

                  <div className="space-y-2 font-medium text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-100/60">
                      <span className="text-slate-400">{t.serverUrl}:</span>
                      <span className="font-mono text-[10px] text-slate-800 break-all text-right max-w-[180px]">{testResult.config.url}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100/60">
                      <span className="text-slate-400">{t.id}:</span>
                      <span className="font-mono text-[10px] text-slate-800">{testResult.botUser.id}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100/60">
                      <span className="text-slate-400">{t.channelsCount}:</span>
                      <span className="font-bold text-blue-600 font-mono">{testResult.channelsCount}</span>
                    </div>
                  </div>

                  {testResult.teams && testResult.teams.length > 0 ? (
                    <div className="space-y-1 pt-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.teams}:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testResult.teams.map((t: any) => (
                          <span key={t.id} className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 py-0.5 px-1.5 rounded font-bold">
                            {t.display_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-600 italic">{t.noTeamsJoined}</p>
                  )}
                </div>
              ) : testError ? (
                <div className="bg-red-50 border border-red-100 text-red-800 p-3.5 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">{t.statusError}</span>
                    <p className="mt-1 text-red-700 font-mono break-words leading-relaxed text-[11px]">{testError}</p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-6 text-center">
                  {isRtl ? "برای شروع اتصال بات را تست کنید." : "Test connection to initialize state."}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestConnection}
                  className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? t.testing : t.testBtn}</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-500 space-y-2">
              <div className="flex items-center gap-1 text-slate-700 font-bold">
                <HelpCircle className="w-4.5 h-4.5 text-blue-500" />
                <span>{isRtl ? "راهنما" : "How to mention?"}</span>
              </div>
              <p className="leading-relaxed">
                {isRtl 
                  ? "زمانی که بات را در چنل اضافه کردید، پیام‌های منشن شده را می‌خواند. مانند:"
                  : "Once added to a channel, you can draft requirements and mention the bot handle:"}
              </p>
              <div className="p-2 bg-white border border-slate-200 rounded font-mono text-[11px] text-slate-700 select-all">
                @jira-bot {isRtl ? "یک تیکت استوری برای ثبت نام کاربر اضافه کن با تایید پیامکی" : "Create a user registration story with SMS verification"}
              </div>
            </div>
          </div>

          {/* Right Column: Drafts from channels */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1.5 bg-blue-600 rounded-full"></div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {t.receivedDrafts}
                  </h4>
                </div>

                <button
                  type="button"
                  disabled={fetchingDrafts}
                  onClick={handleFetchDrafts}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingDrafts ? 'animate-spin' : ''}`} />
                  <span>{fetchingDrafts ? t.fetching : t.fetchBtn}</span>
                </button>
              </div>

              {draftsError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                  <span>{draftsError}</span>
                </div>
              )}

              {drafts.length > 0 ? (
                <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                  {drafts.map((draft) => (
                    <div 
                      key={draft.id} 
                      className={`p-4 rounded-xl border transition duration-150 flex flex-col justify-between gap-3 ${
                        draft.isMention 
                          ? 'bg-blue-50/40 border-blue-100 hover:border-blue-200' 
                          : 'bg-slate-50/40 border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                            {t.senderLabel}: {draft.senderName}
                          </span>
                          <span className="font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            {t.channelLabel}: {draft.channelName}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {formatRelativeTime(draft.createdAt)}
                          </span>
                        </div>

                        {draft.isMention && (
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {t.mentionBadge}
                          </span>
                        )}
                      </div>

                      {/* Draft content */}
                      <div className="text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap bg-white/80 border border-slate-100 p-3.5 rounded-lg select-text font-medium shadow-sm">
                        {draft.cleanedText || draft.rawText}
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => onImportDraft(draft.cleanedText || draft.rawText)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1"
                        >
                          <span>{t.importBtn}</span>
                          {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-600">{isRtl ? "هیچ پیش‌نویسی یافت نشد" : "No drafts received yet"}</p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                    {t.noDrafts}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
