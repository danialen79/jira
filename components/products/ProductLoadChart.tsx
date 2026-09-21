"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ProductWorkSummary } from "@/lib/products";
import { PRODUCT_ORPHAN_KEY } from "@/lib/products";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type Props = {
  products: ProductWorkSummary[];
  className?: string;
  onSelect?: (key: string) => void;
};

const t = {
  unfinished: "مانده",
} as const;

function formatCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export default function ProductLoadChart({
  products,
  className,
  onSelect,
}: Props) {
  const rows = useMemo(() => {
    return products
      .filter((p) => p.key !== PRODUCT_ORPHAN_KEY && p.unfinished > 0)
      .slice(0, 12)
      .map((p) => ({
        key: p.key,
        name: p.name,
        unfinished: p.unfinished,
      }));
  }, [products]);

  const config = {
    unfinished: { label: t.unfinished, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  if (rows.length === 0) return null;

  const height = Math.max(160, rows.length * 28);

  return (
    <ChartContainer
      config={config}
      className={cn("w-full", className)}
      style={{ height }}
    >
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
        onClick={(state) => {
          const key = (state as { activePayload?: { payload?: { key?: string } }[] })
            ?.activePayload?.[0]?.payload?.key;
          if (key && onSelect) onSelect(key);
        }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={96}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatCount(Number(value))}
            />
          }
        />
        <Bar
          dataKey="unfinished"
          fill="var(--color-unfinished)"
          radius={[0, 4, 4, 0]}
          cursor={onSelect ? "pointer" : undefined}
        />
      </BarChart>
    </ChartContainer>
  );
}
