"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
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
  const items = options.map((opt) => opt.value);

  return (
    <div className={cn("w-full", className)} dir={isRtl ? "rtl" : "ltr"}>
      <Combobox
        items={items}
        value={value || null}
        onValueChange={(next) => {
          // Ignore clear/blur nulls when clear is disabled — prevents wiping filters
          if (next == null || next === "") return;
          onChange(next as string);
        }}
        disabled={disabled}
        itemToStringLabel={(item) => {
          const opt = options.find((o) => o.value === item);
          return opt?.label ?? String(item ?? "");
        }}
        {...(showSearch
          ? {}
          : {
              filter: (
                _item: string,
                _query: string,
              ) => true,
            })}
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
            <ComboboxGroup>
              {options.map((opt) => (
                <ComboboxItem key={opt.value} value={opt.value}>
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
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {selected?.avatar ? (
        <span className="sr-only">{selected.label}</span>
      ) : null}
    </div>
  );
}
