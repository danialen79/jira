"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { Language } from "@/lib/types";
import type { BurndownPoint, VelocityBar } from "@/lib/sprint/metrics";

type Props = {
  language: Language;
  burndown: BurndownPoint[];
  burndownLimited: boolean;
  velocity: VelocityBar[];
  avgVelocity: number | null;
  currentCommitted: number;
};

const copy = {
  en: {
    burndown: "Burndown",
    velocity: "Velocity",
    remaining: "Remaining",
    ideal: "Ideal",
    completed: "Completed",
    committed: "Committed",
    avg: "Avg completed",
    vs: "vs current commit",
    limited: "Limited history",
  },
  fa: {
    burndown: "برن‌داون",
    velocity: "ولوسیتی",
    remaining: "مانده",
    ideal: "ایده‌آل",
    completed: "تمام‌شده",
    committed: "تعهد",
    avg: "میانگین تمام‌شده",
    vs: "در برابر تعهد فعلی",
    limited: "تاریخچه محدود",
  },
} as const;

export default function SprintChartsPanel({
  language,
  burndown,
  burndownLimited,
  velocity,
  avgVelocity,
  currentCommitted,
}: Props) {
  const t = copy[language];

  const burndownConfig = useMemo(
    () =>
      ({
        remaining: { label: t.remaining, color: "var(--chart-1)" },
        ideal: { label: t.ideal, color: "var(--chart-2)" },
      }) satisfies ChartConfig,
    [t.ideal, t.remaining]
  );

  const velocityConfig = useMemo(
    () =>
      ({
        completed: { label: t.completed, color: "var(--chart-1)" },
        committed: { label: t.committed, color: "var(--chart-3)" },
      }) satisfies ChartConfig,
    [t.committed, t.completed]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{t.burndown}</h4>
          {burndownLimited && (
            <Badge variant="secondary">{t.limited}</Badge>
          )}
        </div>
        {burndown.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ChartContainer config={burndownConfig} className="aspect-[16/9] w-full">
            <LineChart data={burndown} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="var(--color-ideal)"
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="remaining"
                stroke="var(--color-remaining)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium">{t.velocity}</h4>
          {avgVelocity != null && (
            <Badge variant="outline">
              {t.avg} {avgVelocity}
              {currentCommitted > 0
                ? ` · ${t.vs} ${currentCommitted}`
                : ""}
            </Badge>
          )}
        </div>
        {velocity.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ChartContainer config={velocityConfig} className="aspect-[16/9] w-full">
            <BarChart data={velocity} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="committed" fill="var(--color-committed)" radius={2} />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={2} />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
