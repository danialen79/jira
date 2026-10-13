import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicSplitSubtasks } from "./subtask-bulk-heuristic.ts";

describe("heuristicSplitSubtasks", () => {
  it("splits lines and strips list markers", () => {
    const rows = heuristicSplitSubtasks("- دکمه submit\n* فونت فارسی\n2. iOS crash");
    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.summary, "دکمه submit");
    assert.equal(rows[1]?.summary, "فونت فارسی");
    assert.equal(rows[2]?.summary, "iOS crash");
  });
});
