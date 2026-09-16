"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { PeekIssue } from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const PRESETS = {
  clarify: {
    en: "Clarify",
    fa: "واضح‌تر",
    prompt:
      "Rewrite the description to be clearer and more structured. Keep technical meaning. Use short paragraphs and bullet lists where helpful. Do not invent requirements.",
  },
  acceptance: {
    en: "Acceptance",
    fa: "معیار پذیرش",
    prompt:
      "Rewrite the description with a clear Overview and an Acceptance Criteria section as a checklist. Keep existing intent; do not invent scope.",
  },
  shorter: {
    en: "Shorter",
    fa: "کوتاه‌تر",
    prompt:
      "Tighten the description. Remove fluff. Keep all concrete requirements and acceptance signals. Prefer bullets over long prose.",
  },
  custom: {
    en: "Custom",
    fa: "سفارشی",
    prompt: "",
  },
} as const;

type PresetId = keyof typeof PRESETS;

const copy = {
  en: {
    description: "Description",
    empty: "No description.",
    rewrite: "Rewrite with AI",
    apply: "Apply",
    discard: "Discard",
    preview: "Preview",
    rewriting: "Rewriting…",
    applying: "Saving…",
    ok: "Description updated.",
    failed: "Rewrite failed.",
    saveFailed: "Could not save description.",
    customPh: "Your rewrite instruction…",
    needPrompt: "Enter a custom prompt first.",
  },
  fa: {
    description: "توضیحات",
    empty: "توضیحی نیست.",
    rewrite: "بازنویسی با AI",
    apply: "اعمال",
    discard: "رد",
    preview: "پیش‌نمایش",
    rewriting: "در حال بازنویسی…",
    applying: "در حال ذخیره…",
    ok: "توضیحات به‌روز شد.",
    failed: "بازنویسی ناموفق.",
    saveFailed: "ذخیره توضیحات نشد.",
    customPh: "دستور بازنویسی خودت را بنویس…",
    needPrompt: "اول پرامپت سفارشی را بنویس.",
  },
} as const;

type Props = {
  issue: PeekIssue;
  label?: string;
  className?: string;
};

export function IssuePeekDescription({ issue, label, className }: Props) {
  const { language, isRtl } = useJiraApp();
  const t = copy[language];
  const { aiProvider, selectedModel } = useAiSettings();
  const { patchIssue, refresh } = useIssuePeek();

  const [preset, setPreset] = useState<PresetId>("clarify");
  const [customPrompt, setCustomPrompt] = useState("");
  const [busy, setBusy] = useState<"rewrite" | "apply" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const title = label || t.description;

  const resolvePrompt = (): string | null => {
    if (preset === "custom") {
      const trimmed = customPrompt.trim();
      return trimmed || null;
    }
    return PRESETS[preset].prompt;
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
      setPreview(null);
      toast.success(t.ok);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{title}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            busy !== null ||
            (preset === "custom" && !customPrompt.trim())
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
      </div>

      <ToggleGroup
        value={[preset]}
        onValueChange={(v) => {
          const next = (v[0] as PresetId | undefined) ?? preset;
          if (next in PRESETS) setPreset(next);
        }}
        variant="outline"
        size="sm"
        className="flex-wrap justify-start"
        aria-label={t.rewrite}
      >
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <ToggleGroupItem key={id} value={id} className="px-2 text-[11px]">
            {PRESETS[id][language]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {preset === "custom" ? (
        <Textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={t.customPh}
          rows={3}
          className="min-h-16 text-xs"
          aria-label={t.customPh}
        />
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-muted-foreground">{t.preview}</p>
          <div className="max-h-[min(28rem,55vh)] min-h-40 overflow-y-auto overscroll-contain rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs">
            <MarkdownPreview text={preview} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={busy !== null}
              onClick={() => void applyPreview()}
            >
              {busy === "apply" ? <Spinner data-icon="inline-start" /> : null}
              {busy === "apply" ? t.applying : t.apply}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => setPreview(null)}
            >
              {t.discard}
            </Button>
          </div>
        </div>
      ) : issue.description ? (
        <div className="max-h-[min(28rem,55vh)] min-h-40 overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs">
          <MarkdownPreview text={issue.description} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t.empty}</p>
      )}
    </div>
  );
}
