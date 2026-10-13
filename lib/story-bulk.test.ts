import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicSplitStories } from "./story-bulk-heuristic.ts";

describe("heuristicSplitStories", () => {
  it("splits lines and stubs scrum description", () => {
    const rows = heuristicSplitStories("- ورود با OTP\n* گزارش ماهانه", {
      lens: "customer",
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.summary, "ورود با OTP");
    assert.equal(rows[0]?.lens, "customer");
    assert.ok(rows[0]?.description.includes("داستان کاربر:"));
    assert.ok(rows[0]?.description.includes("معیارهای پذیرش:"));
  });
});
