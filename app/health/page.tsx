"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Layers,
  RefreshCw,
  Server,
  Tag,
  Users,
} from "lucide-react";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type HealthPayload = {
  success?: boolean;
  connected?: boolean;
  configured?: boolean;
  checkedAt?: string;
  url?: string;
  projectKey?: string;
  authType?: string;
  config?: {
    epicNameField?: string;
    epicLinkField?: string;
    sprintFieldId?: string;
  };
  error?: string;
  missing?: string[];
  warnings?: string[];
  user?: {
    name?: string;
    displayName?: string;
    emailAddress?: string;
    active?: boolean;
    timeZone?: string;
    locale?: string;
    groups?: string[];
  };
  project?: {
    id?: string;
    key?: string;
    name?: string;
    projectTypeKey?: string;
    lead?: string;
    description?: string;
  } | null;
  components?: Array<{ id: string; name: string; description?: string }>;
  versions?: Array<{
    id: string;
    name: string;
    released?: boolean;
    archived?: boolean;
    releaseDate?: string;
  }>;
  sprints?: Array<{
    id: number;
    name: string;
    state: string;
    boardName?: string;
  }>;
  boards?: Array<{ id: number; name: string; type: string }>;
  users?: Array<{
    name: string;
    displayName: string;
    emailAddress?: string;
    active?: boolean;
  }>;
  epics?: Array<{
    key: string;
    summary: string;
    status?: string;
    components?: string[];
  }>;
  statuses?: Array<{ id: string; name: string; category?: string }>;
  serverInfo?: {
    version?: string;
    deploymentType?: string;
    serverTitle?: string;
    baseUrl?: string;
  } | null;
  counts?: Record<string, number>;
};

function SectionList({
  empty,
  children,
}: {
  empty: string;
  children: React.ReactNode;
}) {
  if (!children || (Array.isArray(children) && children.length === 0)) {
    return <p className="text-sm italic text-muted-foreground">{empty}</p>;
  }
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export default function HealthPage() {
  const { isRtl, refreshConnection } = useJiraApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HealthPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jira/health");
      const json = (await res.json()) as HealthPayload;
      setData(json);
      void refreshConnection();
    } catch (err: unknown) {
      setData({
        success: false,
        connected: false,
        error: err instanceof Error ? err.message : "Healthcheck failed",
      });
    } finally {
      setLoading(false);
    }
  }, [refreshConnection]);

  useEffect(() => {
    void load();
  }, [load]);

  const connected = !!data?.connected;
  const title = isRtl ? "سلامت جیرا" : "Jira health";
  const subtitle = isRtl
    ? "اتصال، کاربر، پروژه و env."
    : "Connection, user, project, and env.";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          {isRtl ? "بررسی مجدد" : "Refresh"}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {isRtl ? "در حال بررسی…" : "Checking…"}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {connected ? (
                    <CheckCircle2 className="size-5 text-success" />
                  ) : (
                    <AlertCircle className="size-5 text-destructive" />
                  )}
                  <div>
                    <CardTitle>
                      {connected
                        ? isRtl
                          ? "متصل به جیرا"
                          : "Connected to Jira"
                        : isRtl
                          ? "عدم اتصال"
                          : "Not connected"}
                    </CardTitle>
                    <CardDescription>
                      {data?.checkedAt
                        ? `${isRtl ? "بررسی" : "Checked"}: ${new Date(
                            data.checkedAt
                          ).toLocaleString(isRtl ? "fa-IR" : "en-US")}`
                        : null}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={connected ? "success" : "destructive"}>
                  {connected
                    ? isRtl
                      ? "Healthy"
                      : "Healthy"
                    : isRtl
                      ? "Unhealthy"
                      : "Unhealthy"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? "آدرس سرور" : "Server URL"}
                </p>
                {data?.url ? (
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    {data.url}
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  <p className="italic text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? "نوع احراز هویت" : "Auth type"}
                </p>
                <p className="font-medium uppercase">{data?.authType || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? "کلید پروژه (env)" : "Project key (env)"}
                </p>
                <p className="font-mono font-medium">
                  {data?.projectKey || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? "پیکربندی env" : "Env configured"}
                </p>
                <p className="font-medium">
                  {data?.configured
                    ? isRtl
                      ? "بله"
                      : "Yes"
                    : isRtl
                      ? "خیر"
                      : "No"}
                </p>
              </div>
              {data?.error ? (
                <Alert variant="destructive" className="md:col-span-2">
                  <AlertCircle />
                  <AlertTitle>
                    {isRtl ? "خطا" : "Error"}
                  </AlertTitle>
                  <AlertDescription>{data.error}</AlertDescription>
                </Alert>
              ) : null}
              {!!data?.missing?.length && (
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {isRtl ? "متغیرهای ناقص" : "Missing env vars"}
                  </p>
                  <SectionList empty="">
                    {data.missing.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </SectionList>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4" />
                  {isRtl ? "کاربر متصل" : "Connected user"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {isRtl ? "نام نمایشی: " : "Display name: "}
                  </span>
                  {data?.user?.displayName || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {isRtl ? "نام کاربری: " : "Username: "}
                  </span>
                  <span className="font-mono">{data?.user?.name || "—"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Email: </span>
                  {data?.user?.emailAddress || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {isRtl ? "منطقه زمانی: " : "Timezone: "}
                  </span>
                  {data?.user?.timeZone || "—"}
                </p>
                {!!data?.user?.groups?.length && (
                  <SectionList empty="">
                    {data.user.groups.map((g) => (
                      <Badge key={g} variant="secondary">
                        {g}
                      </Badge>
                    ))}
                  </SectionList>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="size-4" />
                  {isRtl ? "پروژه و سرور" : "Project & server"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {isRtl ? "پروژه: " : "Project: "}
                  </span>
                  {data?.project
                    ? `${data.project.name} (${data.project.key})`
                    : data?.projectKey || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {isRtl ? "لید پروژه: " : "Lead: "}
                  </span>
                  {data?.project?.lead || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {isRtl ? "نسخه سرور: " : "Server version: "}
                  </span>
                  {data?.serverInfo?.version || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {isRtl ? "نوع استقرار: " : "Deployment: "}
                  </span>
                  {data?.serverInfo?.deploymentType ||
                    data?.serverInfo?.serverTitle ||
                    "—"}
                </p>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Epic Name: {data?.config?.epicNameField || "—"} · Epic Link:{" "}
                  {data?.config?.epicLinkField || "—"} · Sprint:{" "}
                  {data?.config?.sprintFieldId || "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="size-4" />
                  {isRtl
                    ? `کامپوننت‌ها (${data?.counts?.components ?? data?.components?.length ?? 0})`
                    : `Components (${data?.counts?.components ?? data?.components?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SectionList
                  empty={isRtl ? "کامپوننتی یافت نشد" : "No components"}
                >
                  {(data?.components || []).map((c) => (
                    <Badge key={c.id} variant="secondary">
                      {c.name}
                    </Badge>
                  ))}
                </SectionList>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="size-4" />
                  {isRtl
                    ? `ورژن‌ها (${data?.counts?.versions ?? data?.versions?.length ?? 0})`
                    : `Versions (${data?.counts?.versions ?? data?.versions?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SectionList empty={isRtl ? "ورژنی یافت نشد" : "No versions"}>
                  {(data?.versions || []).map((v) => (
                    <Badge
                      key={v.id}
                      variant={v.released ? "success" : "outline"}
                    >
                      {v.name}
                      {v.released ? " ✓" : ""}
                    </Badge>
                  ))}
                </SectionList>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4" />
                  {isRtl
                    ? `اسپرینت‌ها (${data?.counts?.sprints ?? data?.sprints?.length ?? 0})`
                    : `Sprints (${data?.counts?.sprints ?? data?.sprints?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <SectionList empty={isRtl ? "اسپرینتی یافت نشد" : "No sprints"}>
                  {(data?.sprints || []).map((s) => (
                    <Badge key={s.id} variant="secondary">
                      {s.name} ({s.state})
                    </Badge>
                  ))}
                </SectionList>
                {!!data?.boards?.length && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      {isRtl ? "بوردها" : "Boards"}
                    </p>
                    <SectionList empty="">
                      {data.boards.map((b) => (
                        <Badge key={b.id} variant="outline">
                          {b.name} · {b.type}
                        </Badge>
                      ))}
                    </SectionList>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4" />
                  {isRtl
                    ? `کاربران (${data?.counts?.users ?? data?.users?.length ?? 0})`
                    : `Users (${data?.counts?.users ?? data?.users?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                  {(data?.users || []).length === 0 ? (
                    <p className="italic text-muted-foreground">
                      {isRtl ? "کاربری یافت نشد" : "No users"}
                    </p>
                  ) : (
                    (data?.users || []).map((u) => (
                      <div
                        key={u.name}
                        className="flex items-center justify-between gap-2 border-b border-border/50 py-1 last:border-0"
                      >
                        <span>{u.displayName}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {u.name}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isRtl
                  ? `اپیک‌ها (نمونه ${data?.epics?.length ?? 0})`
                  : `Epics (sample ${data?.epics?.length ?? 0})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.epics || []).length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  {isRtl ? "اپیکی یافت نشد" : "No epics found"}
                </p>
              ) : (
                <div className="flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
                  {(data?.epics || []).map((epic) => (
                    <div
                      key={epic.key}
                      className="flex flex-col gap-1 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span className="font-mono text-xs">{epic.key}</span>
                        <p className="font-medium">{epic.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {epic.status ? (
                          <Badge variant="outline">{epic.status}</Badge>
                        ) : null}
                        {(epic.components || []).map((c) => (
                          <Badge key={`${epic.key}-${c}`} variant="secondary">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {!!data?.warnings?.length && (
            <Alert
              className={cn(
                "border-warning/40 bg-warning/10 text-warning-foreground"
              )}
            >
              <AlertCircle />
              <AlertTitle className="flex items-center gap-2">
                <Badge variant="warning">
                  {isRtl ? "هشدارها" : "Warnings"}
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-warning-foreground">
                <ul className="flex list-disc flex-col gap-1 ps-4">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
