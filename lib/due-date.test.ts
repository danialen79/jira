import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daysUntilDue,
  dueTone,
  formatDueRemaining,
  normalizeDueDateWrite,
  parseJiraDueDate,
} from "./due-date.ts";

describe("daysUntilDue", () => {
  it("counts calendar days in local time", () => {
    const today = new Date(2026, 9, 4); // Oct 4 local
    assert.equal(daysUntilDue("2026-10-04", today), 0);
    assert.equal(daysUntilDue("2026-10-07", today), 3);
    assert.equal(daysUntilDue("2026-10-01", today), -3);
  });

  it("returns null for bad input", () => {
    assert.equal(daysUntilDue("nope"), null);
  });
});

describe("formatDueRemaining", () => {
  const today = new Date(2026, 9, 4);

  it("formats future / today / overdue", () => {
    assert.equal(formatDueRemaining("2026-10-07", { today })?.label, "۳ روز");
    assert.equal(formatDueRemaining("2026-10-04", { today })?.label, "امروز");
    assert.equal(
      formatDueRemaining("2026-10-01", { today })?.label,
      "۳ روز گذشته"
    );
  });

  it("hides for done issues", () => {
    assert.equal(
      formatDueRemaining("2026-10-01", {
        today,
        statusCategoryKey: "done",
      }),
      null
    );
  });

  it("tones soon and overdue", () => {
    assert.equal(dueTone(2), "soon");
    assert.equal(dueTone(0), "today");
    assert.equal(dueTone(-1), "overdue");
    assert.equal(dueTone(10), "ok");
  });
});

describe("parse / normalize", () => {
  it("parses jira date", () => {
    assert.equal(parseJiraDueDate("2026-10-04"), "2026-10-04");
    assert.equal(parseJiraDueDate(null), undefined);
  });

  it("normalizes write payloads", () => {
    assert.deepEqual(normalizeDueDateWrite(""), { ok: true, dueDate: null });
    assert.deepEqual(normalizeDueDateWrite("2026-10-04"), {
      ok: true,
      dueDate: "2026-10-04",
    });
    assert.equal(normalizeDueDateWrite("bad").ok, false);
  });
});
