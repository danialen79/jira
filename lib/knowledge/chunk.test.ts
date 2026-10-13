import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEmbedText, chunkText, estimateTokens } from "./chunk.ts";

describe("estimateTokens", () => {
  it("counts Persian script denser than four characters per token", () => {
    const text = "سلام دنیا";
    assert.ok(estimateTokens(text) > Math.ceil(text.length / 4));
  });
});

describe("chunkText", () => {
  it("keeps the markdown heading for the following body", () => {
    const chunks = chunkText("# ورود\nکاربر رمز را وارد می‌کند.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]!.heading, "ورود");
    assert.match(chunks[0]!.text, /رمز/);
    assert.equal(chunks[0]!.text.includes("#"), false);
  });

  it("splits on the Persian question mark when the token budget is tiny", () => {
    const chunks = chunkText("اولین جمله است. دومین جمله است؟", {
      targetTokens: 8,
      overlapTokens: 0,
    });
    assert.equal(chunks.length, 2);
    assert.match(chunks[0]!.text, /اولین/);
    assert.match(chunks[1]!.text, /دومین/);
  });
});

describe("buildEmbedText", () => {
  it("prefixes title and heading and keeps the normalized body", () => {
    const text = buildEmbedText(
      "ورود",
      { text: "اصل", heading: "احراز" },
      "بدنه"
    );
    assert.equal(text, "ورود\nاحراز\nبدنه");
  });
});
