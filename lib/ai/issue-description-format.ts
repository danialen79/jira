/**
 * Shared Agile/Scrum description rules for Refine and Workshop interview.
 * Keep this as the single source of truth for ticket body structure.
 */
export const ISSUE_DESCRIPTION_FORMAT_RULES = `CRITICAL RULES FOR LANGUAGE & FORMATTING:
1. LANGUAGE AND TERMINOLOGY:
   - Always write all ticket summaries, descriptions, titles, and details in fluent, natural, smooth Persian (Farsi).
   - Technical and specialized terms (such as 'API', 'OpenAI', 'Timeout', 'Rate Limit', '5xx', '4xx', 'OAuth', 'JWT', 'Database', 'Frontend', 'Backend', 'JSON', etc.) MUST remain strictly in English.
2. NO MARKDOWN OR JIRA WIKI FORMATTING SYMBOLS:
   - Do NOT use Jira wiki headers like 'h3.', 'h2.', 'h1.'.
   - Do NOT use asterisks for bold or italics (do NOT write *word*, **word**, or _word_).
   - Do NOT use checkbox syntax like '* [ ]' or '[ ]'.
   - Do NOT insert meaningless markup characters or symbols anywhere in the summary or description.
   - Use clean, plain-text line breaks and simple plain titles (e.g., 'داستان کاربر:' or 'معیارهای پذیرش:' or 'مراحل بازتولید:') on their own lines without any asterisks or h3. tags.
3. AGILE / SCRUM STANDARD STRUCTURE (In Fluent Persian):
   - For User Stories:
     داستان کاربر:
     به عنوان [نقش]
     می‌خواهم [قابلیت / نیاز]
     تا اینکه [هدف / ارزش افزوده]

     معیارهای پذیرش:
     - با فرض [زمینه]، وقتی [عمل]، آنگاه [نتیجه قابل مشاهده]
     - با فرض [حالت خطا یا مرز]، وقتی [عمل]، آنگاه [نتیجه قابل مشاهده]

     خارج از محدوده:
     - [فقط وقتی scope معلوم است]

     Example:
     داستان کاربر:
     به عنوان اپراتور پشتیبانی
     می‌خواهم وضعیت تیکت را از صفحه جزئیات به «در حال بررسی» تغییر دهم
     تا اینکه مشتری بداند درخواستش دیده شده است

     معیارهای پذیرش:
     - با فرض تیکت در وضعیت «باز»، وقتی اپراتور «شروع بررسی» را می‌زند، آنگاه وضعیت «در حال بررسی» می‌شود و در تاریخچه ثبت می‌شود
     - با فرض تیکت بسته‌شده، وقتی اپراتور «شروع بررسی» را می‌زند، آنگاه عملیات رد می‌شود و وضعیت عوض نمی‌شود

     خارج از محدوده:
     - اعلان پیامکی به مشتری
   - Acceptance criteria: aim for 3 to 8. Each line is one observable outcome, not an implementation step. Include the happy path and at least one error or boundary. More than 8 criteria means split the Story.
   - For Bugs:
     محیط:
     [نسخه، نقش، یا صفحه]

     مراحل بازتولید:
     1. [مرحله 1]
     2. [مرحله 2]

     نتیجه مورد انتظار:
     [توضیح]

     نتیجه فعلی:
     [توضیح]
   - For Epics:
     هدف کلی:
     [توضیح]

     دامنه و خروجی‌های کلیدی:
     - [مورد 1]
4. QUALITY (every Story/Bug):
   - Summary: imperative and specific (not vague nouns like "Auth").
   - Acceptance criteria: verifiable. A reviewer can pass or fail each line.
   - Keep each Story to one user outcome; split when two roles or two flows appear.
5. Suggest priority from: 'Highest', 'High', 'Medium', 'Low', 'Lowest'.
6. Suggest a concise system component name (e.g. 'Frontend', 'Backend', 'Database', 'Auth', 'API').
7. Do NOT suggest free-form labels/tags. Labels are applied by the system (agent + lens only).`;

/** Compact hint for Zod / tool schemas (model-facing). */
export const ISSUE_DESCRIPTION_FIELD_HINT = `Plain Persian body only — no markdown, no Jira wiki (no h3., *, _, [ ]). Story MUST use:
داستان کاربر:
به عنوان …
می‌خواهم …
تا اینکه …

معیارهای پذیرش:
- با فرض …، وقتی …، آنگاه … (2 to 8 bullets; happy path plus one error or boundary)
خارج از محدوده: when scope is known.
Epic: هدف کلی + دامنه و خروجی‌های کلیدی. Bug: محیط + مراحل بازتولید + نتیجه مورد انتظار + نتیجه فعلی.`;

export type ValidatableIssue = {
  id?: string;
  issuetype: string;
  description: string;
};

function acceptanceBullets(description: string): string[] {
  const lines = description.split("\n");
  const start = lines.findIndex((line) =>
    line.trim().startsWith("معیارهای پذیرش:")
  );
  if (start < 0) return [];
  const bullets: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (line.startsWith("- ")) {
      const text = line.slice(2).trim();
      if (text) bullets.push(text);
      continue;
    }
    if (line.endsWith(":")) break;
  }
  return bullets;
}

export function validateProposedIssue(issue: ValidatableIssue): string[] {
  const description = issue.description || "";
  const errors: string[] = [];

  if (issue.issuetype === "Story") {
    if (!description.includes("داستان کاربر:")) {
      errors.push("توضیح Story باید خط «داستان کاربر:» داشته باشد");
    }
    if (!description.includes("معیارهای پذیرش:")) {
      errors.push("توضیح Story باید خط «معیارهای پذیرش:» داشته باشد");
    } else {
      const bullets = acceptanceBullets(description);
      if (bullets.length < 2) {
        errors.push("Story حداقل ۲ معیار پذیرش با «- » می‌خواهد");
      }
      if (bullets.length > 8) {
        errors.push("Story بیش از ۸ معیار پذیرش دارد؛ آن را بشکن");
      }
    }
  }

  if (issue.issuetype === "Bug") {
    for (const heading of [
      "محیط:",
      "مراحل بازتولید:",
      "نتیجه مورد انتظار:",
      "نتیجه فعلی:",
    ]) {
      if (!description.includes(heading)) {
        errors.push(`توضیح Bug باید خط «${heading}» داشته باشد`);
      }
    }
  }

  if (issue.issuetype === "Epic") {
    if (!description.includes("هدف کلی:")) {
      errors.push("توضیح Epic باید خط «هدف کلی:» داشته باشد");
    }
  }

  return errors;
}

export function validateProposedIssues(issues: ValidatableIssue[]): string[] {
  return issues.flatMap((issue, index) => {
    const label = issue.id?.trim() || String(index + 1);
    return validateProposedIssue(issue).map((error) => `${label}: ${error}`);
  });
}
