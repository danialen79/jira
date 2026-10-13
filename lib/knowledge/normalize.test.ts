import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePersian } from "./normalize.ts";

describe("normalizePersian", () => {
  it("folds Arabic yeh, kaf, and teh marbuta", () => {
    assert.equal(normalizePersian("\u0643\u062A\u0627\u0628"), "\u06A9\u062A\u0627\u0628");
    assert.equal(normalizePersian("\u064A\u0643"), "\u06CC\u06A9");
    assert.equal(normalizePersian("\u0645\u062F\u0631\u0633\u0629"), "\u0645\u062F\u0631\u0633\u0647");
  });

  it("drops tatweel, diacritics, and ZWNJ", () => {
    assert.equal(normalizePersian("\u06A9\u0640\u062A\u0627\u0628"), "\u06A9\u062A\u0627\u0628");
    assert.equal(normalizePersian("\u06A9\u064E\u062A\u0627\u0628"), "\u06A9\u062A\u0627\u0628");
    assert.equal(normalizePersian("\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645"), "\u0645\u06CC\u062E\u0648\u0627\u0647\u0645");
  });

  it("maps Persian and Arabic digits to Latin", () => {
    assert.equal(normalizePersian("\u06F1\u06F2\u06F3"), "123");
    assert.equal(normalizePersian("\u0661\u0662\u0663"), "123");
  });

  it("is idempotent", () => {
    const once = normalizePersian("\u0643\u062A\u0627\u0628 \u06F2 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645");
    assert.equal(normalizePersian(once), once);
  });
});
