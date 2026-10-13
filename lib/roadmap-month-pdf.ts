import { toJalaliParts } from "./jalali.ts";
import { lensDisplayLabel, type IssueLens } from "./lens.ts";

export type MonthPdfStatus = "archived" | "released" | "overdue" | "unreleased";
export type MonthPdfBoundary = "start" | "end" | "both";

export type MonthPdfIssue = {
  summary: string;
  issuetype: string;
  lensLabel: string | null;
  assignee: string;
};

export type MonthPdfVersion = {
  title: string;
  status: MonthPdfStatus;
  boundary: MonthPdfBoundary | null;
  startLabel: string;
  releaseLabel: string;
  product: string;
  version: string;
  progress: {
    todo: number;
    inProgress: number;
    done: number;
    canceled: number;
  } | null;
  issues: MonthPdfIssue[];
  loadError: boolean;
  /** Loaded rows vs Jira total, when the fetch was truncated. */
  truncated: { shown: number; total: number } | null;
};

type PdfSourceIssue = {
  summary: string;
  issuetype: string;
  lens?: IssueLens;
  assigneeDisplayName?: string | null;
};

const copy = {
  kicker: "رودمپ",
  start: "شروع",
  release: "انتشار",
  product: "محصول",
  productVer: "ورژن",
  todo: "انجام‌نشده",
  inProgress: "در حال انجام",
  done: "انجام‌شده",
  canceled: "لغوشده",
  versionWord: "ورژن",
  emptyIssues: "ایشویی نیست",
  loadFailed: "بارگذاری ایشوها ناموفق بود.",
  unassigned: "بدون مسئول",
  status: {
    released: "منتشرشده",
    overdue: "عقب‌افتاده",
    archived: "بایگانی",
    unreleased: "منتشرنشده",
  },
  boundary: {
    start: "شروع",
    end: "پایان",
    both: "شروع و پایان",
  },
} as const;

function faNum(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export function faDigits(value: string): string {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function issueTypeClass(issuetype: string): string {
  const name = issuetype.trim().toLowerCase();
  if (name === "epic") return "type type-epic";
  if (name === "story") return "type type-story";
  if (name === "task") return "type type-task";
  if (name === "bug") return "type type-bug";
  if (name === "subtask" || name === "sub-task" || name.startsWith("sub-")) {
    return "type type-sub";
  }
  return "type";
}

function statusClass(status: MonthPdfStatus): string {
  if (status === "released") return "badge badge-ok";
  if (status === "overdue") return "badge badge-bad";
  if (status === "archived") return "badge badge-muted";
  return "badge badge-line";
}

/** Top-level cards only. Callers must not pass epic children or subtasks. */
export function monthPdfIssues(tree: PdfSourceIssue[]): MonthPdfIssue[] {
  return tree.map((issue) => ({
    summary: issue.summary,
    issuetype: issue.issuetype,
    lensLabel: issue.lens ? lensDisplayLabel(issue.lens) : null,
    assignee: issue.assigneeDisplayName?.trim() || copy.unassigned,
  }));
}

export function monthPdfFileTitle(anchor: Date): string {
  const { jy, jm } = toJalaliParts(anchor);
  return `roadmap-${jy}-${String(jm).padStart(2, "0")}`;
}

export function monthPdfPeriodTitle(anchor: Date): string {
  const { jy, jm } = toJalaliParts(anchor);
  const months = [
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
  return faDigits(`${months[jm - 1]} ${jy}`);
}

function countLine(progress: NonNullable<MonthPdfVersion["progress"]>): string {
  const parts = [
    `${copy.todo}: ${faNum(progress.todo)}`,
    `${copy.inProgress}: ${faNum(progress.inProgress)}`,
    `${copy.done}: ${faNum(progress.done)}`,
  ];
  if (progress.canceled > 0) {
    parts.push(`${copy.canceled}: ${faNum(progress.canceled)}`);
  }
  return parts.join(" · ");
}

function issueRow(issue: MonthPdfIssue): string {
  const lens = issue.lensLabel
    ? `<span class="lens">${esc(issue.lensLabel)}</span>`
    : "";
  return `<li class="issue">
    <div class="issue-main">
      <span class="${issueTypeClass(issue.issuetype)}">${esc(issue.issuetype)}</span>
      ${lens}
      <span class="summary">${esc(issue.summary)}</span>
    </div>
    <span class="who">${esc(issue.assignee)}</span>
  </li>`;
}

function versionSection(version: MonthPdfVersion): string {
  const boundary = version.boundary
    ? `<span class="badge badge-muted">${copy.boundary[version.boundary]}</span>`
    : "";
  const counts = version.progress
    ? `<p class="counts">${esc(countLine(version.progress))}</p>`
    : "";
  const truncated = version.truncated
    ? `<p class="note">نمایش ${faNum(version.truncated.shown)} از ${faNum(version.truncated.total)}</p>`
    : "";

  let body: string;
  if (version.loadError) {
    body = `<p class="note">${copy.loadFailed}</p>`;
  } else if (version.issues.length === 0) {
    body = `<p class="note">${copy.emptyIssues}</p>`;
  } else {
    body = `<ul class="issues">${version.issues.map(issueRow).join("")}</ul>`;
  }

  return `<section class="version">
    <div class="badges">
      <span class="${statusClass(version.status)}">${copy.status[version.status]}</span>
      ${boundary}
    </div>
    <h2>${esc(version.title)}</h2>
    <p class="meta">
      <span>${copy.start} ${esc(version.startLabel)}</span>
      <span>${copy.release} ${esc(version.releaseLabel)}</span>
      <span>${copy.product} ${esc(version.product)}</span>
      <span>${copy.productVer} ${esc(version.version)}</span>
    </p>
    ${counts}
    ${truncated}
    ${body}
  </section>`;
}

const CSS = `
@page { size: A4 portrait; margin: 12mm 14mm 16mm; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #18181b;
  font-family: "IRANYekanX", Tahoma, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.doc-head { margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #18181b; }
.kicker { margin: 0; font-size: 9pt; color: #52525b; }
h1 { margin: 2px 0 0; font-size: 20pt; font-weight: 700; line-height: 1.2; }
.month-line { margin: 8px 0 0; color: #3f3f46; font-size: 10pt; }
.version {
  margin: 0 0 14px;
  padding: 10px 12px 6px;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
}
.badges { display: flex; flex-wrap: wrap; gap: 6px; }
.badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 8.5pt;
  line-height: 1.6;
}
.badge-ok { background: #dcfce7; color: #166534; }
.badge-bad { background: #fee2e2; color: #991b1b; }
.badge-muted { background: #f4f4f5; color: #3f3f46; }
.badge-line { border: 1px solid #d4d4d8; color: #18181b; }
h2 { margin: 6px 0 4px; font-size: 13pt; font-weight: 700; }
.meta, .counts, .note { margin: 0 0 6px; color: #52525b; font-size: 9pt; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.issues { list-style: none; margin: 4px 0 0; padding: 0; }
.issue {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid #f4f4f5;
  break-inside: avoid;
  page-break-inside: avoid;
}
.issue-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.summary { font-weight: 600; }
.who { flex: none; color: #52525b; font-size: 9pt; white-space: nowrap; }
.type, .lens {
  display: inline-block;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 8pt;
  line-height: 1.7;
  font-weight: 600;
}
.lens { border: 1px solid #d4d4d8; color: #3f3f46; font-weight: 500; }
.type { background: #f4f4f5; color: #18181b; }
.type-epic { background: #7e22ce; color: #fff; }
.type-story { background: #047857; color: #fff; }
.type-task { background: #1e293b; color: #fff; }
.type-bug { background: #fee2e2; color: #991b1b; }
.type-sub { background: #0284c7; color: #fff; }
`;

export function buildMonthlyRoadmapPdfHtml(input: {
  periodTitle: string;
  fileTitle: string;
  fontHref: string;
  versionCount: number;
  versions: MonthPdfVersion[];
}): string {
  const monthLine =
    input.versionCount > 0
      ? `${faNum(input.versionCount)} ${copy.versionWord}`
      : "";
  const sections = input.versions.map(versionSection).join("");
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(input.fileTitle)}</title>
<style>
@font-face {
  font-family: "IRANYekanX";
  src: url("${esc(input.fontHref)}") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
${CSS}
</style>
</head>
<body>
<header class="doc-head">
  <p class="kicker">${copy.kicker}</p>
  <h1>${esc(input.periodTitle)}</h1>
  ${monthLine ? `<p class="month-line">${esc(monthLine)}</p>` : ""}
</header>
${sections}
</body>
</html>`;
}

let activePrintFrame: HTMLIFrameElement | null = null;

/** Print the document. The browser save dialog uses fileTitle as the PDF name. */
export function printHtmlDocument(html: string, fileTitle: string): void {
  if (typeof document === "undefined") return;
  activePrintFrame?.remove();
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;pointer-events:none"
  );
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);
  activePrintFrame = iframe;
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    activePrintFrame = null;
    return;
  }
  const previousTitle = document.title;
  document.title = fileTitle;
  const restore = () => {
    if (document.title === fileTitle) document.title = previousTitle;
    iframe.remove();
    if (activePrintFrame === iframe) activePrintFrame = null;
  };
  win.addEventListener("afterprint", restore);
  doc.open();
  doc.write(html);
  doc.close();
  const print = () => {
    win.focus();
    win.print();
  };
  const fonts = doc.fonts;
  if (fonts?.ready) {
    void fonts.ready.then(print);
    return;
  }
  print();
}
