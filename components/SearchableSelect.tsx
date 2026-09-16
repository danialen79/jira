"use client";

import * as React from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  avatar?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
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

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  showSearch = true,
  className,
  isRtl = false,
  disabled = false,
}: SearchableSelectProps) {
  const selected = options.find((opt) => opt.value === value);
  const items = React.useMemo(
    () => options.map((opt) => opt.value),
    [options],
  );
  const byValue = React.useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    for (const opt of options) map.set(opt.value, opt);
    return map;
  }, [options]);

  const itemToStringLabel = React.useCallback(
    (item: string) => byValue.get(item)?.label ?? String(item ?? ""),
    [byValue],
  );

  const filter = React.useCallback(
    (
      item: string,
      query: string,
      toString?: (item: string) => string,
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
    [byValue, showSearch],
  );

  return (
    <div className={cn("w-full", className)} dir={isRtl ? "rtl" : "ltr"}>
      <Combobox
        items={items}
        value={value || null}
        onValueChange={(next) => {
          // Ignore clear/blur nulls when clear is disabled — prevents wiping filters.
          // Still allow intentional empty-string options (e.g. Unassign).
          if (next == null) return;
          if (next === "" && !byValue.has("")) return;
          onChange(next as string);
        }}
        disabled={disabled}
        itemToStringLabel={itemToStringLabel}
        filter={filter}
      >
        <ComboboxInput
          className="w-full"
          placeholder={placeholder}
          disabled={disabled}
          showClear={false}
        />
        <ComboboxContent className="min-w-[280px] md:min-w-[340px]">
          <ComboboxEmpty>
            {isRtl ? "یافت نشد" : "No matches found"}
          </ComboboxEmpty>
          <ComboboxList>
            {(item) => {
              const opt = byValue.get(item);
              if (!opt) return null;
              return (
                <ComboboxItem
                  key={opt.value === "" ? "__empty__" : opt.value}
                  value={opt.value}
                >
                  <OptionRow opt={opt} />
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {selected?.avatar ? (
        <span className="sr-only">{selected.label}</span>
      ) : null}
    </div>
  );
}
