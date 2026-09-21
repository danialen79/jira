"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import type { AskUserInput, AskUserOutput } from "@/lib/ai/tools";

export type AskUserToolPart = {
  type: "tool-askUser";
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | string;
  input?: AskUserInput;
  output?: AskUserOutput;
  errorText?: string;
};

type InterviewQuestionCardProps = {
  part: AskUserToolPart;
  onAnswer: (toolCallId: string, output: AskUserOutput) => void;
  /** Compact chrome for composer slot */
  embedded?: boolean;
};

function resolveAnswer(
  formData: FormData,
  question: {
    name: string;
    multiple?: boolean;
    choices: Array<{ value: string; label: string; description?: string }>;
  }
): string {
  const format = (raw: string) => {
    const matched = question.choices.find((c) => c.value === raw);
    if (!matched) return raw;
    return matched.description
      ? `${matched.label} — ${matched.description}`
      : matched.label;
  };

  if (question.multiple) {
    const all = formData
      .getAll(question.name)
      .map((v) => String(v).trim())
      .filter(Boolean);
    // Dedupe while preserving order (choice + freeform can share the name).
    const unique = [...new Set(all)];
    return unique.map(format).join("، ");
  }

  return format(String(formData.get(question.name) ?? "").trim());
}

export function InterviewQuestionCard({
  part,
  onAnswer,
  embedded = false,
}: InterviewQuestionCardProps) {
  const cardClass = embedded
    ? "border-primary/30 shadow-none"
    : "border-primary/25 shadow-sm";

  if (part.state === "input-streaming") {
    return (
      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">در حال آماده‌سازی سوال…</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (part.state === "output-available") {
    const answers = part.output?.answers || [];
    return (
      <Card className={embedded ? "shadow-none" : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">جواب ثبت شد</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {answers.map((a) => (
            <div key={a.name} className="min-w-0">
              <p className="text-muted-foreground text-xs">{a.question}</p>
              <p className="break-words font-medium">{a.answer || "—"}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (part.state === "output-error") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="text-destructive py-3 text-sm">
          {part.errorText || "خطا در ثبت جواب"}
        </CardContent>
      </Card>
    );
  }

  const questions = part.input?.questions || [];
  if (!questions.length) {
    return (
      <Card className={embedded ? "shadow-none" : undefined}>
        <CardContent className="text-muted-foreground py-3 text-sm">
          سوالی برای نمایش نیست.
        </CardContent>
      </Card>
    );
  }

  const items = questions.map((q) => ({
    name: q.name,
    required: q.required !== false,
    choices: q.choices.map((c) => ({ value: c.value })),
  }));

  return (
    <Card className={cardClass}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {embedded ? "جواب بده" : "سوال‌های روشن‌سازی"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Questionnaire
          items={items}
          shortcuts="numbers"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const answers = questions.map((q) => {
              const answer = resolveAnswer(formData, q);
              return {
                name: q.name,
                question: q.prompt,
                answer,
                coverageKey: q.coverageKey,
              };
            });
            onAnswer(part.toolCallId, { answers });
          }}
        >
          {questions.length > 1 ? <QuestionnaireProgress /> : null}
          {questions.map((q) => {
            const allowFreeform = q.allowFreeform !== false;
            const required = q.required !== false;
            return (
              <QuestionnaireItem
                key={q.name}
                name={q.name}
                required={required}
                multiple={!!q.multiple}
              >
                <QuestionnaireTitle>{q.prompt}</QuestionnaireTitle>
                {q.description ? (
                  <QuestionnaireDescription>
                    {q.description}
                  </QuestionnaireDescription>
                ) : null}
                <QuestionnaireChoices>
                  {q.choices.map((choice) => (
                    <QuestionnaireChoice
                      key={choice.value}
                      value={choice.value}
                    >
                      <span className="font-medium">{choice.label}</span>
                      {choice.description ? (
                        <QuestionnaireChoiceDescription>
                          {choice.description}
                        </QuestionnaireChoiceDescription>
                      ) : null}
                    </QuestionnaireChoice>
                  ))}
                  {allowFreeform ? (
                    <QuestionnaireInput
                      aria-label="جواب آزاد"
                      placeholder="یا جواب خودت را بنویس…"
                    />
                  ) : null}
                </QuestionnaireChoices>
                <QuestionnaireError />
              </QuestionnaireItem>
            );
          })}
          <QuestionnaireActions>
            <QuestionnairePrevious>قبلی</QuestionnairePrevious>
            {questions.some((q) => q.required === false) ? (
              <QuestionnaireSkip>رد کردن</QuestionnaireSkip>
            ) : null}
            <QuestionnaireNext>بعدی</QuestionnaireNext>
            <QuestionnaireSubmit>ثبت جواب</QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      </CardContent>
    </Card>
  );
}
