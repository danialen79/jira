import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthlyRoadmapPdfHtml,
  monthPdfFileTitle,
  monthPdfIssues,
  type MonthPdfVersion,
} from "./roadmap-month-pdf.ts";

describe("monthPdfIssues", () => {
  it("keeps only the closed card fields", () => {
    const rows = monthPdfIssues([
      {
        summary: "اپیک اصلی",
        issuetype: "Epic",
        lens: "strategy",
        assigneeDisplayName: "نگار",
      },
    ]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      summary: "اپیک اصلی",
      issuetype: "Epic",
      lensLabel: "استراتژی",
      assignee: "نگار",
    });
  });
});

describe("buildMonthlyRoadmapPdfHtml", () => {
  it("prints the closed card and omits jira key, status, and due date", () => {
    const version: MonthPdfVersion = {
      title: "Club2.6",
      status: "unreleased",
      boundary: "end",
      startLabel: "۱ مهر ۱۴۰۵",
      releaseLabel: "۳۰ مهر ۱۴۰۵",
      product: "Club",
      version: "2.6",
      progress: { todo: 1, inProgress: 2, done: 3, canceled: 0 },
      loadError: false,
      truncated: null,
      issues: monthPdfIssues([
        {
          summary: "عنوان قابل دیدن <b>",
          issuetype: "Epic",
          lens: "customer",
          assigneeDisplayName: "آرمین",
        },
      ]),
    };

    const html = buildMonthlyRoadmapPdfHtml({
      periodTitle: "مهر ۱۴۰۵",
      fileTitle: monthPdfFileTitle(new Date(2026, 9, 6)),
      fontHref: "http://localhost/fonts/IRANYekanXVF.woff2",
      versionCount: 1,
      versions: [version],
    });

    assert.match(html, /عنوان قابل دیدن &lt;b&gt;/);
    assert.match(html, /type-epic/);
    assert.match(html, /مشتری/);
    assert.match(html, /آرمین/);
    assert.match(html, /Club2\.6/);
    assert.match(html, /انجام‌نشده/);
    assert.match(html, /پایان/);
    assert.equal(html.includes("CLUB-9"), false);
    assert.equal(html.includes("فرزند نباید بیاید"), false);
    assert.equal(html.includes("Blocked"), false);
    assert.equal(html.includes("2026-11-01"), false);
    assert.equal(html.includes("browse"), false);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /size: A4 portrait/);
    assert.match(html, /roadmap-1405-07/);
  });
});
