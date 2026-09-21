"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, PackageIcon, User } from "lucide-react";
import type { ProductGroupBy, ProductIssue } from "@/lib/products";
import {
  productGroupKey,
  productGroupLabel,
  PRODUCT_ORPHAN_KEY,
} from "@/lib/products";
import { lensDisplayLabel } from "@/lib/lens";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { jiraBrowseUrl, normalizeJiraBase } from "@/lib/jira-browse";
import {
  IssueCard,
  IssueCardFooter,
  IssueCardHeader,
  IssueKeyLink,
} from "@/components/issue-card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productKey: string | null;
  productName: string;
  jiraUrl: string;
};

const t = {
  loading: "در حال بارگذاری…",
  empty: "کار بازی نیست",
  emptyHint: "برای این پروداکت ایشو باز پیدا نشد.",
  groupBy: "گروه‌بندی",
  none: "بدون گروه",
  epic: "اپیک",
  status: "وضعیت",
  type: "نوع",
  version: "ورژن",
  unassigned: "بدون مسئول",
  noVersion: "بدون ورژن",
  count: (n: number) =>
    `${new Intl.NumberFormat("fa-IR").format(n)} ایشو`,
  subtitle: "کارهای باز؛ بدون فیلتر ورژن و لنز.",
} as const;

const GROUP_OPTIONS: { value: ProductGroupBy; label: string }[] = [
  { value: "none", label: t.none },
  { value: "epic", label: t.epic },
  { value: "status", label: t.status },
  { value: "type", label: t.type },
  { value: "version", label: t.version },
];

function ProductIssueRow({
  issue,
  jiraBase,
}: {
  issue: ProductIssue;
  jiraBase: string;
}) {
  const href = jiraBrowseUrl(jiraBase, issue.key);
  return (
    <IssueCard density="compact">
      <IssueCardHeader
        leading={
          <IssueKeyLink href={href} issueKey={issue.key} showIcon={false} />
        }
        title={issue.summary}
        badges={
          <IssueStatusBadge
            status={issue.status}
            statusCategoryKey={issue.statusCategoryKey}
          />
        }
      />
      <IssueCardFooter
        meta={[
          {
            key: "type",
            label: (
              <Badge
                variant="outline"
                className={cn(
                  "font-normal",
                  getIssueTypeBadgeClass(issue.issuetype)
                )}
              >
                {issue.issuetype}
              </Badge>
            ),
          },
          ...(issue.priority
            ? [
                {
                  key: "priority",
                  label: (
                    <Badge variant="secondary" className="font-normal">
                      {issue.priority}
                    </Badge>
                  ),
                },
              ]
            : []),
          ...(issue.lens
            ? [
                {
                  key: "lens",
                  label: (
                    <Badge variant="outline" className="font-normal">
                      {lensDisplayLabel(issue.lens)}
                    </Badge>
                  ),
                },
              ]
            : []),
          {
            key: "assignee",
            icon: User,
            label:
              issue.assigneeDisplayName || issue.assignee || t.unassigned,
          },
          {
            key: "version",
            icon: PackageIcon,
            label: issue.fixVersionNames[0] || t.noVersion,
          },
        ]}
      />
    </IssueCard>
  );
}

export default function ProductDetailSheet({
  open,
  onOpenChange,
  productKey,
  productName,
  jiraUrl,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ProductIssue[]>([]);
  const [groupBy, setGroupBy] = useState<ProductGroupBy>("epic");

  const jiraBase = normalizeJiraBase(jiraUrl);

  useEffect(() => {
    if (!open || !productKey) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (productKey === PRODUCT_ORPHAN_KEY) params.set("orphan", "1");
        else params.set("component", productKey);
        const res = await fetch(`/api/jira/products/issues?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || "Failed to load issues");
          setIssues([]);
          return;
        }
        setIssues(data.issues || []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load issues");
          setIssues([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, productKey]);

  const groups = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "__all__", label: "", items: issues }];
    }
    const map = new Map<string, { label: string; items: ProductIssue[] }>();
    for (const issue of issues) {
      const key = productGroupKey(issue, groupBy);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(issue);
      } else {
        map.set(key, {
          label: productGroupLabel(issue, groupBy, key),
          items: [issue],
        });
      }
    }
    return [...map.entries()]
      .map(([key, g]) => ({ key, label: g.label, items: g.items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [issues, groupBy]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(94vh,72rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl",
          "font-sans"
        )}
        dir="rtl"
      >
        <DialogHeader className="border-b px-5 py-4 text-start">
          <DialogTitle className="flex items-center gap-2" translate="no">
            <Layers className="size-4 text-muted-foreground" />
            {productName}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Badge variant="secondary">{t.count(issues.length)}</Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t.groupBy}</span>
              <Select
                items={GROUP_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={groupBy}
                onValueChange={(v) => {
                  if (v != null) setGroupBy(v as ProductGroupBy);
                }}
              >
                <SelectTrigger className="h-8 w-[9.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                {t.loading}
              </div>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : issues.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>{t.empty}</EmptyTitle>
                <EmptyDescription>{t.emptyHint}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <section key={g.key} className="flex flex-col gap-2">
                  {g.label ? (
                    <h3 className="flex items-center justify-between gap-2 text-sm font-medium">
                      <span className="truncate" translate="no">
                        {g.label}
                      </span>
                      <Badge variant="outline" className="shrink-0 font-normal">
                        {new Intl.NumberFormat("fa-IR").format(g.items.length)}
                      </Badge>
                    </h3>
                  ) : null}
                  <ul className="flex flex-col gap-2">
                    {g.items.map((issue) => (
                      <li key={issue.key}>
                        <ProductIssueRow issue={issue} jiraBase={jiraBase} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
