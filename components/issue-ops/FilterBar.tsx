"use client";

import SearchableSelect from "@/components/SearchableSelect";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { OpsFilterValues } from "@/lib/issue-ops/types";
import type { JiraVersion, Language } from "@/lib/types";

const copy = {
  en: {
    scope: "Scope",
    backlog: "Backlog",
    allIssues: "All",
    backlogHint: "Unassigned, not started, or no release — not Done/Canceled.",
    type: "Type",
    all: "All",
    status: "Status",
    version: "Version",
    noVersion: "No release",
    search: "Search…",
    story: "Story",
    bug: "Bug",
    epic: "Epic",
  },
  fa: {
    scope: "محدوده",
    backlog: "بک‌لاگ",
    allIssues: "همه",
    backlogHint: "بدون مسئول، شروع‌نشده یا بدون ریلیز — بدون Done/Canceled.",
    type: "نوع",
    all: "همه",
    status: "وضعیت",
    version: "ورژن",
    noVersion: "بدون ریلیز",
    search: "جستجو…",
    story: "استوری",
    bug: "باگ",
    epic: "اپیک",
  },
} as const;

type Props = {
  language: Language;
  isRtl: boolean;
  values: OpsFilterValues;
  statusOptions: string[];
  versions: JiraVersion[];
  onChange: (patch: Partial<OpsFilterValues>) => void;
};

export default function FilterBar({
  language,
  isRtl,
  values,
  statusOptions,
  versions,
  onChange,
}: Props) {
  const t = copy[language];
  const scopeValue = values.backlog === "1" ? "backlog" : "all";

  const versionOptions = [
    { value: "ALL", label: t.all },
    { value: "NONE", label: t.noVersion },
    ...versions
      .filter((v) => !v.archived)
      .map((v) => ({
        value: v.id,
        label: v.name,
        sublabel: v.released
          ? language === "fa"
            ? "منتشرشده"
            : "released"
          : undefined,
      })),
  ];

  return (
    <div
      className="flex flex-col gap-3 border-b border-border pb-3"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.scope}</span>
            <ToggleGroup
              value={[scopeValue]}
              onValueChange={(v) => {
                const next = v[0];
                if (!next) return;
                onChange({ backlog: next === "backlog" ? "1" : "0" });
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="backlog">{t.backlog}</ToggleGroupItem>
              <ToggleGroupItem value="all">{t.allIssues}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {scopeValue === "backlog" && (
            <p className="text-xs text-muted-foreground">{t.backlogHint}</p>
          )}
        </div>

        <ToggleGroup
          value={[values.type === "ALL" ? "ALL" : values.type]}
          onValueChange={(v) =>
            onChange({ type: (v[0] as string) || "ALL" })
          }
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="ALL">{t.all}</ToggleGroupItem>
          <ToggleGroupItem value="Story">{t.story}</ToggleGroupItem>
          <ToggleGroupItem value="Bug">{t.bug}</ToggleGroupItem>
          <ToggleGroupItem value="Epic">{t.epic}</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex min-w-[12rem] max-w-xs flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.version}</span>
          <SearchableSelect
            options={versionOptions}
            value={values.version || "ALL"}
            onChange={(val) => {
              if (!val) return;
              onChange({ version: val });
            }}
            isRtl={isRtl}
            placeholder={t.version}
          />
        </div>

        <Input
          className="max-w-xs"
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={t.search}
          name="ops-search"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {statusOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t.status}</span>
          <ToggleGroup
            value={[values.status === "ALL" ? "ALL" : values.status]}
            onValueChange={(v) =>
              onChange({ status: (v[0] as string) || "ALL" })
            }
            variant="outline"
            size="sm"
            className="flex-wrap"
          >
            <ToggleGroupItem value="ALL">{t.all}</ToggleGroupItem>
            {statusOptions.map((s) => (
              <ToggleGroupItem key={s} value={s}>
                {s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}
