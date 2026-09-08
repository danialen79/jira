"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Download,
  HelpCircle,
  Server,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  ConnectionConfig,
  JiraCredentials,
  JiraProject,
  Language,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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
    subtitle:
      "Configure your self-hosted Jira integration securely. All credentials are saved strictly in your local browser storage.",
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
    advancedHelp:
      "Jira Server/Data Center uses custom fields for Epic Names and Epic Links. Change these if yours are different from standard defaults.",
    saveSuccess: "Saved securely to local browser storage!",
    failedToConnect: "Connection failed",
    selectProject: "Fetch & Select Projects",
    projectsFetched: "Successfully fetched projects",
    placeholderProject: "Select a fetched project",
    fieldExplain:
      "Standard Epic Name field is customfield_10008, Epic Link is customfield_10014, Sprint is customfield_10010.",
    urlHelp:
      "Provide the absolute URL to your company's self-hosted Jira dashboard.",
    sprintField: "Sprint Custom Field ID",
    export: "Export JSON",
    import: "Import JSON",
    importSuccess: "Settings imported successfully!",
    importError: "Failed to parse settings JSON.",
  },
  fa: {
    title: "اتصال به سرور جیرا",
    subtitle:
      "تنظیمات اتصال به جیرا سلف‌هاست خود را به صورت امن پیکربندی کنید. مشخصات شما به صورت کاملاً محلی در مرورگر ذخیره می‌شود.",
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
    advancedHelp:
      "سرور جیرا (Data Center / Server) برای نام اپیک و پیوند اپیک از فیلدهای سفارشی استفاده می‌کند. در صورت تفاوت با مقادیر پیش‌فرض آن‌ها را تغییر دهید.",
    saveSuccess: "اطلاعات با موفقیت در حافظه مرورگر شما ذخیره شد!",
    failedToConnect: "خطا در تست اتصال",
    selectProject: "دریافت پروژه‌ها از سرور",
    projectsFetched: "لیست پروژه‌ها با موفقیت دریافت شد",
    placeholderProject: "انتخاب از پروژه‌های دریافت شده",
    fieldExplain:
      "فیلد پیش‌فرض نام اپیک customfield_10008، لینک اپیک customfield_15000/customfield_10014 و اسپرینت customfield_10010 است.",
    urlHelp: "آدرس کامل دسترسی به پنل جیرای شرکت خود را وارد نمایید.",
    sprintField: "شناسه فیلد سفارشی اسپرینت (Sprint Custom Field ID)",
    export: "خروجی تنظیمات",
    import: "ورود فایل تنظیمات",
    importSuccess: "تنظیمات اتصال با موفقیت وارد شد!",
    importError: "خطا در خواندن فایل پیکربندی JSON.",
  },
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
  onAvailableProjectsChange,
}: JiraConfigProps) {
  const t = translations[language];
  const isRtl = language === "fa";

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    user?: unknown;
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fetchingProjects, setFetchingProjects] = useState(false);

  const saveToLocalStorage = () => {
    localStorage.setItem("jira_creds", JSON.stringify(credentials));
    localStorage.setItem("jira_project_key", projectKey);
    localStorage.setItem("jira_config", JSON.stringify(config));
  };

  useEffect(() => {
    saveToLocalStorage();
  }, [credentials, projectKey, config]);

  const fetchProjects = async () => {
    if (!credentials.url) return;
    setFetchingProjects(true);
    try {
      const response = await fetch("/api/jira/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
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

  const testConnection = async () => {
    if (!credentials.url) {
      setTestResult({
        success: false,
        message: isRtl
          ? "لطفاً آدرس جیرا را وارد کنید."
          : "Please provide a Jira Server URL.",
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    onConnectionStatusChange(false);

    try {
      const response = await fetch("/api/jira/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: `${t.connectedAs} ${data.user.displayName} (${data.user.emailAddress || data.user.name})`,
          user: data.user,
        });
        onConnectionStatusChange(true);
        void fetchProjects();
      } else {
        setTestResult({
          success: false,
          message:
            data.error ||
            (isRtl
              ? "نام کاربری یا رمز عبور اشتباه است."
              : "Invalid credentials or URL."),
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message:
          err instanceof Error ? err.message : "Failed to make request",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleExport = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(
        JSON.stringify({ credentials, projectKey, config }, null, 2)
      );
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `jira-ai-connection-${projectKey || "config"}.json`
    );
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
        if (parsed.projectKey) onProjectKeyChange(parsed.projectKey || "");
        if (parsed.config) onConfigChange(parsed.config);

        setTestResult({
          success: true,
          message: t.importSuccess,
        });
      } catch {
        setTestResult({
          success: false,
          message: t.importError,
        });
      }
    };
    fileReader.readAsText(file);
  };

  const projectPlaceholder =
    availableProjects.length > 0
      ? `-- ${t.placeholderProject} --`
      : `-- ${isRtl ? "اتصال را بررسی کنید" : "Test connection to load"} --`;

  return (
    <Card id="jira-config-panel">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2 text-foreground">
            <Server className="size-5" />
          </div>
          {t.title}
        </CardTitle>
        <CardDescription>{t.subtitle}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 border-e border-border/60 pe-3">
              <label
                className={cn(
                  buttonVariants({ variant: "ghost", size: "xs" }),
                  "cursor-pointer"
                )}
                title={t.import}
              >
                <Upload data-icon="inline-start" />
                <span className="hidden sm:inline">{t.import}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleExport}
                title={t.export}
              >
                <Download data-icon="inline-start" />
                <span className="hidden sm:inline">{t.export}</span>
              </Button>
            </div>
            <Badge variant={testResult?.success ? "success" : "warning"}>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  testResult?.success ? "bg-success" : "bg-warning"
                )}
              />
              {testResult?.success ? "Active" : "Setup"}
            </Badge>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-6">
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="jira-url" className="gap-1.5">
              {t.jiraUrl}
              <span title={t.urlHelp}>
                <HelpCircle className="size-3.5 text-muted-foreground" />
              </span>
            </FieldLabel>
            <Input
              id="jira-url"
              type="text"
              className="font-mono"
              placeholder={t.jiraUrlPlaceholder}
              value={credentials.url}
              onChange={(e) =>
                onCredentialsChange({ ...credentials, url: e.target.value })
              }
              dir="ltr"
            />
          </Field>

          <Field>
            <FieldLabel>{t.authType}</FieldLabel>
            <ToggleGroup
              value={[credentials.authType]}
              onValueChange={(values) => {
                const next = values[0] as "pat" | "basic" | undefined;
                if (!next) return;
                onCredentialsChange({ ...credentials, authType: next });
              }}
              variant="outline"
              className="grid w-full grid-cols-2"
            >
              <ToggleGroupItem value="pat" className="text-xs">
                {t.pat}
              </ToggleGroupItem>
              <ToggleGroupItem value="basic" className="text-xs">
                {t.basic}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          {credentials.authType === "pat" ? (
            <Field>
              <FieldLabel htmlFor="jira-token">{t.token}</FieldLabel>
              <Input
                id="jira-token"
                type="password"
                className="font-mono"
                placeholder="••••••••••••••••••••••••"
                value={credentials.token || ""}
                onChange={(e) =>
                  onCredentialsChange({
                    ...credentials,
                    token: e.target.value,
                  })
                }
                dir="ltr"
              />
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="jira-username">{t.username}</FieldLabel>
                <Input
                  id="jira-username"
                  type="text"
                  className="font-mono"
                  placeholder="danial.enayati"
                  value={credentials.username || ""}
                  onChange={(e) =>
                    onCredentialsChange({
                      ...credentials,
                      username: e.target.value,
                    })
                  }
                  dir="ltr"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="jira-password">{t.password}</FieldLabel>
                <Input
                  id="jira-password"
                  type="password"
                  className="font-mono"
                  placeholder="••••••••••••"
                  value={credentials.password || ""}
                  onChange={(e) =>
                    onCredentialsChange({
                      ...credentials,
                      password: e.target.value,
                    })
                  }
                  dir="ltr"
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="jira-project-key">{t.projectKey}</FieldLabel>
              <Input
                id="jira-project-key"
                type="text"
                className="font-mono"
                placeholder={t.projectKeyPlaceholder}
                value={projectKey}
                onChange={(e) =>
                  onProjectKeyChange(e.target.value.toUpperCase())
                }
                dir="ltr"
              />
            </Field>
            <Field>
              <FieldLabel>
                {isRtl ? "پروژه‌های دریافت شده" : "Fetched Jira Projects"}
              </FieldLabel>
              <SearchableSelect
                disabled={availableProjects.length === 0 || fetchingProjects}
                options={[
                  {
                    value: "",
                    label: projectPlaceholder,
                  },
                  ...availableProjects.map((proj) => ({
                    value: proj.key,
                    label: `${proj.key} - ${proj.name}`,
                  })),
                ]}
                value={
                  availableProjects.some((p) => p.key === projectKey)
                    ? projectKey
                    : ""
                }
                onChange={(val) => onProjectKeyChange(val)}
                showSearch
                isRtl={isRtl}
                placeholder={projectPlaceholder}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit text-muted-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings
                data-icon="inline-start"
                className={cn(
                  "transition duration-200",
                  showAdvanced && "rotate-45"
                )}
              />
              {t.advanced}
            </Button>

            {showAdvanced ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    {t.advancedHelp}
                    <br />
                    <span className="mt-1 block font-mono font-medium">
                      {t.fieldExplain}
                    </span>
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field>
                    <FieldLabel
                      htmlFor="epic-name-field"
                      className="font-mono text-[10px] uppercase tracking-wider"
                    >
                      Epic Name Field (e.g. customfield_10008)
                    </FieldLabel>
                    <Input
                      id="epic-name-field"
                      type="text"
                      className="font-mono text-xs"
                      value={config.epicNameField}
                      onChange={(e) =>
                        onConfigChange({
                          ...config,
                          epicNameField: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel
                      htmlFor="epic-link-field"
                      className="font-mono text-[10px] uppercase tracking-wider"
                    >
                      Epic Link Field (e.g. customfield_10014)
                    </FieldLabel>
                    <Input
                      id="epic-link-field"
                      type="text"
                      className="font-mono text-xs"
                      value={config.epicLinkField}
                      onChange={(e) =>
                        onConfigChange({
                          ...config,
                          epicLinkField: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel
                      htmlFor="sprint-field"
                      className="font-mono text-[10px] uppercase tracking-wider"
                    >
                      {language === "fa"
                        ? "شناسه فیلد اسپرینت"
                        : "Sprint Field (e.g. customfield_10010)"}
                    </FieldLabel>
                    <Input
                      id="sprint-field"
                      type="text"
                      className="font-mono text-xs"
                      value={config.sprintFieldId || ""}
                      placeholder="customfield_10010"
                      onChange={(e) =>
                        onConfigChange({
                          ...config,
                          sprintFieldId: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              {testResult ? (
                <Alert
                  variant={testResult.success ? "default" : "destructive"}
                  className={cn(
                    testResult.success &&
                      "border-success/30 bg-success/10 text-success"
                  )}
                >
                  {testResult.success ? (
                    <ShieldCheck />
                  ) : (
                    <AlertCircle />
                  )}
                  <AlertTitle>
                    {testResult.success
                      ? isRtl
                        ? "موفق"
                        : "Success"
                      : t.failedToConnect}
                  </AlertTitle>
                  <AlertDescription
                    className={cn(testResult.success && "text-success")}
                  >
                    {testResult.message}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <Button
              type="button"
              disabled={testing}
              onClick={() => void testConnection()}
            >
              {testing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Server data-icon="inline-start" />
              )}
              {testing ? t.testing : t.testConnection}
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
