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
   - For User Stories: Use standard Scrum structure:
     داستان کاربر:
     به عنوان [نقش]
     می‌خواهم [قابلیت / نیاز]
     تا اینکه [هدف / ارزش افزوده]

     معیارهای پذیرش:
     - [معیار 1]
     - [معیار 2]
   - For Bugs: Use clean Persian bug layout:
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
   - Acceptance criteria: verifiable checklist a reviewer can check off.
   - Keep each Story small enough to describe on one screen; split if larger.
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
- …
Epic: هدف کلی + دامنه و خروجی‌های کلیدی. Bug: مراحل بازتولید + نتیجه مورد انتظار + نتیجه فعلی.`;
