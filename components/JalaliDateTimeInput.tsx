"use client";

import JalaliDateInput from "@/components/JalaliDateInput";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  /** Local datetime: `YYYY-MM-DDTHH:mm` (same as `datetime-local`). */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
};

function splitLocalDatetime(value: string): { date: string; time: string } {
  const trimmed = value.trim();
  const full = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(trimmed);
  if (full) return { date: full[1], time: full[2] };
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (dateOnly) return { date: dateOnly[1], time: "00:00" };
  return { date: "", time: "00:00" };
}

export default function JalaliDateTimeInput({
  id,
  value,
  onChange,
  disabled,
  className,
  allowEmpty = true,
}: Props) {
  const { date, time } = splitLocalDatetime(value || "");

  const emit = (nextDate: string, nextTime: string) => {
    if (!nextDate) {
      onChange("");
      return;
    }
    onChange(`${nextDate}T${nextTime || "00:00"}`);
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1.5 sm:flex-row sm:items-center",
        className
      )}
    >
      <JalaliDateInput
        id={id}
        value={date}
        onChange={(iso) => emit(iso, time)}
        disabled={disabled}
        allowEmpty={allowEmpty}
        className="min-w-0 flex-1"
      />
      <Input
        type="time"
        aria-label="ساعت"
        value={date ? time : ""}
        disabled={disabled || (!date && allowEmpty)}
        onChange={(e) => emit(date, e.target.value || "00:00")}
        className="w-full sm:w-[7.5rem]"
      />
    </div>
  );
}
