"use client";

import { Badge } from "@/components/ui/badge";
import {
  IMPACT_EFFORT_MAX,
  IMPACT_EFFORT_MIN,
  type ImpactHistogram,
} from "@/lib/impact-effort";
import { cn } from "@/lib/utils";

type Props = {
  histogram: ImpactHistogram;
  className?: string;
};

const t = {
  impact: "Impact",
  missing: "بدون نمره",
  mean: "میانگین value",
  none: "موردی با Impact نیست",
} as const;

function formatCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

function formatRatio(n: number): string {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 2,
  }).format(n);
}

/** Higher impact → greener segment of the strip. */
function impactBarColor(score: number): string {
  const tNorm = (score - IMPACT_EFFORT_MIN) / (IMPACT_EFFORT_MAX - IMPACT_EFFORT_MIN);
  const h = 0 + (142 - 0) * tNorm;
  return `hsl(${Math.round(h)} 65% 42%)`;
}

export default function MatrixHealthStrip({ histogram, className }: Props) {
  const total = histogram.scored + histogram.missing;
  const activeScores = [];
  for (let i = IMPACT_EFFORT_MIN; i <= IMPACT_EFFORT_MAX; i++) {
    if ((histogram.counts[i] || 0) > 0) activeScores.push(i);
  }

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3",
        className
      )}
    >
      {histogram.scored > 0 ? (
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {activeScores.map((score) => {
            const count = histogram.counts[score] || 0;
            const pct = Math.round((count / histogram.scored) * 100);
            return (
              <div
                key={score}
                title={`${t.impact} ${score}: ${count}`}
                style={{
                  width: `${pct}%`,
                  backgroundColor: impactBarColor(score),
                }}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.none}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {activeScores.map((score) => (
          <Badge
            key={score}
            variant="outline"
            className="tabular-nums"
            style={{ borderColor: impactBarColor(score) }}
          >
            {t.impact} {formatCount(score)} · {formatCount(histogram.counts[score] || 0)}
          </Badge>
        ))}
        {histogram.missing > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {t.missing} {formatCount(histogram.missing)}
          </Badge>
        ) : null}
        {histogram.meanValue != null ? (
          <Badge variant="outline" className="tabular-nums">
            {t.mean} {formatRatio(histogram.meanValue)}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
