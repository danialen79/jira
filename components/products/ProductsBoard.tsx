"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, RefreshCw } from "lucide-react";
import type { ProductWorkSummary } from "@/lib/products";
import { PRODUCT_ORPHAN_KEY } from "@/lib/products";
import ProductDetailSheet from "@/components/products/ProductDetailSheet";
import ProductLoadChart from "@/components/products/ProductLoadChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  jiraUrl: string;
  jiraConnected: boolean;
};

const t = {
  subtitle: "ماندهٔ هر پروداکت؛ بدون فیلتر ورژن و لنز.",
  refresh: "تازه‌سازی",
  loading: "در حال بارگذاری…",
  empty: "پروداکتی نیست",
  emptyHint: "کامپوننت‌های پروژه را در جیرا بسازید.",
  disconnected: "ابتدا در تنظیمات به جیرا وصل شوید.",
  todo: "انجام‌نشده",
  inProgress: "در حال انجام",
  unplanned: "بدون ورژن",
  total: "کل مانده",
  open: "باز کردن",
} as const;

function formatCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

function ProductRow({
  product,
  onOpen,
}: {
  product: ProductWorkSummary;
  onOpen: () => void;
}) {
  const isOrphan = product.key === PRODUCT_ORPHAN_KEY;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border/80 bg-card/40 px-3 py-2.5 text-start transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isOrphan && "border-dashed"
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Layers className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" translate="no">
          {product.name}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            {t.todo} {formatCount(product.todo)}
          </span>
          <span>
            {t.inProgress} {formatCount(product.inProgress)}
          </span>
          {product.unplanned > 0 ? (
            <span>
              {t.unplanned} {formatCount(product.unplanned)}
            </span>
          ) : null}
        </div>
      </div>
      <Badge
        variant={product.unfinished > 0 ? "default" : "secondary"}
        className="shrink-0 tabular-nums"
      >
        {formatCount(product.unfinished)}
      </Badge>
    </button>
  );
}

export default function ProductsBoard({ jiraUrl, jiraConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductWorkSummary[]>([]);
  const [totals, setTotals] = useState({
    unfinished: 0,
    todo: 0,
    inProgress: 0,
    unplanned: 0,
    orphan: 0,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jira/products");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load products");
        setProducts([]);
        return;
      }
      setProducts(data.products || []);
      setTotals(
        data.totals || {
          unfinished: 0,
          todo: 0,
          inProgress: 0,
          unplanned: 0,
          orphan: 0,
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jiraConnected) return;
    void load();
  }, [jiraConnected, load]);

  const selected = products.find((p) => p.key === selectedKey) || null;

  if (!jiraConnected) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers />
          </EmptyMedia>
          <EmptyTitle>{t.disconnected}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Spinner /> : <RefreshCw className="size-3.5" />}
          {t.refresh}
        </Button>
      </div>

      {loading && products.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {t.loading}
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : products.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>{t.empty}</EmptyTitle>
            <EmptyDescription>{t.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {t.total} {formatCount(totals.unfinished)}
            </Badge>
            <Badge variant="outline">
              {t.todo} {formatCount(totals.todo)}
            </Badge>
            <Badge variant="outline">
              {t.inProgress} {formatCount(totals.inProgress)}
            </Badge>
            {totals.unplanned > 0 ? (
              <Badge variant="outline">
                {t.unplanned} {formatCount(totals.unplanned)}
              </Badge>
            ) : null}
            {totals.orphan > 0 ? (
              <Badge variant="destructive">
                بدون پروداکت {formatCount(totals.orphan)}
              </Badge>
            ) : null}
          </div>

          <ProductLoadChart
            products={products}
            onSelect={(key) => setSelectedKey(key)}
          />

          <ul className="flex flex-col gap-2">
            {products.map((p) => (
              <li key={p.key}>
                <ProductRow
                  product={p}
                  onOpen={() => setSelectedKey(p.key)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <ProductDetailSheet
        open={!!selectedKey}
        onOpenChange={(next) => {
          if (!next) setSelectedKey(null);
        }}
        productKey={selectedKey}
        productName={selected?.name || selectedKey || ""}
        jiraUrl={jiraUrl}
      />
    </div>
  );
}
