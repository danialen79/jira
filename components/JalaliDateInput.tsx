"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { CalendarJalali } from "@/components/ui/calendar-jalali";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatIsoAsJalali,
  isoDateToLocalDate,
  localDateToIsoDate,
} from "@/lib/jalali";

import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  placeholder?: string;
};

export default function JalaliDateInput({
  id,
  value,
  onChange,
  disabled,
  className,
  allowEmpty = true,
  placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? isoDateToLocalDate(value) : undefined;
  const emptyLabel = placeholder || "انتخاب تاریخ";

  const label = value ? formatIsoAsJalali(value) : emptyLabel;

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      if (allowEmpty) onChange("");
      return;
    }
    onChange(localDateToIsoDate(date));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!value}
            className={cn(
              "w-full justify-start font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        <span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <CalendarJalali
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          captionLayout="dropdown"
        />
        {allowEmpty && value ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              پاک کردن
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
