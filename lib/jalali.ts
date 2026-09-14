import {
  isLeapJalaaliYear,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from "jalaali-js";

export const JALALI_MONTHS_FA = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

export const JALALI_MONTHS_EN = [
  "Farvardin",
  "Ordibehesht",
  "Khordad",
  "Tir",
  "Mordad",
  "Shahrivar",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bahman",
  "Esfand",
] as const;

export type JalaliParts = { jy: number; jm: number; jd: number };

/** Local Y/M/D only — avoids UTC midnight shifting the calendar day. */
export function localYmd(date: Date): { y: number; m: number; d: number } {
  return {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
  };
}

export function toJalaliParts(date: Date): JalaliParts {
  const { y, m, d } = localYmd(date);
  return toJalaali(y, m, d);
}

export function jalaliToLocalDate(jy: number, jm: number, jd: number): Date {
  const dim = jalaaliMonthLength(jy, jm);
  const day = Math.min(Math.max(1, jd), dim);
  const g = toGregorian(jy, jm, day);
  return new Date(g.gy, g.gm - 1, g.gd);
}

/** `YYYY-MM-DD` Gregorian ↔ Jalali for form fields. */
export function isoDateToJalaliParts(iso: string): JalaliParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return toJalaali(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function jalaliPartsToIsoDate(jy: number, jm: number, jd: number): string {
  const dim = jalaaliMonthLength(jy, jm);
  const day = Math.min(Math.max(1, jd), dim);
  const g = toGregorian(jy, jm, day);
  const mm = String(g.gm).padStart(2, "0");
  const dd = String(g.gd).padStart(2, "0");
  return `${g.gy}-${mm}-${dd}`;
}

/** Parse `YYYY-MM-DD` to a local Date (no UTC shift). */
export function isoDateToLocalDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format a local Date as `YYYY-MM-DD`. */
export function localDateToIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatIsoAsJalali(
  iso: string | undefined,
  language: "en" | "fa" = "fa"
): string {
  if (!iso) return "—";
  const parts = isoDateToJalaliParts(iso);
  if (!parts) return iso;
  const months = language === "fa" ? JALALI_MONTHS_FA : JALALI_MONTHS_EN;
  return `${parts.jd} ${months[parts.jm - 1]} ${parts.jy}`;
}

export function formatJalaliDate(
  date: Date,
  language: "en" | "fa" = "fa"
): string {
  const { jy, jm, jd } = toJalaliParts(date);
  const months = language === "fa" ? JALALI_MONTHS_FA : JALALI_MONTHS_EN;
  return `${jd} ${months[jm - 1]} ${jy}`;
}

export function formatJalaliMonthYear(
  date: Date,
  language: "en" | "fa" = "fa"
): string {
  const { jy, jm } = toJalaliParts(date);
  const months = language === "fa" ? JALALI_MONTHS_FA : JALALI_MONTHS_EN;
  return `${months[jm - 1]} ${jy}`;
}

export function formatJalaliYear(date: Date): string {
  return String(toJalaliParts(date).jy);
}

/** Jalali season quarter 1–4 from month (Farvardin=1). */
export function jalaliQuarter(date: Date): number {
  const { jm } = toJalaliParts(date);
  return Math.ceil(jm / 3);
}

export function formatJalaliQuarter(
  date: Date,
  language: "en" | "fa" = "fa"
): string {
  const { jy } = toJalaliParts(date);
  const q = jalaliQuarter(date);
  return language === "fa" ? `سه‌ماهه ${q} ${jy}` : `Q${q} ${jy}`;
}

export function formatJalaliHalfYear(
  date: Date,
  language: "en" | "fa" = "fa"
): string {
  const { jy, jm } = toJalaliParts(date);
  const half = jm <= 6 ? 1 : 2;
  return language === "fa" ? `نیمه ${half} ${jy}` : `H${half} ${jy}`;
}

export function jalaliMonthStart(date: Date): Date {
  const { jy, jm } = toJalaliParts(date);
  return jalaliToLocalDate(jy, jm, 1);
}

export function jalaliMonthEnd(date: Date): Date {
  const { jy, jm } = toJalaliParts(date);
  return jalaliToLocalDate(jy, jm, jalaaliMonthLength(jy, jm));
}

export function addJalaliMonths(date: Date, amount: number): Date {
  const { jy, jm, jd } = toJalaliParts(date);
  const total = jy * 12 + (jm - 1) + amount;
  const njy = Math.floor(total / 12);
  const njm = (total % 12) + 1;
  return jalaliToLocalDate(njy, njm, jd);
}

export function isSameJalaliMonth(a: Date, b: Date): boolean {
  const ja = toJalaliParts(a);
  const jb = toJalaliParts(b);
  return ja.jy === jb.jy && ja.jm === jb.jm;
}

export function jalaliYearStart(date: Date): Date {
  const { jy } = toJalaliParts(date);
  return jalaliToLocalDate(jy, 1, 1);
}

export function jalaliYearEnd(date: Date): Date {
  const { jy } = toJalaliParts(date);
  return jalaliToLocalDate(jy, 12, jalaaliMonthLength(jy, 12));
}

export function addJalaliYears(date: Date, amount: number): Date {
  const { jy, jm, jd } = toJalaliParts(date);
  return jalaliToLocalDate(jy + amount, jm, jd);
}

export function isSameJalaliYear(a: Date, b: Date): boolean {
  return toJalaliParts(a).jy === toJalaliParts(b).jy;
}

export function jalaliQuarterStart(date: Date): Date {
  const { jy, jm } = toJalaliParts(date);
  const startMonth = Math.floor((jm - 1) / 3) * 3 + 1;
  return jalaliToLocalDate(jy, startMonth, 1);
}

export function jalaliQuarterEnd(date: Date): Date {
  const { jy, jm } = toJalaliParts(date);
  const endMonth = Math.floor((jm - 1) / 3) * 3 + 3;
  return jalaliToLocalDate(jy, endMonth, jalaaliMonthLength(jy, endMonth));
}

export function addJalaliQuarters(date: Date, amount: number): Date {
  return addJalaliMonths(jalaliQuarterStart(date), amount * 3);
}

export function isSameJalaliQuarter(a: Date, b: Date): boolean {
  const ja = toJalaliParts(a);
  const jb = toJalaliParts(b);
  return ja.jy === jb.jy && Math.ceil(ja.jm / 3) === Math.ceil(jb.jm / 3);
}

export function jalaliHalfYearStart(date: Date): Date {
  const { jy, jm } = toJalaliParts(date);
  return jalaliToLocalDate(jy, jm <= 6 ? 1 : 7, 1);
}

export function jalaliHalfYearEnd(date: Date): Date {
  const { jy, jm } = toJalaliParts(date);
  const endMonth = jm <= 6 ? 6 : 12;
  return jalaliToLocalDate(jy, endMonth, jalaaliMonthLength(jy, endMonth));
}

export function addJalaliHalfYears(date: Date, amount: number): Date {
  return addJalaliMonths(jalaliHalfYearStart(date), amount * 6);
}

export function isSameJalaliHalfYear(a: Date, b: Date): boolean {
  const ja = toJalaliParts(a);
  const jb = toJalaliParts(b);
  return ja.jy === jb.jy && ja.jm <= 6 === jb.jm <= 6;
}

export { isLeapJalaaliYear, jalaaliMonthLength };
