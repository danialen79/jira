"use client";

import { Badge } from "@/components/ui/badge";
import type { Language } from "@/lib/types";
import type { SprintHealth } from "@/lib/sprint/metrics";
import { cn } from "@/lib/utils";

type Props = {
  language: Language;
  health: SprintHealth | null;
  scopeDelta?: number;
  reliability?: number | null;
  className?: string;
};

const copy = {
  en: {
    done: "Done",
    remaining: "Remaining",
    todo: "To Do",
    ip: "In progress",
    days: "days left",
    scope: "Scope Δ",
    reliability: "Reliability",
  },
  fa: {
    done: "انجام‌شده",
    remaining: "مانده",
    todo: "باز",
    ip: "در جریان",
    days: "روز مانده",
    scope: "تغییر اسکوپ",
    reliability: "قابلیت اتکا",
  },
} as const;

export default function SprintHealthStrip({
  language,
  health,
  scopeDelta = 0,
  reliability,
  className,
}: Props) {
  const t = copy[language];
  if (!health) return null;

  const remaining = health.todo + health.inProgress;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3",
        className
      )}
    >
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="bg-success"
          style={{ width: `${health.percentDone}%` }}
        />
        <div
          className="bg-primary/60"
          style={{
            width: `${
              health.total
                ? Math.round((health.inProgress / health.total) * 100)
                : 0
            }%`,
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="success">
          {t.done} {health.done} ({health.percentDone}%)
        </Badge>
        <Badge variant="secondary">
          {t.ip} {health.inProgress}
        </Badge>
        <Badge variant="outline">
          {t.todo} {health.todo}
        </Badge>
        <Badge variant="outline">
          {t.remaining} {remaining}
          {health.hoursRemaining > 0 ? ` · ${health.hoursRemaining}h` : ""}
        </Badge>
        {health.daysLeft !== null && (
          <Badge variant="outline">
            {health.daysLeft} {t.days}
          </Badge>
        )}
        {scopeDelta !== 0 && (
          <Badge variant={scopeDelta > 0 ? "destructive" : "secondary"}>
            {t.scope} {scopeDelta > 0 ? `+${scopeDelta}` : scopeDelta}
          </Badge>
        )}
        {reliability != null && (
          <Badge variant="outline">
            {t.reliability} {reliability}%
          </Badge>
        )}
      </div>
    </div>
  );
}
