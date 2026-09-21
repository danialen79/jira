# Story description protocol

When calling `proposeStories`, every issue `description` MUST follow this structure. Do not invent alternate headings.

## Story

```
داستان کاربر:
به عنوان [نقش]
می‌خواهم [قابلیت / نیاز]
تا اینکه [هدف / ارزش افزوده]

معیارهای پذیرش:
- [معیار قابل‌تأیید 1]
- [معیار قابل‌تأیید 2]
```

## Bug

```
مراحل بازتولید:
1. [مرحله 1]
2. [مرحله 2]

نتیجه مورد انتظار:
[توضیح]

نتیجه فعلی:
[توضیح]
```

## Epic

```
هدف کلی:
[توضیح]

دامنه و خروجی‌های کلیدی:
- [مورد 1]
```

## Formatting

- Fluent Persian; technical terms stay English (API, OAuth, JWT, …).
- No markdown or Jira wiki: no `h3.`, `*bold*`, `_italic_`, or `[ ]` checkboxes.
- Plain titles on their own lines; bullets with `- ` only.
- Summary: imperative and specific.
- Keep each Story small (≈ one screen); split larger work.
