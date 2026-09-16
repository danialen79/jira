"use client";

import { useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";
import type { Language, VersionProgressSummary } from "@/lib/types";
import {
  LENS_OPTIONS,
  lensDisplayLabel,
  type StoryLens,
} from "@/lib/lens";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type LensCountSummary = {
  byLens: Partial<Record<StoryLens, number>>;
  none: number;
};

type Props = {
  progress: VersionProgressSummary | null;
  lensCounts: LensCountSummary;
  language: Language;
  className?: string;
};

const copy = {
  en: {
    progress: "Progress",
    lenses: "Lenses",
    done: "Done",
    remaining: "Remaining",
    noLensData: "No lens-tagged stories yet",
    withoutLens: (n: number) =>
      n === 1 ? "1 story without a lens" : `${n} stories without a lens`,
  },
  fa: {
    progress: "پیشرفت",
    lenses: "لنزها",
    done: "انجام‌شده",
    remaining: "باقی‌مانده",
    noLensData: "استوری دارای لنز نیست",
    withoutLens: (n: number) => `${n} استوری بدون لنز`,
  },
} as const;

const LENS_COLORS: Record<StoryLens, string> = {
  strategy: "var(--chart-1)",
  vision: "var(--chart-2)",
  customer: "var(--chart-3)",
  business: "var(--chart-4)",
};

function formatPercent(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "fa" ? "fa-IR" : "en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatCount(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "fa" ? "fa-IR" : "en-US").format(
    value
  );
}

export default function VersionStatsCharts({
  progress,
  lensCounts,
  language,
  className,
}: Props) {
  const t = copy[language];
  const percent = Math.min(100, Math.max(0, progress?.percent ?? 0));

  const progressConfig = {
    done: { label: t.done, color: "var(--success)" },
    remaining: { label: t.remaining, color: "var(--muted)" },
  } satisfies ChartConfig;

  const progressData = useMemo(() => {
    const done = percent;
    const remaining = 100 - percent;
    const rows: { key: string; value: number; fill: string }[] = [];
    if (done > 0) {
      rows.push({ key: "done", value: done, fill: "var(--color-done)" });
    }
    if (remaining > 0) {
      rows.push({
        key: "remaining",
        value: remaining,
        fill: "var(--color-remaining)",
      });
    }
    if (rows.length === 0) {
      rows.push({
        key: "remaining",
        value: 1,
        fill: "var(--color-remaining)",
      });
    }
    return rows;
  }, [percent]);

  const lensConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const o of LENS_OPTIONS) {
      cfg[o.value] = {
        label: lensDisplayLabel(o.value, language),
        color: LENS_COLORS[o.value],
      };
    }
    return cfg;
  }, [language]);

  const lensRows = useMemo(() => {
    return LENS_OPTIONS.map((o) => {
      const count = lensCounts.byLens[o.value] || 0;
      return {
        lens: o.value,
        count,
        fill: `var(--color-${o.value})`,
        label: lensDisplayLabel(o.value, language),
      };
    });
  }, [lensCounts, language]);

  const lensData = useMemo(
    () => lensRows.filter((d) => d.count > 0),
    [lensRows]
  );

  const lensTaggedTotal = useMemo(
    () => lensData.reduce((sum, d) => sum + d.count, 0),
    [lensData]
  );

  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 gap-6 sm:grid-cols-2",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t.progress}
        </p>
        <ChartContainer
          config={progressConfig}
          className="mx-auto aspect-square h-40 w-full max-w-40"
          initialDimension={{ width: 160, height: 160 }}
          aria-label={`${t.progress}: ${formatPercent(percent, language)}`}
        >
          <PieChart accessibilityLayer>
            <Pie
              data={progressData}
              dataKey="value"
              nameKey="key"
              innerRadius={48}
              outerRadius={68}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                    return null;
                  }
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) - 2}
                        className="fill-foreground text-2xl font-semibold tabular-nums"
                      >
                        {formatPercent(percent, language)}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 16}
                        className="fill-muted-foreground text-[0.65rem]"
                      >
                        {t.progress}
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t.lenses}</p>
        {lensTaggedTotal === 0 ? (
          <div className="flex h-40 w-full items-center justify-center text-center text-xs text-muted-foreground">
            {t.noLensData}
          </div>
        ) : (
          <>
            <ChartContainer
              config={lensConfig}
              className="mx-auto aspect-square h-40 w-full max-w-40"
              initialDimension={{ width: 160, height: 160 }}
              aria-label={t.lenses}
            >
              <PieChart accessibilityLayer>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent nameKey="lens" hideLabel />
                  }
                />
                <Pie
                  data={lensData}
                  dataKey="count"
                  nameKey="lens"
                  innerRadius={32}
                  outerRadius={68}
                  strokeWidth={2}
                  stroke="var(--background)"
                />
              </PieChart>
            </ChartContainer>
            <ul className="flex w-full max-w-56 flex-col gap-1">
              {lensRows.map((row) => {
                const pct =
                  lensTaggedTotal > 0 && row.count > 0
                    ? Math.round((row.count / lensTaggedTotal) * 100)
                    : 0;
                if (row.count === 0) return null;
                return (
                  <li
                    key={row.lens}
                    className="flex items-center justify-between gap-2 text-[0.7rem]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: LENS_COLORS[row.lens] }}
                        aria-hidden
                      />
                      <span className="truncate text-muted-foreground">
                        {row.label}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatCount(row.count, language)} ·{" "}
                      {formatPercent(pct, language)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {lensCounts.none > 0 && (
              <p className="text-[0.65rem] text-muted-foreground tabular-nums">
                {t.withoutLens(lensCounts.none)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
