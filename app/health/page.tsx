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
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
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
    statusCategoryKey?: string;
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
  const title = "سلامت جیرا";
  const subtitle = "اتصال، کاربر، پروژه و env.";

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
          {"بررسی مجدد"}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {"در حال بررسی…"}
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
                        ? "متصل به جیرا"
                        : "عدم اتصال"}
                    </CardTitle>
                    <CardDescription>
                      {data?.checkedAt
                        ? `${"بررسی"}: ${new Date(
                            data.checkedAt
                          ).toLocaleString("fa-IR")}`
                        : null}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={connected ? "success" : "destructive"}>
                  {connected
                    ? "Healthy"
                    : "Unhealthy"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {"آدرس سرور"}
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
                  {"نوع احراز هویت"}
                </p>
                <p className="font-medium uppercase">{data?.authType || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {"کلید پروژه (env)"}
                </p>
                <p className="font-mono font-medium">
                  {data?.projectKey || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {"پیکربندی env"}
                </p>
                <p className="font-medium">
                  {data?.configured
                    ? "بله"
                    : "خیر"}
                </p>
              </div>
              {data?.error ? (
                <Alert variant="destructive" className="md:col-span-2">
                  <AlertCircle />
                  <AlertTitle>
                    {"خطا"}
                  </AlertTitle>
                  <AlertDescription>{data.error}</AlertDescription>
                </Alert>
              ) : null}
              {!!data?.missing?.length && (
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {"متغیرهای ناقص"}
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
                  {"کاربر متصل"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {"نام نمایشی: "}
                  </span>
                  {data?.user?.displayName || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {"نام کاربری: "}
                  </span>
                  <span className="font-mono">{data?.user?.name || "—"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Email: </span>
                  {data?.user?.emailAddress || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {"منطقه زمانی: "}
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
                  {"پروژه و سرور"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {"پروژه: "}
                  </span>
                  {data?.project
                    ? `${data.project.name} (${data.project.key})`
                    : data?.projectKey || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {"لید پروژه: "}
                  </span>
                  {data?.project?.lead || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {"نسخه سرور: "}
                  </span>
                  {data?.serverInfo?.version || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {"نوع استقرار: "}
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
                  {`کامپوننت‌ها (${data?.counts?.components ?? data?.components?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SectionList
                  empty={"کامپوننتی یافت نشد"}
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
                  {`ورژن‌ها (${data?.counts?.versions ?? data?.versions?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SectionList empty={"ورژنی یافت نشد"}>
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
                  {`اسپرینت‌ها (${data?.counts?.sprints ?? data?.sprints?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <SectionList empty={"اسپرینتی یافت نشد"}>
                  {(data?.sprints || []).map((s) => (
                    <Badge key={s.id} variant="secondary">
                      {s.name} ({s.state})
                    </Badge>
                  ))}
                </SectionList>
                {!!data?.boards?.length && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      {"بوردها"}
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
                  {`کاربران (${data?.counts?.users ?? data?.users?.length ?? 0})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
                  {(data?.users || []).length === 0 ? (
                    <p className="italic text-muted-foreground">
                      {"کاربری یافت نشد"}
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
                {`اپیک‌ها (نمونه ${data?.epics?.length ?? 0})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.epics || []).length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  {"اپیکی یافت نشد"}
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
                          <IssueStatusBadge
                            status={epic.status}
                            statusCategoryKey={epic.statusCategoryKey}
                          />
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
                  {"هشدارها"}
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
