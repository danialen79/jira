"use client";

import React, { useState, useEffect } from "react";

import { Wand2, Sparkles, FileText, Plus, Trash2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AIProvider } from "@/lib/ai-provider";

interface DraftInputProps {
  onRefine: (
    draftText: string,
    customPrompt: string,
    provider: AIProvider,
    model: string,
    outputMode: string
  ) => Promise<void>;
  loading: boolean;
  draftText?: string;
}

const translations = {
    title: "پیش‌نویس استوری‌ها",
    subtitle: "یادداشت یا استوری را بچسبانید. فارسی و انگلیسی.",
    draftLabel: "پیش‌نویس",
    draftPlaceholder:
      "گلوله یا استوری را اینجا بچسبانید…\n\nمثال:\n- اپیک: امنیت حساب\n- ثبت‌نام با ایمیل/رمز\n- لاگین گوگل (OAuth)\n- بازیابی رمز با کد ایمیل",
    customPrompt: "دستور AI",
    promptPlaceholder: "مثال: فارسی روان با Given-When-Then…",
    refineBtn: "اصلاح با AI",
    refining: "در حال اصلاح…",
    quickTemplates: "الگوهای پرامپت",
    templateScrum: "اسکرام (فارسی)",
    templateScrumDesc: "به عنوان… می‌خواهم… تا اینکه… بدون مارکاپ.",
    templateFarsi: "فارسی روان",
    templateFarsiDesc: "استوری فارسی بدون مارکداون یا مارکاپ جیرا.",
    templateTech: "مشخصات فنی",
    templateTechDesc: "متن فارسی با اصطلاحات API و کدهای وضعیت انگلیسی.",
    templateSimple: "چک‌لیست (فارسی)",
    templateSimpleDesc: "گلوله‌های کوتاه فارسی بدون مارکاپ.",
    addPromptTitle: "الگوی پرامپت جدید",
    promptNameLabel: "نام الگو",
    promptNamePlaceholder: "مثال: UI موبایل",
    promptTextLabel: "متن پرامپت",
    promptTextPlaceholder: "مثال: روی چیدمان موبایل تمرکز کن…",
    addBtn: "ذخیره الگو",
    deleteBtn: "حذف الگو",
    outputModeLabel: "خروجی",
    outputModeBoth: "اپیک، استوری و باگ",
    outputModeEpics: "فقط اپیک",
    outputModeStories: "فقط استوری",
    outputModeBugs: "فقط باگ",
  };

export default function DraftInput({
  onRefine,
  loading,
  draftText: draftTextProp,
}: DraftInputProps) {
  const t = translations;  const { aiProvider, selectedModel } = useAiSettings();

  const [draftText, setDraftText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [outputMode, setOutputMode] = useState<string>("both");
  const [draftHydrated, setDraftHydrated] = useState(false);

  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [customUserTemplates, setCustomUserTemplates] = useState<
    { id: string; name: string; prompt: string; desc: string }[]
  >([]);

  useEffect(() => {
    if (draftTextProp !== undefined && draftTextProp !== null) {
      setDraftText(draftTextProp);
    }
  }, [draftTextProp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [promptsRes, draftRes] = await Promise.all([
          fetch("/api/prompts"),
          fetch("/api/kv/workspace/last_draft"),
        ]);
        if (cancelled) return;
        if (promptsRes.ok) {
          const data = await promptsRes.json();
          const prompts = (data.prompts || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            prompt: p.prompt,
            desc: p.description || p.desc || "",
          }));
          setCustomUserTemplates(prompts);
        }
        if (draftRes.ok && draftTextProp === undefined) {
          const data = await draftRes.json();
          const text =
            typeof data?.value === "string"
              ? data.value
              : data?.value?.text;
          if (typeof text === "string") setDraftText(text);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setDraftHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftTextProp]);

  useEffect(() => {
    if (!draftHydrated) return;
    const timer = setTimeout(() => {
      void fetch("/api/kv/workspace/last_draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: { text: draftText } }),
      }).catch((e) => console.error("Failed to save draft", e));
    }, 500);
    return () => clearTimeout(timer);
  }, [draftText, draftHydrated]);

  const templates = [
    {
      id: "scrum",
      name: t.templateScrum,
      desc: t.templateScrumDesc,
      prompt:
        "داستان‌های کاربری را بر اساس استاندارد چابک اسکرام و به فارسی کاملا روان بنویس. فرمت باید به صورت 'به عنوان... می‌خواهم... تا اینکه...' باشد. از هیچ‌گونه علامت بولد (*)، ایتالیک (_)، کاراکترهای h3. یا علامت‌های [ ] یا علامت‌های بی‌معنا استفاده نکن. تمام متون عمومی به فارسی روان نوشته شوند و فقط اصطلاحات فنی و تخصصی مانند API، Timeout، OpenAI، HTTP 5xx به انگلیسی باشند.",
    },
    {
      id: "farsi",
      name: t.templateFarsi,
      desc: t.templateFarsiDesc,
      prompt:
        "تمام داستان‌های کاربری و اپیک‌ها را به فارسی کاملا روان، ساده و شیوا بنویس. برای هر استوری، داستان کاربر و معیارهای پذیرش را با خطوط متنی ساده مشخص کن. از به کار بردن علامت‌های بولد (*)، ایتالیک (_)، کاراکترهای h3. یا علامت‌های [ ] خودداری کن. اصطلاحات تخصصی و فنی به صورت انگلیسی باقی بمانند.",
    },
    {
      id: "tech",
      name: t.templateTech,
      desc: t.templateTechDesc,
      prompt:
        "استوری‌ها و باگ‌ها را با دیدگاه فنی دقیق و به فارسی روان بنویس. در معیارهای پذیرش، Endpointهای API، پارامترهای کلیدی و کدهای خطا مانند 200، 400 و 500 را ذکر کن. از علامت‌های بولد (*)، ایتالیک (_)، h3. یا [ ] استفاده نکن و اصطلاحات فنی را کاملا انگلیسی بنویس.",
    },
    {
      id: "simple",
      name: t.templateSimple,
      desc: t.templateSimpleDesc,
      prompt:
        "توضیحات را خلاصه و به فارسی روان بنویس. معیارها و کارهای اصلی را به صورت خطوط متنی ساده ارائه بده. از کدهای فرمت جیرا مانند h3.، بولد (*)، ایتالیک (_) و علامت‌های [ ] استفاده نکن و اصطلاحات تخصصی را به انگلیسی بنویس.",
    },
  ];

  const allTemplates = [...templates, ...customUserTemplates];

  const handleApplyTemplate = (prompt: string) => {
    setCustomPrompt(prompt);
  };

  const handleAddPromptTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptName.trim() || !newPromptText.trim()) return;

    const newTpl = {
      id: "custom-" + Date.now(),
      name: newPromptName.trim(),
      prompt: newPromptText.trim(),
      desc:
        newPromptText.trim().substring(0, 60) +
        (newPromptText.trim().length > 60 ? "..." : ""),
    };

    const updated = [...customUserTemplates, newTpl];
    setCustomUserTemplates(updated);
    setNewPromptName("");
    setNewPromptText("");
    void fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompts: updated.map((p) => ({
          id: p.id,
          name: p.name,
          prompt: p.prompt,
          description: p.desc,
        })),
      }),
    }).catch((err) => console.error("Failed to save prompts", err));
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customUserTemplates.filter((tpl) => tpl.id !== id);
    setCustomUserTemplates(updated);
    void fetch(`/api/prompts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch((err) => console.error("Failed to delete prompt", err));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim()) return;
    onRefine(draftText, customPrompt, aiProvider, selectedModel, outputMode);
  };

  return (
    <Card id="draft-workspace-panel">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="rounded-md bg-primary/10 p-1.5 text-primary">
            <FileText className="size-4" />
          </div>
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="draft-text">{t.draftLabel}</FieldLabel>
            <Textarea
              id="draft-text"
              required
              className="min-h-56"
              placeholder={t.draftPlaceholder}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              dir="auto"
            />
          </Field>

          <Field>
            <FieldLabel>{t.quickTemplates}</FieldLabel>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {allTemplates.map((tpl) => {
                const isCustom = tpl.id.startsWith("custom-");
                const active = customPrompt === tpl.prompt;
                return (
                  <div key={tpl.id} className="relative">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tpl.prompt)}
                      className={cn(
                        "flex h-full w-full cursor-pointer flex-col justify-between rounded-lg border p-3 text-start text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card hover:bg-muted/50"
                      )}
                    >
                      <div className="mb-1 flex items-center gap-1.5 pe-6 font-semibold text-foreground">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            isCustom ? "bg-accent-foreground" : "bg-primary"
                          )}
                        />
                        {tpl.name}
                        {isCustom ? (
                          <Badge variant="secondary">Custom</Badge>
                        ) : null}
                      </div>
                      <div className="pe-2 font-normal leading-relaxed text-muted-foreground">
                        {tpl.desc}
                      </div>
                    </button>
                    {isCustom ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute end-2 top-2.5 z-10 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        aria-label={t.deleteBtn}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="custom-prompt">{t.customPrompt}</FieldLabel>
            <Input
              id="custom-prompt"
              type="text"
              placeholder={t.promptPlaceholder}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              dir="auto"
            />
          </Field>

          <Field>
            <FieldLabel className="flex items-center gap-1">
              <Sparkles className="size-3 text-success" />
              {t.outputModeLabel}
            </FieldLabel>
            <SearchableSelect
              options={[
                { value: "both", label: t.outputModeBoth },
                { value: "epics", label: t.outputModeEpics },
                { value: "stories", label: t.outputModeStories },
                { value: "bugs", label: t.outputModeBugs },
              ]}
              value={outputMode}
              onChange={setOutputMode}
              showSearch={false}
            />
          </Field>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="mb-2 flex items-center gap-1 font-bold text-foreground">
              <Plus className="size-3.5 text-primary" />
              {t.addPromptTitle}
            </div>
            <form onSubmit={handleAddPromptTemplate}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="text"
                  required
                  className="sm:w-1/3"
                  placeholder={t.promptNamePlaceholder}
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                />
                <Input
                  type="text"
                  required
                  className="flex-1"
                  placeholder={t.promptTextPlaceholder}
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                />
                <Button type="submit" size="sm">
                  {"ذخیره"}
                </Button>
              </div>
            </form>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={handleSubmit}
            disabled={loading || !draftText.trim()}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Wand2 data-icon="inline-start" />
            )}
            {loading ? t.refining : t.refineBtn}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
