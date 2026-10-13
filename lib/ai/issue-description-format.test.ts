import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateProposedIssues } from "./issue-description-format.ts";

const validStory = `داستان کاربر:
به عنوان اپراتور پشتیبانی
می‌خواهم وضعیت تیکت را تغییر دهم
تا اینکه مشتری بداند درخواستش دیده شده است

معیارهای پذیرش:
- با فرض تیکت باز، وقتی اپراتور شروع بررسی را می‌زند، آنگاه وضعیت عوض می‌شود
- با فرض تیکت بسته‌شده، وقتی اپراتور شروع بررسی را می‌زند، آنگاه عملیات رد می‌شود

خارج از محدوده:
- اعلان پیامکی`;

describe("validateProposedIssues", () => {
  it("accepts a story with two acceptance bullets", () => {
    assert.deepEqual(
      validateProposedIssues([
        { id: "story-1", issuetype: "Story", description: validStory },
      ]),
      []
    );
  });

  it("rejects a story missing the user-story heading", () => {
    const errors = validateProposedIssues([
      {
        id: "story-1",
        issuetype: "Story",
        description: validStory.replace("داستان کاربر:", "شرح:"),
      },
    ]);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /داستان کاربر/);
  });

  it("rejects a story with one acceptance bullet", () => {
    const description = validStory.replace(
      /- با فرض تیکت بسته‌شده، وقتی اپراتور شروع بررسی را می‌زند، آنگاه عملیات رد می‌شود\n/,
      ""
    );
    const errors = validateProposedIssues([
      { id: "story-1", issuetype: "Story", description },
    ]);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /حداقل ۲/);
  });

  it("rejects a story with more than eight acceptance bullets", () => {
    const extra = Array.from({ length: 9 }, (_, i) => `- معیار ${i + 1}`).join("\n");
    const description = `داستان کاربر:
به عنوان کاربر
می‌خواهم کاری کنم
تا اینکه ارزش ببینم

معیارهای پذیرش:
${extra}`;
    const errors = validateProposedIssues([
      { id: "story-1", issuetype: "Story", description },
    ]);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /۸/);
  });

  it("rejects a bug that omits the environment line", () => {
    const errors = validateProposedIssues([
      {
        id: "bug-1",
        issuetype: "Bug",
        description: `مراحل بازتولید:
1. باز کردن صفحه

نتیجه مورد انتظار:
ذخیره شود

نتیجه فعلی:
خطا می‌دهد`,
      },
    ]);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /محیط/);
  });
});
