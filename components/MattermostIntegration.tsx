"use client";

import { useState, useEffect } from "react";

import {
  MessageSquare,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Copy,
  ArrowLeft,
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
    title: "مترموست",
    subtitle: "اتصال بات را بسنجید و پیش‌نویس کانال‌ها را بگیرید.",
    notConfigured: "بات پیکربندی نشده",
    configInstructions: "این متغیرها را به .env سرور اضافه کنید:",
    copyBtn: "کپی",
    copied: "کپی شد",
    refreshConfig: "بروزرسانی پیکربندی",
    statusConnected: "به مترموست متصل شد.",
    statusError: "اتصال مترموست ناموفق بود.",
    testBtn: "تست اتصال",
    fetchBtn: "دریافت پیش‌نویس‌ها",
    testing: "در حال تست…",
    fetching: "در حال دریافت…",
    botInfo: "اطلاعات بات",
    username: "نام کاربری",
    id: "شناسه",
    teams: "تیم‌ها",
    channelsCount: "کانال‌ها",
    receivedDrafts: "پیش‌نویس‌ها",
    noDrafts: "پیش‌نویسی نیست. بات را منشن کنید، سپس دریافت کنید.",
    importBtn: "انتقال به کارگاه",
    mentionBadge: "منشن",
    channelLabel: "کانال",
    senderLabel: "فرستنده",
    timeLabel: "زمان",
    serverUrl: "آدرس سرور",
    placeholderHelp: "بات را دعوت کنید، پیش‌نویس را منشن کنید، اینجا دریافت کنید.",
    noTeamsJoined: "تیمی نیست. بات را در مترموست به یک تیم دعوت کنید.",
    loadingConfig: "بارگذاری پیکربندی…",
    testHint: "قبل از دریافت پیش‌نویس، اتصال را تست کنید.",
    noDraftsTitle: "بدون پیش‌نویس",
  };

export default function MattermostIntegration({
  onImportDraft,
}: MattermostIntegrationProps) {
  const t = translations;  const [config, setConfig] = useState<MattermostConfig | null>(null);
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
    if (seconds < 60) return "لحظاتی پیش";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
      return `${minutes} دقیقه پیش`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ساعت پیش`;
    const days = Math.floor(hours / 24);
    return `${days} روز پیش`;
  };

  if (loadingConfig) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">{t.loadingConfig}</p>
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
                    {t.testHint}
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
                  {"راهنما"}
                </CardTitle>
                <CardDescription>
                  {"زمانی که بات را در چنل اضافه کردید، پیام‌های منشن شده را می‌خواند. مانند:"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="select-all rounded-md border bg-card p-2 font-mono text-[11px] text-foreground">
                  @jira-bot{" "}
                  {"یک تیکت استوری برای ثبت نام کاربر اضافه کن با تایید پیامکی"}
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
                          "cv-auto",
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
                            <ArrowLeft data-icon="inline-end" />
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
                      <EmptyTitle>{t.noDraftsTitle}</EmptyTitle>
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
