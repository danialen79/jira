"use client";

import { useEffect, useMemo, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { PeekIssue } from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const STYLE_PRESETS = {
  clarify: {
    label: "واضح‌تر",
    prompt:
      "Rewrite the description to be clearer and more structured. Keep technical meaning. Use short paragraphs and bullet lists where helpful. Do not invent requirements.",
  },
  acceptance: {
    label: "معیار پذیرش",
    prompt:
      "Rewrite the description with a clear Overview and an Acceptance Criteria section as a checklist. Keep existing intent; do not invent scope.",
  },
  shorter: {
    label: "کوتاه‌تر",
    prompt:
      "Tighten the description. Remove fluff. Keep all concrete requirements and acceptance signals. Prefer bullets over long prose.",
  },
  custom: {
    label: "سفارشی",
    prompt: "",
  },
} as const;

type StyleId = keyof typeof STYLE_PRESETS;

const t = {
    title: "بازنویسی توضیحات",
    subtitle: "استایل و دستور را تنظیم کنید؛ قبل از ذخیره در جیرا بررسی کنید.",
    style: "استایل",
    instruction: "دستور تکمیلی",
    instructionPh: "نکته اختیاری برای اصلاح…",
    customLabel: "دستور سفارشی",
    customPh: "دستور کامل بازنویسی…",
    previewEmpty: "بازنویسی را بزنید تا نتیجه اینجا بیاید.",
    templates: "الگوهای پرامپت",
    original: "فعلی",
    preview: "نتیجه AI",
    rewrite: "بازنویسی",
    save: "ذخیره در جیرا",
    cancel: "انصراف",
    rewriting: "در حال بازنویسی…",
    saving: "در حال ذخیره…",
    ok: "توضیحات به‌روز شد.",
    failed: "بازنویسی ناموفق.",
    saveFailed: "ذخیره توضیحات نشد.",
    needPrompt: "اول دستور سفارشی را بنویس.",
    emptyDesc: "توضیحی نیست — AI از خلاصه پیش‌نویس می‌سازد.",
  } as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: PeekIssue;
};

export function IssuePeekRewriteDialog({ open, onOpenChange, issue }: Props) {
  const { aiProvider, selectedModel } = useAiSettings();
  const { patchIssue, refresh } = useIssuePeek();

  const [style, setStyle] = useState<StyleId>("clarify");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<"rewrite" | "apply" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<
    { id: string; name: string; prompt: string }[]
  >([]);

  const builtInTemplates = useMemo(
    () => [
      {
        id: "farsi",
        name: "فارسی روان",
        prompt:
          "توضیحات را به فارسی روان و ساده بنویس. معیارهای پذیرش را با خطوط متنی ساده مشخص کن. از مارکداون و مارکاپ جیرا خودداری کن.",
      },
      {
        id: "tech",
        name: "مشخصات فنی",
        prompt:
          "با دید فنی دقیق و فارسی روان بنویس. API، پارامترها و کدهای خطا را در معیارها ذکر کن. اصطلاحات فنی انگلیسی بمانند.",
      },
      {
        id: "simple",
        name: "چک‌لیست",
        prompt:
          "خلاصه و به فارسی روان. کارهای اصلی و معیارها به صورت خطوط ساده. بدون h3.، بولد یا [ ].",
      },
    ],
    []
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/prompts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.prompts) return;
        setUserTemplates(
          (data.prompts as { id: string; name: string; prompt: string }[]).map(
            (p) => ({ id: p.id, name: p.name, prompt: p.prompt })
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const resetForm = () => {
    setStyle("clarify");
    setInstruction("");
    setPreview(null);
    setBusy(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const resolvePrompt = (): string | null => {
    if (style === "custom") {
      const trimmed = instruction.trim();
      return trimmed || null;
    }
    const base = STYLE_PRESETS[style].prompt;
    const extra = instruction.trim();
    if (!extra) return base;
    return `${base}\n\nAdditional instructions:\n${extra}`;
  };

  const runRewrite = async () => {
    const prompt = resolvePrompt();
    if (!prompt) {
      toast.error(t.needPrompt);
      return;
    }
    setBusy("rewrite");
    try {
      const res = await fetch("/api/refine-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: issue.summary,
          description: issue.description || "",
          issuetype: issue.issuetype,
          customPrompt: prompt,
          draftText: "",
          model: selectedModel,
          provider: aiProvider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.description) {
        throw new Error(data.error || t.failed);
      }
      setPreview(String(data.description));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(null);
    }
  };

  const applyPreview = async () => {
    if (!preview) return;
    setBusy("apply");
    try {
      const res = await fetch("/api/jira/issues/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: issue.key,
          description: preview,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || t.saveFailed);
      }
      patchIssue({ description: preview });
      toast.success(t.ok);
      void refresh();
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setBusy(null);
    }
  };

  const applyTemplate = (prompt: string) => {
    setStyle("custom");
    setInstruction(prompt);
    setPreview(null);
  };

  const allTemplates = [...builtInTemplates, ...userTemplates];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        dir="rtl"
      >
        <DialogHeader className="gap-1 border-b px-4 py-3">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>{t.subtitle}</span>
            <Badge variant="secondary" translate="no">
              {issue.key}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 overscroll-contain">
          <div className="flex flex-col gap-4 px-4 py-4">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel>{t.style}</FieldLabel>
                <ToggleGroup
                  value={[style]}
                  onValueChange={(v) => {
                    const next = (v[0] as StyleId | undefined) ?? style;
                    if (next in STYLE_PRESETS) {
                      setStyle(next);
                      setPreview(null);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-wrap justify-start"
                >
                  {(Object.keys(STYLE_PRESETS) as StyleId[]).map((id) => (
                    <ToggleGroupItem
                      key={id}
                      value={id}
                      className="px-2.5 text-xs"
                    >
                      {STYLE_PRESETS[id].label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="peek-rewrite-instruction">
                  {style === "custom" ? t.customLabel : t.instruction}
                </FieldLabel>
                <Textarea
                  id="peek-rewrite-instruction"
                  value={instruction}
                  onChange={(e) => {
                    setInstruction(e.target.value);
                    setPreview(null);
                  }}
                  placeholder={
                    style === "custom" ? t.customPh : t.instructionPh
                  }
                  rows={3}
                  className="min-h-20 text-sm"
                  dir="auto"
                  spellCheck
                />
              </Field>

              {allTemplates.length > 0 ? (
                <Field>
                  <FieldLabel>{t.templates}</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {allTemplates.map((tpl) => (
                      <Button
                        key={tpl.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto max-w-full py-1.5 text-xs"
                        disabled={busy !== null}
                        onClick={() => applyTemplate(tpl.prompt)}
                      >
                        {tpl.name}
                      </Button>
                    ))}
                  </div>
                </Field>
              ) : null}
            </FieldGroup>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.original}
                </p>
                <div
                  className={cn(
                    "max-h-56 min-h-32 overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs",
                    !issue.description && "text-muted-foreground"
                  )}
                >
                  {issue.description ? (
                    <MarkdownPreview text={issue.description} />
                  ) : (
                    t.emptyDesc
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.preview}
                </p>
                <div
                  className={cn(
                    "max-h-56 min-h-32 overflow-y-auto overscroll-contain rounded-md border p-2.5 text-xs",
                    preview
                      ? "border-primary/30 bg-primary/5"
                      : "border-dashed border-border/60 bg-muted/10 text-muted-foreground"
                  )}
                  aria-live="polite"
                >
                  {preview ? (
                    <MarkdownPreview text={preview} />
                  ) : (
                    <span className="text-[11px]">{t.previewEmpty}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => handleOpenChange(false)}
          >
            {t.cancel}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={
                busy !== null ||
                (style === "custom" && !instruction.trim())
              }
              onClick={() => void runRewrite()}
            >
              {busy === "rewrite" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SparklesIcon data-icon="inline-start" />
              )}
              {busy === "rewrite" ? t.rewriting : t.rewrite}
            </Button>
            <Button
              type="button"
              disabled={busy !== null || !preview}
              onClick={() => void applyPreview()}
            >
              {busy === "apply" ? <Spinner data-icon="inline-start" /> : null}
              {busy === "apply" ? t.saving : t.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
