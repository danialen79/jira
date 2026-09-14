"use client";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Language } from "@/lib/types";

type ScopeItem = { key: string; summary?: string };

type Props = {
  language: Language;
  added: ScopeItem[];
  removed: ScopeItem[];
  limited: boolean;
  jiraUrl: string;
};

const copy = {
  en: {
    added: "Added mid-sprint",
    removed: "Removed / punted",
    empty: "No scope changes",
    emptyHint: "Commitment held since sprint start.",
    limited: "Limited — Greenhopper report unavailable",
  },
  fa: {
    added: "اضافه‌شده میان‌اسپرینت",
    removed: "حذف / خارج‌شده",
    empty: "تغییر اسکوپی نیست",
    emptyHint: "تعهد از شروع اسپرینت حفظ شده.",
    limited: "محدود — گزارش Greenhopper در دسترس نیست",
  },
} as const;

export default function SprintScopePanel({
  language,
  added,
  removed,
  limited,
  jiraUrl,
}: Props) {
  const t = copy[language];

  if (added.length === 0 && removed.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t.empty}</EmptyTitle>
          <EmptyDescription>
            {limited ? t.limited : t.emptyHint}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {limited && <Badge variant="secondary">{t.limited}</Badge>}
      <ScopeList
        title={`${t.added} (${added.length})`}
        items={added}
        jiraUrl={jiraUrl}
      />
      <ScopeList
        title={`${t.removed} (${removed.length})`}
        items={removed}
        jiraUrl={jiraUrl}
      />
    </div>
  );
}

function ScopeList({
  title,
  items,
  jiraUrl,
}: {
  title: string;
  items: ScopeItem[];
  jiraUrl: string;
}) {
  if (items.length === 0) return null;
  const base = jiraUrl.replace(/\/$/, "");
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="flex flex-col gap-1">
        {items.map((i) => (
          <li key={i.key} className="text-sm">
            <a
              href={`${base}/browse/${i.key}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {i.key}
            </a>
            {i.summary ? (
              <span className="text-muted-foreground"> — {i.summary}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
