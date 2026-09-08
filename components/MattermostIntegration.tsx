"use client";

import { useState, useEffect } from "react";
import { Language } from "@/lib/types";
import {
  MessageSquare,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Copy,
  ArrowLeft,
  ArrowRight,
  User,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Spinner } from "@/components/ui/spinner";

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
    subtitle:
      "Test connection to your self-hosted Mattermost bot and fetch raw drafts/requirements directly from channels.",
    notConfigured: "Mattermost Bot Not Configured",
    configInstructions:
      "To enable direct drafting from Mattermost channels, please add the following environment variables to your `.env` file on your server:",
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
    noDrafts:
      "No drafts found in joined channels. Try mentioning the bot first in Mattermost!",
    importBtn: "Import to Refiner",
    mentionBadge: "Mentioned",
    channelLabel: "Channel",
    senderLabel: "Sender",
    timeLabel: "Received",
    serverUrl: "Server URL",
    placeholderHelp:
      "How it works: Invite your bot to any channel in Mattermost, type your draft requirements (e.g. '@jira-bot build a new login system with email authentication'), and fetch them here instantly!",
    noTeamsJoined:
      "No teams joined. Please invite the bot account to a team in Mattermost UI.",
  },
  fa: {
    title: "کارگاه بات مترموست (Mattermost)",
    subtitle:
      "بررسی وضعیت اتصال بات اختصاصی مترموست و دریافت مستقیم پیش‌نویس‌ها و نیازمندها از کانال‌های گفتگو.",
    notConfigured: "پیکربندی بات مترموست یافت نشد",
    configInstructions:
      "جهت فعال‌سازی دریافت مستقیم نیازمندی‌ها از مترموست، متغیرهای زیر را به فایل `.env` پروژه خود اضافه کنید:",
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
    noDrafts:
      "هیچ پیامی در کانال‌های مشترک یافت نشد. بات را در یک کانال مترموست عضو کنید و با ذکر نام (@) پیام بفرستید!",
    importBtn: "انتقال به کارگاه هوش مصنوعی",
    mentionBadge: "منشن شده",
    channelLabel: "کانال",
    senderLabel: "فرستنده",
    timeLabel: "زمان ارسال",
    serverUrl: "آدرس سرور",
    placeholderHelp:
      "نحوه کارکرد: بات خود را به یک کانال در مترموست دعوت کنید، نیازمندی خود را بنویسید و آن را منشن کنید (مثال: '@jira-bot ساخت صفحه ورود با ایمیل'). سپس در این صفحه روی دکمه دریافت کلیک کنید تا متن مستقیماً وارد ویرایشگر شود!",
    noTeamsJoined:
      "تیمی یافت نشد. لطفاً اکانت بات را در رابط کاربری مترموست به یک تیم دعوت کنید.",
  },
};

export default function MattermostIntegration({
  language,
  onImportDraft,
}: MattermostIntegrationProps) {
  const t = translations[language];
  const isRtl = language === "fa";

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
      const res = await fetch("/api/mattermost/config");
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
      const res = await fetch("/api/mattermost/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(data);
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
      const res = await fetch("/api/mattermost/drafts", { method: "POST" });
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
    if (minutes < 60)
      return isRtl ? `${minutes} دقیقه پیش` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return isRtl ? `${hours} ساعت پیش` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return isRtl ? `${days} روز پیش` : `${days}d ago`;
  };

  if (loadingConfig) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            {isRtl
              ? "در حال دریافت پیکربندی سرور..."
              : "Loading Mattermost server configurations..."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isConfigured = config?.configured;

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-primary text-primary-foreground ring-primary">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/15 text-primary-foreground">
            <MessageSquare className="size-5" />
          </div>
          <CardTitle className="text-primary-foreground">{t.title}</CardTitle>
          <CardDescription className="max-w-3xl text-primary-foreground/70">
            {t.subtitle}
          </CardDescription>
        </CardHeader>
      </Card>

      {!isConfigured ? (
        <Card>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-lg bg-warning/20 text-warning-foreground">
              <AlertCircle className="size-5" />
            </div>
            <CardTitle>{t.notConfigured}</CardTitle>
            <CardDescription>{t.configInstructions}</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="relative overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs text-muted-foreground">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleCopyEnv}
                className="absolute top-3 end-3"
              >
                <Copy data-icon="inline-start" />
                {copiedText ? t.copied : t.copyBtn}
              </Button>
              <pre className="select-all py-1 text-start">
                {`# .env
MATTERMOST_URL="https://your-mattermost-instance.com"
MATTERMOST_BOT_TOKEN="your-bot-account-token"`}
              </pre>
            </div>

            <Alert>
              <HelpCircle />
              <AlertDescription>{t.placeholderHelp}</AlertDescription>
            </Alert>
          </CardContent>

          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadConfig}
            >
              <RefreshCw data-icon="inline-start" />
              {t.refreshConfig}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-xs tracking-wider text-muted-foreground uppercase">
                  {t.botInfo}
                </CardTitle>
                <CardAction>
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full",
                      testResult
                        ? "animate-pulse bg-success"
                        : "bg-muted-foreground/40"
                    )}
                  />
                </CardAction>
              </CardHeader>

              <CardContent className="flex flex-col gap-3.5 pt-(--card-spacing)">
                {testResult ? (
                  <div className="flex flex-col gap-3.5 text-xs">
                    <Alert>
                      <CheckCircle />
                      <AlertTitle>{t.statusConnected}</AlertTitle>
                    </Alert>

                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2">
                      <Avatar size="lg">
                        <AvatarFallback>
                          <User />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-foreground">
                          {testResult.botUser.nickname ||
                            testResult.botUser.first_name ||
                            testResult.botUser.username}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          @{testResult.botUser.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 font-medium text-muted-foreground">
                      <div className="flex justify-between border-b border-border/60 py-1">
                        <span className="text-muted-foreground">
                          {t.serverUrl}:
                        </span>
                        <span className="max-w-[180px] break-all text-end font-mono text-[10px] text-foreground">
                          {testResult.config.url}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/60 py-1">
                        <span className="text-muted-foreground">{t.id}:</span>
                        <span className="font-mono text-[10px] text-foreground">
                          {testResult.botUser.id}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/60 py-1">
                        <span className="text-muted-foreground">
                          {t.channelsCount}:
                        </span>
                        <span className="font-mono font-bold text-primary">
                          {testResult.channelsCount}
                        </span>
                      </div>
                    </div>

                    {testResult.teams && testResult.teams.length > 0 ? (
                      <div className="flex flex-col gap-1 pt-1.5">
                        <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          {t.teams}:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {testResult.teams.map((team: any) => (
                            <Badge key={team.id} variant="secondary">
                              {team.display_name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-warning-foreground italic">
                        {t.noTeamsJoined}
                      </p>
                    )}
                  </div>
                ) : testError ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>{t.statusError}</AlertTitle>
                    <AlertDescription className="font-mono break-words">
                      {testError}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground italic">
                    {isRtl
                      ? "برای شروع اتصال بات را تست کنید."
                      : "Test connection to initialize state."}
                  </p>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  type="button"
                  className="w-full"
                  disabled={testing}
                  onClick={handleTestConnection}
                >
                  {testing ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  {testing ? t.testing : t.testBtn}
                </Button>
              </CardFooter>
            </Card>

            <Card size="sm" className="bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-1 text-sm">
                  <HelpCircle className="size-4 text-primary" />
                  {isRtl ? "راهنما" : "How to mention?"}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? "زمانی که بات را در چنل اضافه کردید، پیام‌های منشن شده را می‌خواند. مانند:"
                    : "Once added to a channel, you can draft requirements and mention the bot handle:"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="select-all rounded-md border bg-card p-2 font-mono text-[11px] text-foreground">
                  @jira-bot{" "}
                  {isRtl
                    ? "یک تیکت استوری برای ثبت نام کاربر اضافه کن با تایید پیامکی"
                    : "Create a user registration story with SMS verification"}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-8">
            <Card>
              <CardHeader className="border-b">
                <div className="h-6 w-1.5 rounded-full bg-primary" />
                <CardTitle>{t.receivedDrafts}</CardTitle>
                <CardAction>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={fetchingDrafts}
                    onClick={handleFetchDrafts}
                  >
                    {fetchingDrafts ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RefreshCw data-icon="inline-start" />
                    )}
                    {fetchingDrafts ? t.fetching : t.fetchBtn}
                  </Button>
                </CardAction>
              </CardHeader>

              <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
                {draftsError && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{draftsError}</AlertDescription>
                  </Alert>
                )}

                {drafts.length > 0 ? (
                  <div className="flex max-h-[580px] flex-col gap-4 overflow-y-auto pe-1">
                    {drafts.map((draft) => (
                      <Card
                        key={draft.id}
                        size="sm"
                        className={cn(
                          draft.isMention
                            ? "bg-primary/5 ring-primary/20"
                            : "bg-muted/30"
                        )}
                      >
                        <CardHeader>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <Badge variant="outline">
                              {t.senderLabel}: {draft.senderName}
                            </Badge>
                            <Badge variant="secondary">
                              {t.channelLabel}: {draft.channelName}
                            </Badge>
                            <span className="font-mono text-muted-foreground">
                              {formatRelativeTime(draft.createdAt)}
                            </span>
                          </div>
                          {draft.isMention && (
                            <CardAction>
                              <Badge variant="default" className="uppercase">
                                {t.mentionBadge}
                              </Badge>
                            </CardAction>
                          )}
                        </CardHeader>

                        <CardContent>
                          <div className="select-text rounded-lg border bg-card p-3.5 text-xs leading-relaxed font-medium whitespace-pre-wrap text-foreground">
                            {draft.cleanedText || draft.rawText}
                          </div>
                        </CardContent>

                        <CardFooter className="justify-end">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              onImportDraft(
                                draft.cleanedText || draft.rawText
                              )
                            }
                          >
                            {t.importBtn}
                            {isRtl ? (
                              <ArrowLeft data-icon="inline-end" />
                            ) : (
                              <ArrowRight data-icon="inline-end" />
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Empty className="border border-dashed bg-muted/50">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageSquare />
                      </EmptyMedia>
                      <EmptyTitle>
                        {isRtl
                          ? "هیچ پیش‌نویسی یافت نشد"
                          : "No drafts received yet"}
                      </EmptyTitle>
                      <EmptyDescription>{t.noDrafts}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
