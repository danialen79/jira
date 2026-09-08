"use client";

import { useMemo } from "react";
import {
  JALALI_MONTHS_FA,
  isoDateToJalaliParts,
  jalaaliMonthLength,
  jalaliPartsToIsoDate,
  toJalaliParts,
} from "@/lib/jalali";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
};

const selectClass =
  "h-8 min-w-0 rounded-lg border border-input bg-transparent px-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export default function JalaliDateInput({
  id,
  value,
  onChange,
  disabled,
  className,
  allowEmpty = true,
}: Props) {
  const today = toJalaliParts(new Date());
  const parts = value ? isoDateToJalaliParts(value) : null;
  const jy = parts?.jy ?? today.jy;
  const jm = parts?.jm ?? today.jm;
  const jd = parts?.jd ?? today.jd;
  const empty = !parts;

  const years = useMemo(() => {
    const center = parts?.jy ?? today.jy;
    const list: number[] = [];
    for (let y = center - 15; y <= center + 10; y++) list.push(y);
    return list;
  }, [parts?.jy, today.jy]);

  const daysInMonth = jalaaliMonthLength(jy, jm);

  const emit = (nextJy: number, nextJm: number, nextJd: number) => {
    const dim = jalaaliMonthLength(nextJy, nextJm);
    onChange(jalaliPartsToIsoDate(nextJy, nextJm, Math.min(nextJd, dim)));
  };

  return (
    <div className={cn("flex w-full items-center gap-1.5", className)} dir="rtl">
      <select
        id={id}
        aria-label="روز"
        className={cn(selectClass, "w-[4.25rem]")}
        disabled={disabled}
        value={empty ? "" : jd}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            if (allowEmpty) onChange("");
            return;
          }
          emit(jy, jm, Number(v));
        }}
      >
        {allowEmpty && <option value="">—</option>}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label="ماه"
        className={cn(selectClass, "min-w-0 flex-1")}
        disabled={disabled}
        value={empty ? "" : jm}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            if (allowEmpty) onChange("");
            return;
          }
          emit(jy, Number(v), jd);
        }}
      >
        {allowEmpty && <option value="">—</option>}
        {JALALI_MONTHS_FA.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="سال"
        className={cn(selectClass, "w-[5.25rem]")}
        disabled={disabled}
        value={empty ? "" : jy}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            if (allowEmpty) onChange("");
            return;
          }
          emit(Number(v), jm, jd);
        }}
      >
        {allowEmpty && <option value="">—</option>}
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
