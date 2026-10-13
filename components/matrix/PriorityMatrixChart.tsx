"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  IMPACT_EFFORT_MAX,
  IMPACT_EFFORT_MIN,
  valueColor,
  valueRatio,
} from "@/lib/impact-effort";
import { cn } from "@/lib/utils";

export type MatrixPoint = {
  key: string;
  summary: string;
  impact: number;
  effort: number;
};

type Props = {
  points: MatrixPoint[];
  onSelect: (key: string) => void;
  className?: string;
};

const t = {
  effort: "Effort",
  impact: "Impact",
  value: "Value",
  empty: "نقطه‌ای با هر دو نمره نیست",
} as const;

function formatNum(n: number): string {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 2,
  }).format(n);
}

type ChartRow = MatrixPoint & {
  x: number;
  y: number;
  value: number;
  fill: string;
};

const chartConfig = {
  matrix: { label: "ماتریس", color: "var(--chart-1)" },
} satisfies ChartConfig;

export default function PriorityMatrixChart({
  points,
  onSelect,
  className,
}: Props) {
  const rows = useMemo(() => {
    const withValue: { point: MatrixPoint; value: number }[] = [];
    for (const p of points) {
      const v = valueRatio(p.impact, p.effort);
      if (v == null) continue;
      withValue.push({ point: p, value: v });
    }
    const ratios = withValue.map((r) => r.value);
    const min = ratios.length ? Math.min(...ratios) : 0;
    const max = ratios.length ? Math.max(...ratios) : 1;
    return withValue.map(
      ({ point, value }): ChartRow => ({
        ...point,
        x: point.effort,
        y: point.impact,
        value,
        fill: valueColor(value, min, max),
      })
    );
  }, [points]);

  if (rows.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {t.empty}
      </p>
    );
  }

  const mid = (IMPACT_EFFORT_MIN + IMPACT_EFFORT_MAX) / 2;

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("aspect-auto w-full", className)}
      style={{ height: 360 }}
    >
      <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name={t.effort}
          domain={[IMPACT_EFFORT_MIN - 0.5, IMPACT_EFFORT_MAX + 0.5]}
          ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          tickLine={false}
          axisLine={false}
          label={{ value: t.effort, position: "insideBottom", offset: -2 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={t.impact}
          domain={[IMPACT_EFFORT_MIN - 0.5, IMPACT_EFFORT_MAX + 0.5]}
          ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          tickLine={false}
          axisLine={false}
          label={{ value: t.impact, angle: -90, position: "insideLeft" }}
          width={40}
        />
        <ReferenceLine x={mid} stroke="var(--border)" strokeDasharray="4 4" />
        <ReferenceLine y={mid} stroke="var(--border)" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as ChartRow | undefined;
            if (!row) return null;
            return (
              <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <div className="font-mono font-medium" translate="no">
                  {row.key}
                </div>
                <div className="max-w-56 truncate text-muted-foreground">
                  {row.summary}
                </div>
                <div className="mt-1 flex flex-col gap-0.5 tabular-nums">
                  <span>
                    {t.impact}: {formatNum(row.impact)}
                  </span>
                  <span>
                    {t.effort}: {formatNum(row.effort)}
                  </span>
                  <span>
                    {t.value}: {formatNum(row.value)}
                  </span>
                </div>
              </div>
            );
          }}
        />
        <Scatter
          data={rows}
          dataKey="y"
          isAnimationActive={false}
          cursor="pointer"
          shape={(props) => {
            const { cx, cy, payload } = props as {
              cx?: number;
              cy?: number;
              payload?: ChartRow;
            };
            if (cx == null || cy == null || !payload) return null;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={7}
                fill={payload.fill}
                stroke="var(--background)"
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(payload.key);
                }}
              />
            );
          }}
        >
          {rows.map((row) => (
            <Cell key={row.key} fill={row.fill} />
          ))}
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}
