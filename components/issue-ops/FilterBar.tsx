"use client";

import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { OpsFilterValues } from "@/lib/issue-ops/types";
import type { Language } from "@/lib/types";

const CHIP_KEYS = ["rel", "asn", "lens", "cmp"] as const;
type ChipKey = (typeof CHIP_KEYS)[number];

const copy = {
  en: {
    missing: "Missing",
    missingHint: "Show independents missing every active field.",
    release: "Release",
    assign: "Assign",
    lens: "Lens",
    component: "Component",
    all: "All",
    status: "Status",
    search: "Search…",
    story: "Story",
    bug: "Bug",
    epic: "Epic",
    task: "Task",
  },
  fa: {
    missing: "ناقص",
    missingHint: "مستقل‌هایی که همهٔ فیلدهای روشن را ندارند.",
    release: "ریلیز",
    assign: "اساین",
    lens: "لنز",
    component: "کامپوننت",
    all: "همه",
    status: "وضعیت",
    search: "جستجو…",
    story: "استوری",
    bug: "باگ",
    epic: "اپیک",
    task: "تسک",
  },
} as const;

type Props = {
  language: Language;
  isRtl: boolean;
  values: OpsFilterValues;
  statusOptions: string[];
  onChange: (patch: Partial<OpsFilterValues>) => void;
};

function chipsFromValues(values: OpsFilterValues): ChipKey[] {
  const out: ChipKey[] = [];
  if (values.missRelease === "1") out.push("rel");
  if (values.missAssign === "1") out.push("asn");
  if (values.missLens === "1") out.push("lens");
  if (values.missComponent === "1") out.push("cmp");
  return out;
}

function patchFromChips(chips: string[]): Partial<OpsFilterValues> {
  const set = new Set(chips);
  return {
    missRelease: set.has("rel") ? "1" : "0",
    missAssign: set.has("asn") ? "1" : "0",
    missLens: set.has("lens") ? "1" : "0",
    missComponent: set.has("cmp") ? "1" : "0",
  };
}

export default function FilterBar({
  language,
  isRtl,
  values,
  statusOptions,
  onChange,
}: Props) {
  const t = copy[language];
  const chipValue = chipsFromValues(values);

  return (
    <div
      className="flex flex-col gap-3 border-b border-border pb-3"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t.missing}</span>
          <ToggleGroup
            multiple
            value={chipValue}
            onValueChange={(v) => onChange(patchFromChips(v))}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="rel">{t.release}</ToggleGroupItem>
            <ToggleGroupItem value="asn">{t.assign}</ToggleGroupItem>
            <ToggleGroupItem value="lens">{t.lens}</ToggleGroupItem>
            <ToggleGroupItem value="cmp">{t.component}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-xs text-muted-foreground">{t.missingHint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
          <ToggleGroupItem value="Task">{t.task}</ToggleGroupItem>
          <ToggleGroupItem value="Epic">{t.epic}</ToggleGroupItem>
        </ToggleGroup>

        <Input
          className="max-w-xs"
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={t.search}
          name="backlog-search"
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
