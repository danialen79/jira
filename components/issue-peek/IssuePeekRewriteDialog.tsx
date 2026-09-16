"use client";

import { useEffect, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import SearchableSelect from "@/components/SearchableSelect";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
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
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { PeekIssue } from "@/lib/issue-peek";

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

const BUILTIN_TEMPLATES = [
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
] as const;

const t = {
  title: "بازنویسی با AI",
  style: "استایل",
  instruction: "دستور تکمیلی",
  instructionPh: "نکته اختیاری…",
  customLabel: "دستور سفارشی",
  customPh: "دستور کامل بازنویسی…",
  template: "الگوی پرامپت",
  templateNone: "بدون الگو",
  result: "نتیجه",
  current: "فعلی",
  emptyDesc: "توضیحی نیست.",
  rewrite: "بازنویسی",
  save: "ذخیره در جیرا",
  cancel: "انصراف",
  rewriting: "در حال بازنویسی…",
  saving: "در حال ذخیره…",
  ok: "توضیحات به‌روز شد.",
  failed: "بازنویسی ناموفق.",
  saveFailed: "ذخیره توضیحات نشد.",
  needPrompt: "اول دستور سفارشی را بنویس.",
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
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState<"rewrite" | "apply" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reviewTab, setReviewTab] = useState<"result" | "current">("result");
  const [userTemplates, setUserTemplates] = useState<
    { id: string; name: string; prompt: string }[]
  >([]);

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
    setTemplateId("");
    setPreview(null);
    setBusy(null);
    setReviewTab("result");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const allTemplates = [...BUILTIN_TEMPLATES, ...userTemplates];

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const tpl = allTemplates.find((x) => x.id === id);
    if (!tpl) return;
    setStyle("custom");
    setInstruction(tpl.prompt);
    setPreview(null);
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
      setReviewTab("result");
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,40rem)] flex-col gap-0 overflow-y-auto overscroll-contain sm:max-w-lg"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon data-icon="inline-start" />
            {t.title}
          </DialogTitle>
          <DialogDescription translate="no">{issue.key}</DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3 px-1 py-2">
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
                <ToggleGroupItem key={id} value={id}>
                  {STYLE_PRESETS[id].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel>{t.template}</FieldLabel>
            <SearchableSelect
              options={[
                { value: "", label: t.templateNone },
                ...allTemplates.map((tpl) => ({
                  value: tpl.id,
                  label: tpl.name,
                })),
              ]}
              value={templateId}
              onChange={applyTemplate}
              showSearch={allTemplates.length > 5}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="peek-rewrite-instruction">
              {style === "custom" ? t.customLabel : t.instruction}
            </FieldLabel>
            <Textarea
              id="peek-rewrite-instruction"
              name="rewrite-instruction"
              value={instruction}
              onChange={(e) => {
                setInstruction(e.target.value);
                setPreview(null);
              }}
              placeholder={style === "custom" ? t.customPh : t.instructionPh}
              rows={3}
              className="min-h-20"
              dir="auto"
              autoComplete="off"
            />
          </Field>

          {preview ? (
            <Field>
              <Tabs
                value={reviewTab}
                onValueChange={(v) =>
                  setReviewTab(v === "current" ? "current" : "result")
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="result" className="flex-1">
                    {t.result}
                  </TabsTrigger>
                  <TabsTrigger value="current" className="flex-1">
                    {t.current}
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="result"
                  className="mt-2 max-h-48 overflow-y-auto overscroll-contain rounded-md border bg-muted/20 p-3 text-xs"
                  aria-live="polite"
                >
                  <MarkdownPreview text={preview} />
                </TabsContent>
                <TabsContent
                  value="current"
                  className="mt-2 max-h-48 overflow-y-auto overscroll-contain rounded-md border bg-muted/20 p-3 text-xs"
                >
                  {issue.description ? (
                    <MarkdownPreview text={issue.description} />
                  ) : (
                    <p className="text-muted-foreground">{t.emptyDesc}</p>
                  )}
                </TabsContent>
              </Tabs>
            </Field>
          ) : null}
        </FieldGroup>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => handleOpenChange(false)}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            variant={preview ? "secondary" : "default"}
            disabled={
              busy !== null || (style === "custom" && !instruction.trim())
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
          {preview ? (
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void applyPreview()}
            >
              {busy === "apply" ? <Spinner data-icon="inline-start" /> : null}
              {busy === "apply" ? t.saving : t.save}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
