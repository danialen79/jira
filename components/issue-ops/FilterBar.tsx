"use client";

import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { Input } from "@/components/ui/input";
import {
  parseAssigneeList,
  serializeAssigneeList,
} from "@/lib/issue-ops/filters";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { OpsFilterValues } from "@/lib/issue-ops/types";
import type { JiraUser, Language } from "@/lib/types";

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
    assignee: "Assignee",
    anyAssignee: "Any assignee",
    assigneePlaceholder: "Pick people…",
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
    assignee: "اساین‌شده به",
    anyAssignee: "هر کسی",
    assigneePlaceholder: "انتخاب افراد…",
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
  users: JiraUser[];
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
  const missAssign = set.has("asn") ? "1" : "0";
  return {
    missRelease: set.has("rel") ? "1" : "0",
    missAssign,
    missLens: set.has("lens") ? "1" : "0",
    missComponent: set.has("cmp") ? "1" : "0",
    // "Missing assign" conflicts with filtering to a specific person.
    ...(missAssign === "1" ? { assignee: "" } : {}),
  };
}

export default function FilterBar({
  language,
  isRtl,
  values,
  statusOptions,
  users,
  onChange,
}: Props) {
  const t = copy[language];
  const chipValue = chipsFromValues(values);

  const assigneeOptions = users.map((u) => ({
    value: u.name,
    label: u.displayName,
    sublabel: u.name,
    avatar: u.avatarUrls?.["24x24"] || u.avatarUrls?.["16x16"],
  }));
  const selectedAssignees = parseAssigneeList(values.assignee);

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

        <div className="flex min-w-[240px] max-w-md flex-1 items-start gap-2">
          <span className="shrink-0 pt-2 text-xs text-muted-foreground">
            {t.assignee}
          </span>
          <SearchableMultiSelect
            className="min-w-0 flex-1"
            options={assigneeOptions}
            value={selectedAssignees}
            onChange={(names) => {
              const assignee = serializeAssigneeList(names);
              onChange({
                assignee,
                ...(assignee ? { missAssign: "0" } : {}),
              });
            }}
            isRtl={isRtl}
            placeholder={t.assigneePlaceholder}
          />
        </div>

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
