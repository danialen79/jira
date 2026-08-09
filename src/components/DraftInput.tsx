import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { Wand2, Sparkles, FileText, ChevronRight, Plus, Trash2, HelpCircle } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface DraftInputProps {
  language: Language;
  onRefine: (draftText: string, customPrompt: string, model: string, outputMode: string) => Promise<void>;
  loading: boolean;
  draftText?: string;
}

const translations = {
  en: {
    title: "Draft Stories & Requirements",
    subtitle: "Input your unstructured notes, raw requirements, or draft epics/stories below. Farsi and English are both fully supported.",
    draftLabel: "Raw Draft Workspace",
    draftPlaceholder: "Paste your raw thoughts, bullet points or user stories here...\n\nExample:\n- Epic for User Account Security\n- Users must register with strong email/password\n- Implement login with Google OAuth\n- Password reset flow sending 6-digit verification code via email",
    customPrompt: "AI Instruction Prompt",
    promptPlaceholder: "Tell Gemini how to clean them up (e.g., 'Translate everything to Persian and write Gherkin style Given-When-Then scenarios')",
    refineBtn: "Refine & Structure with Gemini AI",
    refining: "Gemini is working...",
    quickTemplates: "Quick Prompt Instructions Templates",
    templateScrum: "Agile Scrum Standard (Persian Clean)",
    templateScrumDesc: "Creates standard 'As a... I want to... So that...' statements in smooth Persian without formatting symbols like asterisks or h3.",
    templateFarsi: "Fluent Persian (No Symbols)",
    templateFarsiDesc: "Rewrites stories beautifully in fluent Persian without markdown or Jira markup tags",
    templateTech: "Technical Specs (Persian + English Terms)",
    templateTechDesc: "Includes technical endpoints, HTTP status codes, and English technical terms in smooth Persian text",
    templateSimple: "Simple Checklist (Persian)",
    templateSimpleDesc: "Creates minimalist Persian bullet points without markup symbols",
    addPromptTitle: "Create Custom Prompt Template",
    promptNameLabel: "Template Name",
    promptNamePlaceholder: "e.g., UI Focus / Mobile",
    promptTextLabel: "AI Rules / Prompt Content",
    promptTextPlaceholder: "e.g., Focus only on mobile design considerations...",
    addBtn: "Save Prompt Template",
    deleteBtn: "Delete Template",
    modelLabel: "Gemini AI Model / Engine",
    modelFlash: "Gemini 3.5 Flash (Standard - High Traffic)",
    modelLite: "Gemini 3.1 Flash Lite (Faster - Alternative)",
    modelPro: "Gemini 3.1 Pro (Higher Quality / Complex Reasoning)",
    outputModeLabel: "Refinement Output Scope",
    outputModeBoth: "Generate Epics, Stories, and Bugs (Mixed)",
    outputModeEpics: "Generate ONLY Epics",
    outputModeStories: "Generate ONLY Stories",
    outputModeBugs: "Generate ONLY Bugs"
  },
  fa: {
    title: "ثبت پیش‌نویس نیازمندی‌ها و استوری‌ها",
    subtitle: "یادداشت‌های اولیه، نیازمندی‌های نامنظم یا درفت‌های استوری و اپیک خود را در این بخش بنویسید. زبان فارسی و انگلیسی هر دو پشتیبانی می‌شوند.",
    draftLabel: "محیط کار پیش‌نویس خام",
    draftPlaceholder: "ایده‌ها، یادداشت‌های مکتوب یا استوری‌های خام خود را اینجا بنویسید یا کپی کنید...\n\nمثال:\n- اپیک برای امنیت حساب‌های کاربری\n- کاربر باید بتونه با ایمیل و پسورد قوی ثبت‌نام کنه\n- پیاده‌سازی لاگین با گوگل (OAuth)\n- فرآیند فراموشی رمز عبور با ارسال کد ۶ رقمی ایمیلی",
    customPrompt: "دستورالعمل اختصاصی برای هوش مصنوعی (پرامپت)",
    promptPlaceholder: "به هوش مصنوعی بگویید چطور استوری‌ها را بنویسد (مثال: 'همه داستان‌ها را به فارسی روان بنویس و از هیچ کاراکتر بی معینایی استفاده نکن')",
    refineBtn: "اصلاح و ساختاربندی با هوش مصنوعی Gemini",
    refining: "Gemini در حال پردازش...",
    quickTemplates: "الگوهای آماده برای دستورات هوش مصنوعی",
    templateScrum: "استاندارد چابک اسکرام (فارسی روان بدون کاراکتر اضافه)",
    templateScrumDesc: "ایجاد بیانیه‌های 'به عنوان... می‌خواهم... تا اینکه...' به فارسی روان و بدون کاراکترهای h3. یا بولد و ستاره",
    templateFarsi: "بازنویسی فارسی روان (بدون علامت‌های فرمت)",
    templateFarsiDesc: "تولید داستان‌های کاربری فارسی و معیارهای پذیرش ساده بدون علامت‌های بولد، ایتالیک یا [ ]",
    templateTech: "مشخصات فنی و API (واژگان فنی انگلیسی)",
    templateTechDesc: "افزودن متدها، کدهای HTTP (کدهای 200، 400، 500) و اصطلاحات تخصصی انگلیسی با متن فارسی روان",
    templateSimple: "لیست کارهای ساده (چک‌لیست فارسی)",
    templateSimpleDesc: "ایجاد خلاصه‌های روان و لیست تسک‌های متنی ساده به فارسی",
    addPromptTitle: "ایجاد الگوی پرامپت سفارشی",
    promptNameLabel: "نام الگو",
    promptNamePlaceholder: "مثال: سناریو تست QA",
    promptTextLabel: "قوانین هوش مصنوعی / متن پرامپت",
    promptTextPlaceholder: "مثال: داستان‌ها را به فارسی روان بنویس و اصطلاحات فنی را انگلیسی نگه دار...",
    addBtn: "ذخیره الگوی جدید",
    deleteBtn: "حذف الگو",
    modelLabel: "مدل یا موتور هوش مصنوعی Gemini",
    modelFlash: "Gemini 3.5 Flash (استاندارد - ترافیک سنگین)",
    modelLite: "Gemini 3.1 Flash Lite (سریع‌تر - جایگزین پیشنهادی)",
    modelPro: "Gemini 3.1 Pro (دقت بالاتر / تحلیل عمیق)",
    outputModeLabel: "محدوده خروجی پیش‌نویس (نوع تیکت‌ها)",
    outputModeBoth: "تولید همزمان اپیک، استوری و باگ (ترکیبی)",
    outputModeEpics: "فقط تولید اپیک (Only Epics)",
    outputModeStories: "فقط تولید استوری (Only Stories)",
    outputModeBugs: "فقط تولید باگ (Only Bugs)"
  }
};

export default function DraftInput({ language, onRefine, loading, draftText: draftTextProp }: DraftInputProps) {
  const t = translations[language];
  const isRtl = language === 'fa';

  const [draftText, setDraftText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash");
  const [outputMode, setOutputMode] = useState<string>("both");

  // States for creating a custom template
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [customUserTemplates, setCustomUserTemplates] = useState<{ id: string; name: string; prompt: string; desc: string }[]>([]);

  // Synchronize state with incoming prop (e.g. from Mattermost import)
  useEffect(() => {
    if (draftTextProp !== undefined && draftTextProp !== null) {
      setDraftText(draftTextProp);
    }
  }, [draftTextProp]);

  // Load user templates and previous draft text on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jira_custom_prompts');
      if (saved) {
        setCustomUserTemplates(JSON.parse(saved));
      }
      const savedDraft = localStorage.getItem('jira_last_draft_text');
      if (savedDraft && draftTextProp === undefined) {
        setDraftText(savedDraft);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Save draftText on change
  useEffect(() => {
    localStorage.setItem('jira_last_draft_text', draftText);
  }, [draftText]);

  // Save selectedModel on change
  useEffect(() => {
    localStorage.setItem('jira_last_selected_model', selectedModel);
  }, [selectedModel]);

  const templates = [
    {
      id: "scrum",
      name: t.templateScrum,
      desc: t.templateScrumDesc,
      prompt: "داستان‌های کاربری را بر اساس استاندارد چابک اسکرام و به فارسی کاملا روان بنویس. فرمت باید به صورت 'به عنوان... می‌خواهم... تا اینکه...' باشد. از هیچ‌گونه علامت بولد (*)، ایتالیک (_)، کاراکترهای h3. یا علامت‌های [ ] یا علامت‌های بی‌معنا استفاده نکن. تمام متون عمومی به فارسی روان نوشته شوند و فقط اصطلاحات فنی و تخصصی مانند API، Timeout، OpenAI، HTTP 5xx به انگلیسی باشند."
    },
    {
      id: "farsi",
      name: t.templateFarsi,
      desc: t.templateFarsiDesc,
      prompt: "تمام داستان‌های کاربری و اپیک‌ها را به فارسی کاملا روان، ساده و شیوا بنویس. برای هر استوری، داستان کاربر و معیارهای پذیرش را با خطوط متنی ساده مشخص کن. از به کار بردن علامت‌های بولد (*)، ایتالیک (_)، کاراکترهای h3. یا علامت‌های [ ] خودداری کن. اصطلاحات تخصصی و فنی به صورت انگلیسی باقی بمانند."
    },
    {
      id: "tech",
      name: t.templateTech,
      desc: t.templateTechDesc,
      prompt: "استوری‌ها و باگ‌ها را با دیدگاه فنی دقیق و به فارسی روان بنویس. در معیارهای پذیرش، Endpointهای API، پارامترهای کلیدی و کدهای خطا مانند 200، 400 و 500 را ذکر کن. از علامت‌های بولد (*)، ایتالیک (_)، h3. یا [ ] استفاده نکن و اصطلاحات فنی را کاملا انگلیسی بنویس."
    },
    {
      id: "simple",
      name: t.templateSimple,
      desc: t.templateSimpleDesc,
      prompt: "توضیحات را خلاصه و به فارسی روان بنویس. معیارها و کارهای اصلی را به صورت خطوط متنی ساده ارائه بده. از کدهای فرمت جیرا مانند h3.، بولد (*)، ایتالیک (_) و علامت‌های [ ] استفاده نکن و اصطلاحات تخصصی را به انگلیسی بنویس."
    }
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
      desc: newPromptText.trim().substring(0, 60) + (newPromptText.trim().length > 60 ? "..." : "")
    };

    const updated = [...customUserTemplates, newTpl];
    setCustomUserTemplates(updated);
    localStorage.setItem('jira_custom_prompts', JSON.stringify(updated));
    setNewPromptName("");
    setNewPromptText("");
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent trigger active apply template
    const updated = customUserTemplates.filter(t => t.id !== id);
    setCustomUserTemplates(updated);
    localStorage.setItem('jira_custom_prompts', JSON.stringify(updated));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim()) return;
    onRefine(draftText, customPrompt, selectedModel, outputMode);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5" id="draft-workspace-panel">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800">{t.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Draft Textarea */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            {t.draftLabel}
          </label>
          <textarea
            required
            className="w-full h-56 text-sm p-3.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition duration-150 leading-relaxed font-sans bg-slate-50/30"
            placeholder={t.draftPlaceholder}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            dir="auto"
          />
        </div>

        {/* Quick Instructions Templates */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            {t.quickTemplates}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {allTemplates.map((tpl) => {
              const isCustom = tpl.id.startsWith("custom-");
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl.prompt)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleApplyTemplate(tpl.prompt);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`relative p-3 text-start rounded-lg border text-xs transition duration-150 flex flex-col justify-between h-full hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    customPrompt === tpl.prompt 
                      ? 'border-blue-500 bg-blue-50/20 ring-1 ring-blue-500/30' 
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="pr-6 font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${isCustom ? 'bg-indigo-500' : 'bg-blue-500'}`}></span>
                    {tpl.name}
                    {isCustom && (
                      <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded uppercase">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 font-normal leading-relaxed pr-2">{tpl.desc}</div>

                  {/* Delete button for custom templates */}
                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                      className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-red-500 rounded transition duration-150 cursor-pointer"
                      title={t.deleteBtn}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom prompt input field */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            {t.customPrompt}
          </label>
          <input
            type="text"
            className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition duration-150 bg-slate-50/30 font-sans"
            placeholder={t.promptPlaceholder}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            dir="auto"
          />
        </div>

        {/* Model and Output Scope Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gemini Model Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
              {t.modelLabel}
            </label>
            <CustomSelect
              options={[
                { value: "gemini-3.5-flash", label: t.modelFlash },
                { value: "gemini-3.1-flash-lite", label: t.modelLite },
                { value: "gemini-3.1-pro-preview", label: t.modelPro }
              ]}
              value={selectedModel}
              onChange={(val) => setSelectedModel(val)}
              isRtl={language === 'fa'}
            />
          </div>

          {/* Refinement Output Scope Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" />
              {t.outputModeLabel}
            </label>
            <CustomSelect
              options={[
                { value: "both", label: t.outputModeBoth },
                { value: "epics", label: t.outputModeEpics },
                { value: "stories", label: t.outputModeStories },
                { value: "bugs", label: t.outputModeBugs }
              ]}
              value={outputMode}
              onChange={(val) => setOutputMode(val)}
              isRtl={language === 'fa'}
            />
          </div>
        </div>

        {/* Add Prompt Template Segment */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-xs">
          <div className="font-bold text-slate-700 mb-2 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            {t.addPromptTitle}
          </div>
          <form onSubmit={handleAddPromptTemplate} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                className="text-xs px-2 py-1.5 border border-slate-200 rounded bg-white w-1/3 focus:outline-none focus:border-blue-500"
                placeholder={t.promptNamePlaceholder}
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
              />
              <input
                type="text"
                required
                className="text-xs px-2 py-1.5 border border-slate-200 rounded bg-white flex-1 focus:outline-none focus:border-blue-500"
                placeholder={t.promptTextPlaceholder}
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
              />
              <button
                type="submit"
                className="px-3 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium transition cursor-pointer"
              >
                {isRtl ? "ذخیره" : "Save"}
              </button>
            </div>
          </form>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !draftText.trim()}
            className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm transition duration-150 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{t.refining}</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>{t.refineBtn}</span>
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-blue-200" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
