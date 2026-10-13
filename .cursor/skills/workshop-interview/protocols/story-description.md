# Story description protocol

When calling `proposeStories`, every issue `description` MUST follow this structure. Do not invent alternate headings. `proposeStories` is rejected when a Story is missing these sections, has fewer than 2 acceptance bullets, or has more than 8.

## Story

```
داستان کاربر:
به عنوان [نقش]
می‌خواهم [قابلیت / نیاز]
تا اینکه [هدف / ارزش افزوده]

معیارهای پذیرش:
- با فرض [زمینه]، وقتی [عمل]، آنگاه [نتیجه قابل مشاهده]
- با فرض [حالت خطا یا مرز]، وقتی [عمل]، آنگاه [نتیجه قابل مشاهده]

خارج از محدوده:
- [فقط وقتی scope معلوم است]
```

Aim for 3 to 8 criteria. Each criterion is one observable outcome, not an implementation step. Include the happy path and at least one error or boundary. More than 8 criteria means split the Story. One Story is one user outcome.

Example:

```
داستان کاربر:
به عنوان اپراتور پشتیبانی
می‌خواهم وضعیت تیکت را از صفحه جزئیات به «در حال بررسی» تغییر دهم
تا اینکه مشتری بداند درخواستش دیده شده است

معیارهای پذیرش:
- با فرض تیکت در وضعیت «باز»، وقتی اپراتور «شروع بررسی» را می‌زند، آنگاه وضعیت «در حال بررسی» می‌شود و در تاریخچه ثبت می‌شود
- با فرض تیکت بسته‌شده، وقتی اپراتور «شروع بررسی» را می‌زند، آنگاه عملیات رد می‌شود و وضعیت عوض نمی‌شود

خارج از محدوده:
- اعلان پیامکی به مشتری
```

## Bug

```
محیط:
[نسخه، نقش، یا صفحه]

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
- Keep each Story small (one outcome); split larger work.
