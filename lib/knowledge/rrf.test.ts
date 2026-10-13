import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reciprocalRankFusion } from "./rrf.ts";

describe("reciprocalRankFusion", () => {
  it("ranks an id that appears in both lists above a single-list hit", () => {
    const fused = reciprocalRankFusion(
      [
        ["a", "b"],
        ["b", "c"],
      ],
      60
    );
    assert.deepEqual(
      fused.map((row) => row.id),
      ["b", "a", "c"]
    );
    assert.equal(fused[0]!.score, 1 / 61 + 1 / 62);
    assert.equal(fused[1]!.score, 1 / 61);
  });

  it("counts a repeated id in one list only once", () => {
    const fused = reciprocalRankFusion([["a", "a", "b"]], 60);
    assert.equal(fused[0]!.id, "a");
    assert.equal(fused[0]!.score, 1 / 61);
    assert.equal(fused[1]!.score, 1 / 62);
  });
});
