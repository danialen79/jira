"use client";

import React, { useState, useEffect } from "react";
import { Language } from "@/lib/types";
import { Wand2, Sparkles, FileText, Plus, Trash2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
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

interface DraftInputProps {
  language: Language;
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

type AIProvider = "gemini" | "avalai" | "arvan";

const translations = {
  en: {
    title: "Draft Stories & Requirements",
    subtitle:
      "Input your unstructured notes, raw requirements, or draft epics/stories below. Farsi and English are both fully supported.",
    draftLabel: "Raw Draft Workspace",
    draftPlaceholder:
      "Paste your raw thoughts, bullet points or user stories here...\n\nExample:\n- Epic for User Account Security\n- Users must register with strong email/password\n- Implement login with Google OAuth\n- Password reset flow sending 6-digit verification code via email",
    customPrompt: "AI Instruction Prompt",
    promptPlaceholder:
      "Tell AI how to clean them up (e.g., 'Translate everything to Persian and write Gherkin style Given-When-Then scenarios')",
    refineBtn: "Refine & Structure with AI",
    refining: "Gemini is working...",
    quickTemplates: "Quick Prompt Instructions Templates",
    templateScrum: "Agile Scrum Standard (Persian Clean)",
    templateScrumDesc:
      "Creates standard 'As a... I want to... So that...' statements in smooth Persian without formatting symbols like asterisks or h3.",
    templateFarsi: "Fluent Persian (No Symbols)",
    templateFarsiDesc:
      "Rewrites stories beautifully in fluent Persian without markdown or Jira markup tags",
    templateTech: "Technical Specs (Persian + English Terms)",
    templateTechDesc:
      "Includes technical endpoints, HTTP status codes, and English technical terms in smooth Persian text",
    templateSimple: "Simple Checklist (Persian)",
    templateSimpleDesc:
      "Creates minimalist Persian bullet points without markup symbols",
    addPromptTitle: "Create Custom Prompt Template",
    promptNameLabel: "Template Name",
    promptNamePlaceholder: "e.g., UI Focus / Mobile",
    promptTextLabel: "AI Rules / Prompt Content",
    promptTextPlaceholder: "e.g., Focus only on mobile design considerations...",
    addBtn: "Save Prompt Template",
    deleteBtn: "Delete Template",
    modelLabel: "AI Model / Engine",
    providerLabel: "AI Provider",
    modelFlash: "Gemini 3.5 Flash (Standard - High Traffic)",
    modelLite: "Gemini 3.1 Flash Lite (Faster - Alternative)",
    modelPro: "Gemini 3.1 Pro (Higher Quality / Complex Reasoning)",
    modelAvalai: "AvalAI gpt-4o-mini",
    modelArvan: "Arvan Gemini-3-Flash-Preview",
    outputModeLabel: "Refinement Output Scope",
    outputModeBoth: "Generate Epics, Stories, and Bugs (Mixed)",
    outputModeEpics: "Generate ONLY Epics",
    outputModeStories: "Generate ONLY Stories",
    outputModeBugs: "Generate ONLY Bugs",
  },
  fa: {
    title: "ثبت پیش‌نویس نیازمندی‌ها و استوری‌ها",
    subtitle:
      "یادداشت‌های اولیه، نیازمندی‌های نامنظم یا درفت‌های استوری و اپیک خود را در این بخش بنویسید. زبان فارسی و انگلیسی هر دو پشتیبانی می‌شوند.",
    draftLabel: "محیط کار پیش‌نویس خام",
    draftPlaceholder:
      "ایده‌ها، یادداشت‌های مکتوب یا استوری‌های خام خود را اینجا بنویسید یا کپی کنید...\n\nمثال:\n- اپیک برای امنیت حساب‌های کاربری\n- کاربر باید بتونه با ایمیل و پسورد قوی ثبت‌نام کنه\n- پیاده‌سازی لاگین با گوگل (OAuth)\n- فرآیند فراموشی رمز عبور با ارسال کد ۶ رقمی ایمیلی",
    customPrompt: "دستورالعمل اختصاصی برای هوش مصنوعی (پرامپت)",
    promptPlaceholder:
      "به هوش مصنوعی بگویید چطور استوری‌ها را بنویسد (مثال: 'همه داستان‌ها را به فارسی روان بنویس و از هیچ کاراکتر بی معینایی استفاده نکن')",
    refineBtn: "اصلاح و ساختاربندی با هوش مصنوعی",
    refining: "Gemini در حال پردازش...",
    quickTemplates: "الگوهای آماده برای دستورات هوش مصنوعی",
    templateScrum: "استاندارد چابک اسکرام (فارسی روان بدون کاراکتر اضافه)",
    templateScrumDesc:
      "ایجاد بیانیه‌های 'به عنوان... می‌خواهم... تا اینکه...' به فارسی روان و بدون کاراکترهای h3. یا بولد و ستاره",
    templateFarsi: "بازنویسی فارسی روان (بدون علامت‌های فرمت)",
    templateFarsiDesc:
      "تولید داستان‌های کاربری فارسی و معیارهای پذیرش ساده بدون علامت‌های بولد، ایتالیک یا [ ]",
    templateTech: "مشخصات فنی و API (واژگان فنی انگلیسی)",
    templateTechDesc:
      "افزودن متدها، کدهای HTTP (کدهای 200، 400، 500) و اصطلاحات تخصصی انگلیسی با متن فارسی روان",
    templateSimple: "لیست کارهای ساده (چک‌لیست فارسی)",
    templateSimpleDesc:
      "ایجاد خلاصه‌های روان و لیست تسک‌های متنی ساده به فارسی",
    addPromptTitle: "ایجاد الگوی پرامپت سفارشی",
    promptNameLabel: "نام الگو",
    promptNamePlaceholder: "مثال: سناریو تست QA",
    promptTextLabel: "قوانین هوش مصنوعی / متن پرامپت",
    promptTextPlaceholder:
      "مثال: داستان‌ها را به فارسی روان بنویس و اصطلاحات فنی را انگلیسی نگه دار...",
    addBtn: "ذخیره الگوی جدید",
    deleteBtn: "حذف الگو",
    modelLabel: "مدل یا موتور هوش مصنوعی",
    providerLabel: "پروایدر هوش مصنوعی",
    modelFlash: "Gemini 3.5 Flash (استاندارد - ترافیک سنگین)",
    modelLite: "Gemini 3.1 Flash Lite (سریع‌تر - جایگزین پیشنهادی)",
    modelPro: "Gemini 3.1 Pro (دقت بالاتر / تحلیل عمیق)",
    modelAvalai: "AvalAI gpt-4o-mini",
    modelArvan: "آروان Gemini-3-Flash-Preview",
    outputModeLabel: "محدوده خروجی پیش‌نویس (نوع تیکت‌ها)",
    outputModeBoth: "تولید همزمان اپیک، استوری و باگ (ترکیبی)",
    outputModeEpics: "فقط تولید اپیک (Only Epics)",
    outputModeStories: "فقط تولید استوری (Only Stories)",
    outputModeBugs: "فقط تولید باگ (Only Bugs)",
  },
};

export default function DraftInput({
  language,
  onRefine,
  loading,
  draftText: draftTextProp,
}: DraftInputProps) {
  const t = translations[language];
  const isRtl = language === "fa";

  const [draftText, setDraftText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiProvider, setAiProvider] = useState<AIProvider>("gemini");
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash");
  const [outputMode, setOutputMode] = useState<string>("both");

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
    try {
      const saved = localStorage.getItem("jira_custom_prompts");
      if (saved) {
        setCustomUserTemplates(JSON.parse(saved));
      }
      const savedDraft = localStorage.getItem("jira_last_draft_text");
      if (savedDraft && draftTextProp === undefined) {
        setDraftText(savedDraft);
      }

      const savedProvider = localStorage.getItem("jira_ai_provider");
      if (
        savedProvider === "gemini" ||
        savedProvider === "avalai" ||
        savedProvider === "arvan"
      ) {
        setAiProvider(savedProvider);
      }

      const savedModel =
        localStorage.getItem("jira_ai_model") ||
        localStorage.getItem("jira_last_selected_model");
      if (savedModel) setSelectedModel(savedModel);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("jira_last_draft_text", draftText);
  }, [draftText]);

  useEffect(() => {
    localStorage.setItem("jira_last_selected_model", selectedModel);
    localStorage.setItem("jira_ai_model", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem("jira_ai_provider", aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    const geminiModels = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
    ];
    const avalaiModels = ["gpt-4o-mini"];
    const arvanModels = ["Gemini-3-Flash-Preview"];

    if (aiProvider === "gemini" && !geminiModels.includes(selectedModel)) {
      setSelectedModel("gemini-3.5-flash");
    }
    if (aiProvider === "avalai" && !avalaiModels.includes(selectedModel)) {
      setSelectedModel("gpt-4o-mini");
    }
    if (aiProvider === "arvan" && !arvanModels.includes(selectedModel)) {
      setSelectedModel("Gemini-3-Flash-Preview");
    }
  }, [aiProvider]);

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
    localStorage.setItem("jira_custom_prompts", JSON.stringify(updated));
    setNewPromptName("");
    setNewPromptText("");
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customUserTemplates.filter((tpl) => tpl.id !== id);
    setCustomUserTemplates(updated);
    localStorage.setItem("jira_custom_prompts", JSON.stringify(updated));
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
                  <div
                    key={tpl.id}
                    onClick={() => handleApplyTemplate(tpl.prompt)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleApplyTemplate(tpl.prompt);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "relative flex h-full cursor-pointer flex-col justify-between rounded-lg border p-3 text-start text-xs transition focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
                    {isCustom ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute end-2 top-2.5 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        title={t.deleteBtn}
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel className="flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" />
                  {t.providerLabel}
                </FieldLabel>
                <SearchableSelect
                  options={[
                    { value: "gemini", label: "Gemini" },
                    { value: "avalai", label: "AvalAI" },
                    { value: "arvan", label: "Arvan AIaaS" },
                  ]}
                  value={aiProvider}
                  onChange={(val) => setAiProvider(val as AIProvider)}
                  isRtl={isRtl}
                  showSearch={false}
                />
              </Field>
              <Field>
                <FieldLabel className="flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" />
                  {t.modelLabel}
                </FieldLabel>
                <SearchableSelect
                  options={
                    aiProvider === "gemini"
                      ? [
                          { value: "gemini-3.5-flash", label: t.modelFlash },
                          { value: "gemini-3.1-flash-lite", label: t.modelLite },
                          {
                            value: "gemini-3.1-pro-preview",
                            label: t.modelPro,
                          },
                        ]
                      : aiProvider === "avalai"
                        ? [{ value: "gpt-4o-mini", label: t.modelAvalai }]
                        : [
                            {
                              value: "Gemini-3-Flash-Preview",
                              label: t.modelArvan,
                            },
                          ]
                  }
                  value={selectedModel}
                  onChange={setSelectedModel}
                  isRtl={isRtl}
                  showSearch={false}
                />
              </Field>
            </div>
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
                isRtl={isRtl}
                showSearch={false}
              />
            </Field>
          </div>

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
                  {isRtl ? "ذخیره" : "Save"}
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
