import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heuristicSearchQueries } from "./query-heuristic.ts";

describe("heuristicSearchQueries", () => {
  it("keeps a short draft as one query", () => {
    assert.deepEqual(heuristicSearchQueries({ draft: "تغییر وضعیت تیکت" }), [
      "تغییر وضعیت تیکت",
    ]);
  });

  it("splits a long draft into the first line, headings, and the user line", () => {
    const draft = ["پیش‌نویس طولانی برای جستجو", "# احراز هویت", "بدنه " + "الف".repeat(300)].join(
      "\n"
    );
    const queries = heuristicSearchQueries({
      draft,
      userText: "نقش اپراتور چیست؟",
    });
    assert.ok(queries.length >= 2);
    assert.ok(queries.length <= 4);
    assert.equal(queries[0], "پیش‌نویس طولانی برای جستجو");
    assert.ok(queries.includes("احراز هویت"));
    assert.ok(queries.includes("نقش اپراتور چیست؟"));
    assert.ok(queries.every((query) => query.length <= 200));
  });
});
