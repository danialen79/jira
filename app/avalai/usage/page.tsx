"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Settings2, Wallet } from "lucide-react";
import { toast } from "sonner";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type {
  AvalaiCredit,
  AvalaiTransactionsResponse,
  AvalaiUsageSummary,
} from "@/lib/avalai/user-api";

type UsagePayload = {
  credit: AvalaiCredit;
  summary: AvalaiUsageSummary;
  transactions: AvalaiTransactionsResponse;
  meta: {
    summaryHours: number;
    txHours: number;
    pageSize: number;
    groupBy: string;
  };
};

function formatIrt(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatUnit(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(n);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default function AvalaiUsagePage() {
  const [hours, setHours] = useState("24");
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = Number.parseInt(hours, 10) || 24;
      const res = await fetch(
        `/api/avalai/usage?summaryHours=${h}&txHours=${h}&pageSize=40&groupBy=model`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "بارگذاری ناموفق");
      setData(json as UsagePayload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطا در بارگذاری";
      setError(msg);
      setData(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    void load();
  }, [load]);

  const credit = data?.credit;
  const summary = data?.summary;
  const txs = data?.transactions?.transactions || [];
  const byModel = summary?.by_model || [];
  const packages = credit?.credit_sources?.packages || [];
  const grants = credit?.credit_sources?.grants || [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight">
              مصرف AvalAI
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            موجودی اعتبار، خلاصه مصرف و آخرین تراکنش‌ها از User API.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[hours]}
            onValueChange={(values) => {
              if (!values.length) return;
              setHours(values[0]);
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="6">۶س</ToggleGroupItem>
            <ToggleGroupItem value="12">۱۲س</ToggleGroupItem>
            <ToggleGroupItem value="24">۲۴س</ToggleGroupItem>
          </ToggleGroup>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            بروزرسانی
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/settings" />}
          >
            <Settings2 data-icon="inline-start" />
            تنظیمات
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              render={<Link href="/settings" />}
            >
              رفتن به Settings
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !data ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>مانده اعتبار</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatIrt(credit?.remaining_irt)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ریال
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {credit?.account_tier != null ? (
                  <Badge variant="secondary">سطح {credit.account_tier}</Badge>
                ) : null}
                {credit?.exchange_rate != null ? (
                  <Badge variant="outline">
                    نرخ {formatIrt(credit.exchange_rate)}
                  </Badge>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>هزینه بازه ({hours}س)</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatIrt(summary?.totals?.cost?.paid_irt)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ریال
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {formatUnit(summary?.totals?.cost?.unit)} USD · گرنت{" "}
                {formatIrt(summary?.totals?.cost?.paid_grant_irt)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>درخواست‌ها / توکن</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatIrt(summary?.totals?.transactions ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {formatIrt(summary?.totals?.tokens?.total ?? 0)} توکن
                {summary?.period?.start ? (
                  <span className="mt-1 block text-xs">
                    {formatDate(summary.period.start)} —{" "}
                    {formatDate(summary.period.end)}
                  </span>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {(packages.length > 0 || grants.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">بسته‌ها و گرنت‌ها</CardTitle>
                <CardDescription>
                  منابع اعتبار فعال روی حساب AvalAI
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {[...packages, ...grants].map((pkg, i) => (
                  <div
                    key={pkg.id || `${pkg.name}-${i}`}
                    className="flex flex-col gap-1 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {pkg.name || pkg.id || "بسته"}
                      </span>
                      <Badge variant="secondary">
                        {formatIrt(pkg.remaining_irt)} /{" "}
                        {formatIrt(pkg.amount_irt)} ریال
                      </Badge>
                    </div>
                    {pkg.description ? (
                      <p className="text-sm text-muted-foreground">
                        {pkg.description}
                      </p>
                    ) : null}
                    {pkg.end_date ? (
                      <p className="text-xs text-muted-foreground">
                        تا {formatDate(pkg.end_date)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">مصرف بر اساس مدل</CardTitle>
              <CardDescription>
                خلاصه {hours} ساعت اخیر (حداکثر ۲۴س در API خلاصه)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {byModel.length === 0 ? (
                <Empty className="border border-dashed py-8">
                  <EmptyHeader>
                    <EmptyTitle>مصرفی ثبت نشده</EmptyTitle>
                    <EmptyDescription>
                      در این بازه تراکنشی برای این کلید نیست.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>مدل</TableHead>
                      <TableHead className="text-end">درخواست</TableHead>
                      <TableHead className="text-end">توکن</TableHead>
                      <TableHead className="text-end">هزینه (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byModel.map((row) => (
                      <TableRow key={row.model || JSON.stringify(row)}>
                        <TableCell className="font-medium">
                          {row.model || "—"}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatIrt(row.transactions ?? 0)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatIrt(row.tokens ?? 0)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatUnit(row.cost_unit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">آخرین تراکنش‌ها</CardTitle>
              <CardDescription>
                {data.transactions?.total != null
                  ? `${formatIrt(data.transactions.total)} مورد در بازه`
                  : "لیست اخیر"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {txs.length === 0 ? (
                <Empty className="border border-dashed py-8">
                  <EmptyHeader>
                    <EmptyTitle>تراکنشی نیست</EmptyTitle>
                    <EmptyDescription>
                      هنوز درخواستی با این کلید ثبت نشده.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان</TableHead>
                      <TableHead>مدل</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-end">توکن</TableHead>
                      <TableHead className="text-end">وضعیت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(tx.requested_at || tx.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.model || "—"}
                        </TableCell>
                        <TableCell>{tx.provider || "—"}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatIrt(tx.tokens?.total ?? 0)}
                        </TableCell>
                        <TableCell className="text-end">
                          <Badge
                            variant={
                              tx.status_code && tx.status_code < 400
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {tx.status_code ?? "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Separator />
          <p className="text-xs text-muted-foreground">
            داده از{" "}
            <code className="rounded bg-muted px-1">api.avalai.ir/user/v1</code>{" "}
            با کلید ذخیره‌شده AvalAI خوانده می‌شود.
          </p>
        </>
      ) : null}
    </div>
  );
}
