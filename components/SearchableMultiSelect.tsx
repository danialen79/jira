"use client";

import * as React from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import type { SearchableSelectOption } from "@/components/SearchableSelect";

interface SearchableMultiSelectProps {
  options: SearchableSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  showSearch?: boolean;
  className?: string;
  isRtl?: boolean;
  disabled?: boolean;
}

function OptionRow({ opt }: { opt: SearchableSelectOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2 truncate">
      {opt.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={opt.avatar}
          alt=""
          className="size-4 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <span className="truncate font-medium">{opt.label}</span>
      {opt.sublabel ? (
        <span className="truncate text-xs text-muted-foreground">
          ({opt.sublabel})
        </span>
      ) : null}
    </span>
  );
}

export default function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  showSearch = true,
  className,
  isRtl = false,
  disabled = false,
}: SearchableMultiSelectProps) {
  const anchor = useComboboxAnchor();
  const items = React.useMemo(
    () => options.map((opt) => opt.value).filter(Boolean),
    [options]
  );
  const byValue = React.useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    for (const opt of options) {
      if (opt.value) map.set(opt.value, opt);
    }
    return map;
  }, [options]);

  const itemToStringLabel = React.useCallback(
    (item: string) => byValue.get(item)?.label ?? String(item ?? ""),
    [byValue]
  );

  const filter = React.useCallback(
    (
      item: string,
      query: string,
      toString?: (item: string) => string
    ) => {
      if (!showSearch) return true;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const opt = byValue.get(item);
      const label = (toString?.(item) ?? opt?.label ?? item).toLowerCase();
      const sub = (opt?.sublabel ?? "").toLowerCase();
      const val = String(item).toLowerCase();
      return label.includes(q) || sub.includes(q) || val.includes(q);
    },
    [byValue, showSearch]
  );

  return (
    <div className={cn("w-full", className)} dir={isRtl ? "rtl" : "ltr"}>
      <Combobox
        multiple
        items={items}
        value={value}
        onValueChange={(next) => {
          onChange(Array.isArray(next) ? next : []);
        }}
        disabled={disabled}
        itemToStringLabel={itemToStringLabel}
        filter={filter}
      >
        <ComboboxChips ref={anchor} className="w-full min-w-0">
          <ComboboxValue>
            {(selected) =>
              (Array.isArray(selected) ? selected : []).map((item) => {
                const opt = byValue.get(item);
                return (
                  <ComboboxChip key={item} aria-label={opt?.label ?? item}>
                    {opt?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opt.avatar}
                        alt=""
                        className="size-3.5 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <span className="max-w-[8rem] truncate">
                      {opt?.label ?? item}
                    </span>
                  </ComboboxChip>
                );
              })
            }
          </ComboboxValue>
          <ComboboxChipsInput placeholder={placeholder} disabled={disabled} />
        </ComboboxChips>
        <ComboboxContent anchor={anchor} className="min-w-[280px] md:min-w-[340px]">
          <ComboboxEmpty>
            {isRtl ? "یافت نشد" : "No matches found"}
          </ComboboxEmpty>
          <ComboboxList>
            {(item) => {
              const opt = byValue.get(item);
              if (!opt) return null;
              return (
                <ComboboxItem key={item} value={item}>
                  <OptionRow opt={opt} />
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
