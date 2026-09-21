"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, PlugZap, Save, Sparkles, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  useAiSettings,
  type PublicAiProvider,
} from "@/components/providers/ai-settings-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import JiraBoardSettings from "@/components/settings/JiraBoardSettings";
import SearchableSelect from "@/components/SearchableSelect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { AIProvider } from "@/lib/ai-providers";
import {
  AI_PROVIDER_IDS,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_ORCHESTRATOR_MODELS,
  DEFAULT_SUBAGENT_MODELS,
  OMNIROUTE_DEFAULT_BASE_URL,
} from "@/lib/ai-providers";

type ProviderFormState = {
  apiKey: string;
  baseUrl: string;
  clearApiKey: boolean;
};

const emptyForm = (): ProviderFormState => ({
  apiKey: "",
  baseUrl: "",
  clearApiKey: false,
});

const PROVIDER_LABEL: Record<AIProvider, string> = {
  gemini: "Gemini",
  avalai: "AvalAI",
  arvan: "Arvan AIaaS",
  omniroute: "OmniRoute",
};

export default function SettingsPage() {
  const { jiraConnected } = useJiraApp();
  const { settings, loading, saveSettings, refresh, aiProvider, selectedModel, setAiProvider, setSelectedModel } =
    useAiSettings();

  const [forms, setForms] = useState<Record<AIProvider, ProviderFormState>>({
    gemini: emptyForm(),
    avalai: emptyForm(),
    arvan: emptyForm(),
    omniroute: { ...emptyForm(), baseUrl: OMNIROUTE_DEFAULT_BASE_URL },
  });
  const [defaultModels, setDefaultModels] = useState({
    gemini: "gemini-3.5-flash",
    avalai: "gpt-4o-mini",
    arvan: "Gemini-3-Flash-Preview",
    omniroute: "auto",
  });
  const [embeddingModels, setEmbeddingModels] = useState({
    gemini: DEFAULT_EMBEDDING_MODELS.gemini as string,
    avalai: DEFAULT_EMBEDDING_MODELS.avalai as string,
    arvan: DEFAULT_EMBEDDING_MODELS.arvan as string,
    omniroute: DEFAULT_EMBEDDING_MODELS.omniroute as string,
  });
  const [orchestratorModels, setOrchestratorModels] = useState({
    gemini: DEFAULT_ORCHESTRATOR_MODELS.gemini as string,
    avalai: DEFAULT_ORCHESTRATOR_MODELS.avalai as string,
    arvan: DEFAULT_ORCHESTRATOR_MODELS.arvan as string,
    omniroute: DEFAULT_ORCHESTRATOR_MODELS.omniroute as string,
  });
  const [subagentModels, setSubagentModels] = useState({
    gemini: DEFAULT_SUBAGENT_MODELS.gemini as string,
    avalai: DEFAULT_SUBAGENT_MODELS.avalai as string,
    arvan: DEFAULT_SUBAGENT_MODELS.arvan as string,
    omniroute: DEFAULT_SUBAGENT_MODELS.omniroute as string,
  });
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [clearTavily, setClearTavily] = useState(false);
  const [generation, setGeneration] = useState({
    temperature: "",
    topP: "",
    maxTokens: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<AIProvider | null>(null);
  const [testingEmbed, setTestingEmbed] = useState<AIProvider | null>(null);

  useEffect(() => {
    if (!settings) return;
    setDefaultModels(settings.defaultModels);
    if (settings.embeddingModels) {
      setEmbeddingModels(settings.embeddingModels);
    }
    if (settings.orchestratorModels) {
      setOrchestratorModels(settings.orchestratorModels);
    }
    if (settings.subagentModels) {
      setSubagentModels(settings.subagentModels);
    }
    setClearTavily(false);
    setTavilyApiKey("");
    setGeneration({
      temperature:
        settings.generation?.temperature != null
          ? String(settings.generation.temperature)
          : "",
      topP:
        settings.generation?.topP != null
          ? String(settings.generation.topP)
          : "",
      maxTokens:
        settings.generation?.maxTokens != null
          ? String(settings.generation.maxTokens)
          : "",
    });
    setForms((prev) => {
      const next = { ...prev };
      for (const p of settings.providers) {
        next[p.id] = {
          apiKey: "",
          baseUrl:
            p.baseUrl ||
            (p.id === "omniroute" ? OMNIROUTE_DEFAULT_BASE_URL : ""),
          clearApiKey: false,
        };
      }
      return next;
    });
  }, [settings]);

  const t = {
    title: "تنظیمات AI",
    subtitle: "پروایدرها، embedding و سرچ وب؛ ذخیره فقط روی سرور.",
    defaultProvider: "پروایدر پیش‌فرض",
    defaultModel: "مدل پیش‌فرض",
    embeddingModel: "مدل embedding",
    agentModelsTitle: "مدل‌های مصاحبه کارگاه",
    agentModelsDesc: "ارکستراتور قوی‌تر؛ ساب‌ایجنت‌ها سبک‌تر.",
    orchestratorModel: "مدل ارکستراتور",
    subagentModel: "مدل ساب‌ایجنت",
    modelHint: "مثل gpt-4o-mini — هر model id",
    generationTitle: "پارامترهای درخواست",
    generationDesc: "خالی = ارسال نشود (پیش‌فرض پروایدر).",
    temperature: "Temperature",
    topP: "Top P",
    maxTokens: "Max tokens",
    tavilyTitle: "سرچ وب (Tavily)",
    tavilyDesc: "برای صفحه Research.",
    save: "ذخیره تنظیمات",
    saving: "در حال ذخیره…",
    test: "تست اتصال",
    testEmbed: "تست embed",
    testing: "در حال تست…",
    apiKey: "API Key",
    apiKeyHint: "خالی بگذارید تا کلید فعلی عوض نشود",
    clearKey: "پاک کردن کلید ذخیره‌شده",
    baseUrl: "Base URL",
    configured: "پیکربندی شده",
    missing: "کلید ندارد",
    fromEnv: "از env",
    saved: "تنظیمات ذخیره شد",
    testOk: "اتصال برقرار شد",
    testFail: "تست اتصال ناموفق بود",
  };

  const parseGenNumber = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  const generationPayload = () => ({
    temperature: parseGenNumber(generation.temperature),
    topP: parseGenNumber(generation.topP),
    maxTokens: (() => {
      const n = parseGenNumber(generation.maxTokens);
      return n == null ? null : Math.round(n);
    })(),
  });

  const providerMeta = (id: AIProvider): PublicAiProvider | undefined =>
    settings?.providers.find((p) => p.id === id);

  const handleSave = async () => {
    setSaving(true);
    try {
      const providers: Array<{
        id: AIProvider;
        apiKey?: string | null;
        clearApiKey?: boolean;
        baseUrl?: string | null;
      }> = AI_PROVIDER_IDS.map((id) => {
        const form = forms[id];
        return {
          id,
          apiKey: form.apiKey.trim() || undefined,
          clearApiKey: form.clearApiKey || undefined,
          baseUrl:
            id === "gemini"
              ? undefined
              : form.baseUrl.trim() || null,
        };
      });

      await saveSettings({
        defaultProvider: aiProvider,
        defaultModels: {
          gemini: defaultModels.gemini.trim(),
          avalai: defaultModels.avalai.trim(),
          arvan: defaultModels.arvan.trim(),
          omniroute: defaultModels.omniroute.trim(),
        },
        embeddingModels: {
          gemini: embeddingModels.gemini.trim(),
          avalai: embeddingModels.avalai.trim(),
          arvan: embeddingModels.arvan.trim(),
          omniroute: embeddingModels.omniroute.trim(),
        },
        orchestratorModels: {
          gemini: orchestratorModels.gemini.trim(),
          avalai: orchestratorModels.avalai.trim(),
          arvan: orchestratorModels.arvan.trim(),
          omniroute: orchestratorModels.omniroute.trim(),
        },
        subagentModels: {
          gemini: subagentModels.gemini.trim(),
          avalai: subagentModels.avalai.trim(),
          arvan: subagentModels.arvan.trim(),
          omniroute: subagentModels.omniroute.trim(),
        },
        tavilyApiKey: tavilyApiKey.trim() || undefined,
        clearTavilyApiKey: clearTavily || undefined,
        generation: generationPayload(),
        providers,
      });
      setForms({
        gemini: { ...forms.gemini, apiKey: "", clearApiKey: false },
        avalai: { ...forms.avalai, apiKey: "", clearApiKey: false },
        arvan: { ...forms.arvan, apiKey: "", clearApiKey: false },
        omniroute: { ...forms.omniroute, apiKey: "", clearApiKey: false },
      });
      setTavilyApiKey("");
      setClearTavily(false);
      await refresh();
      toast.success(t.saved);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider: AIProvider, mode: "chat" | "embed" = "chat") => {
    if (mode === "embed") setTestingEmbed(provider);
    else setTesting(provider);
    try {
      await saveSettings({
        providers: [
          {
            id: provider,
            apiKey: forms[provider].apiKey.trim() || undefined,
            clearApiKey: forms[provider].clearApiKey || undefined,
            baseUrl:
              provider === "gemini"
                ? undefined
                : forms[provider].baseUrl.trim() || null,
          },
        ],
        defaultModels,
        embeddingModels,
        orchestratorModels,
        subagentModels,
        generation: generationPayload(),
      });
      const res = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t.testFail);
      }
      toast.success(
        `${t.testOk}: ${data.model || provider}${data.dims ? ` (${data.dims}d)` : ""}`
      );
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || t.testFail);
    } finally {
      setTesting(null);
      setTestingEmbed(null);
    }
  };

  const modelOptions = (provider: AIProvider) => {
    if (provider === "gemini") {
      return [
        { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
        { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
        { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
      ];
    }
    if (provider === "avalai") {
      return [
        { value: "gpt-4o-mini", label: "gpt-4o-mini" },
        { value: "gpt-4o", label: "gpt-4o" },
        { value: "gpt-4.1", label: "gpt-4.1" },
        { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
        { value: "o4-mini", label: "o4-mini" },
        { value: "claude-sonnet-4-20250514", label: "claude-sonnet-4" },
      ];
    }
    if (provider === "omniroute") {
      return [
        { value: "auto", label: "auto" },
        { value: "auto/coding", label: "auto/coding" },
        { value: "auto/fast", label: "auto/fast" },
        { value: "auto/cheap", label: "auto/cheap" },
      ];
    }
    return [
      { value: "Gemini-3-Flash-Preview", label: "Gemini-3-Flash-Preview" },
    ];
  };

  /** OpenAI-compatible gateways accept any model id — free text + suggestions. */
  const allowsCustomModel = (provider: AIProvider) =>
    provider === "avalai" || provider === "arvan" || provider === "omniroute";

  const updateModel = (provider: AIProvider, model: string) => {
    setDefaultModels((prev) => ({ ...prev, [provider]: model }));
    if (provider === aiProvider) {
      setSelectedModel(model);
    }
  };

  const renderRoleModelField = (
    provider: AIProvider,
    value: string,
    onChange: (model: string) => void,
    listSuffix: string
  ) => {
    if (!allowsCustomModel(provider)) {
      return (
        <SearchableSelect
          options={modelOptions(provider)}
          value={value}
          onChange={onChange}
          showSearch={false}
        />
      );
    }
    const listId = `ai-model-${listSuffix}-${provider}`;
    return (
      <>
        <Input
          list={listId}
          value={value}
          placeholder={t.modelHint}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const trimmed = value.trim();
            if (trimmed !== value) onChange(trimmed);
          }}
        />
        <datalist id={listId}>
          {modelOptions(provider).map((opt) => (
            <option key={opt.value} value={opt.value} />
          ))}
        </datalist>
      </>
    );
  };

  const renderModelField = (provider: AIProvider, value: string) => {
    if (!allowsCustomModel(provider)) {
      return (
        <SearchableSelect
          options={modelOptions(provider)}
          value={value}
          onChange={(val) => updateModel(provider, val)}
          showSearch={false}
        />
      );
    }
    const listId = `ai-model-suggestions-${provider}`;
    return (
      <>
        <Input
          list={listId}
          value={value}
          placeholder={t.modelHint}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => updateModel(provider, e.target.value)}
          onBlur={() => {
            const trimmed = value.trim();
            if (trimmed !== value) updateModel(provider, trimmed);
          }}
        />
        <datalist id={listId}>
          {modelOptions(provider).map((opt) => (
            <option key={opt.value} value={opt.value} />
          ))}
        </datalist>
      </>
    );
  };

  const baseUrlPlaceholder = (id: AIProvider) => {
    if (id === "avalai") return "https://api.avalai.ir/v1";
    if (id === "omniroute") return OMNIROUTE_DEFAULT_BASE_URL;
    return "https://your-arvan-gateway/v1";
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" dir="rtl">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="size-6 text-primary" />
          {t.title}
        </h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <JiraBoardSettings
        jiraConnected={jiraConnected}
      />

      {loading && !settings ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading…
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.defaultProvider}</CardTitle>
              <CardDescription>
                برای کارگاه، بورد روزانه و مترموست وقتی override نباشد.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>{t.defaultProvider}</FieldLabel>
                  <SearchableSelect
                    options={AI_PROVIDER_IDS.map((id) => ({
                      value: id,
                      label: PROVIDER_LABEL[id],
                    }))}
                    value={aiProvider}
                    onChange={(val) => setAiProvider(val as AIProvider)}
                    showSearch={false}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t.defaultModel}</FieldLabel>
                  {renderModelField(aiProvider, selectedModel)}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.agentModelsTitle}</CardTitle>
              <CardDescription>{t.agentModelsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>{t.orchestratorModel}</FieldLabel>
                  {renderRoleModelField(
                    aiProvider,
                    orchestratorModels[aiProvider],
                    (val) =>
                      setOrchestratorModels((prev) => ({
                        ...prev,
                        [aiProvider]: val,
                      })),
                    "orch"
                  )}
                </Field>
                <Field>
                  <FieldLabel>{t.subagentModel}</FieldLabel>
                  {renderRoleModelField(
                    aiProvider,
                    subagentModels[aiProvider],
                    (val) =>
                      setSubagentModels((prev) => ({
                        ...prev,
                        [aiProvider]: val,
                      })),
                    "sub"
                  )}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.generationTitle}</CardTitle>
              <CardDescription>{t.generationDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel>{t.temperature}</FieldLabel>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    max={2}
                    placeholder="خالی"
                    value={generation.temperature}
                    onChange={(e) =>
                      setGeneration((prev) => ({
                        ...prev,
                        temperature: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>{t.topP}</FieldLabel>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.05"
                    min={0}
                    max={1}
                    placeholder="خالی"
                    value={generation.topP}
                    onChange={(e) =>
                      setGeneration((prev) => ({
                        ...prev,
                        topP: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>{t.maxTokens}</FieldLabel>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={1}
                    placeholder="خالی"
                    value={generation.maxTokens}
                    onChange={(e) =>
                      setGeneration((prev) => ({
                        ...prev,
                        maxTokens: e.target.value,
                      }))
                    }
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.tavilyTitle}</CardTitle>
              <CardDescription>{t.tavilyDesc}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={settings?.tavilyConfigured ? "success" : "secondary"}
                >
                  {settings?.tavilyConfigured
                    ? settings.tavilyApiKeyLast4 === "env"
                      ? t.fromEnv
                      : `${t.configured}${settings.tavilyApiKeyLast4 ? ` ••••${settings.tavilyApiKeyLast4}` : ""}`
                    : t.missing}
                </Badge>
              </div>
              <Field>
                <FieldLabel className="flex items-center gap-1">
                  <KeyRound className="size-3.5" />
                  Tavily API Key
                </FieldLabel>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={t.apiKeyHint}
                  value={tavilyApiKey}
                  disabled={clearTavily}
                  onChange={(e) => setTavilyApiKey(e.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setClearTavily((v) => !v);
                  setTavilyApiKey("");
                }}
              >
                <Trash2 data-icon="inline-start" />
                {t.clearKey}
                {clearTavily ? " ✓" : ""}
              </Button>
            </CardContent>
          </Card>

          {AI_PROVIDER_IDS.map((id) => {
            const meta = providerMeta(id);
            const form = forms[id];
            const showBaseUrl =
              id === "avalai" || id === "arvan" || id === "omniroute";
            return (
              <Card key={id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {PROVIDER_LABEL[id]}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {id === "avalai" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href="/avalai/usage" />}
                        >
                          <Wallet data-icon="inline-start" />
                          مصرف و اعتبار
                        </Button>
                      ) : null}
                      <Badge variant={meta?.configured ? "success" : "secondary"}>
                        {meta?.configured
                          ? meta.apiKeyLast4 === "env"
                            ? t.fromEnv
                            : `${t.configured}${meta.apiKeyLast4 ? ` ••••${meta.apiKeyLast4}` : ""}`
                          : t.missing}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Field>
                    <FieldLabel className="flex items-center gap-1">
                      <KeyRound className="size-3.5" />
                      {t.apiKey}
                    </FieldLabel>
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder={t.apiKeyHint}
                      value={form.apiKey}
                      disabled={form.clearApiKey}
                      onChange={(e) =>
                        setForms((prev) => ({
                          ...prev,
                          [id]: { ...prev[id], apiKey: e.target.value },
                        }))
                      }
                    />
                  </Field>

                  {showBaseUrl && (
                    <Field>
                      <FieldLabel>{t.baseUrl}</FieldLabel>
                      <Input
                        type="url"
                        placeholder={baseUrlPlaceholder(id)}
                        value={form.baseUrl}
                        onChange={(e) =>
                          setForms((prev) => ({
                            ...prev,
                            [id]: { ...prev[id], baseUrl: e.target.value },
                          }))
                        }
                      />
                    </Field>
                  )}

                  <Field>
                    <FieldLabel>{t.defaultModel}</FieldLabel>
                    {renderModelField(id, defaultModels[id])}
                  </Field>

                  <Field>
                    <FieldLabel>{t.embeddingModel}</FieldLabel>
                    <Input
                      value={embeddingModels[id]}
                      placeholder={DEFAULT_EMBEDDING_MODELS[id]}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) =>
                        setEmbeddingModels((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                    />
                  </Field>

                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>{t.orchestratorModel}</FieldLabel>
                      {renderRoleModelField(
                        id,
                        orchestratorModels[id],
                        (val) =>
                          setOrchestratorModels((prev) => ({
                            ...prev,
                            [id]: val,
                          })),
                        `orch-${id}`
                      )}
                    </Field>
                    <Field>
                      <FieldLabel>{t.subagentModel}</FieldLabel>
                      {renderRoleModelField(
                        id,
                        subagentModels[id],
                        (val) =>
                          setSubagentModels((prev) => ({
                            ...prev,
                            [id]: val,
                          })),
                        `sub-${id}`
                      )}
                    </Field>
                  </FieldGroup>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForms((prev) => ({
                          ...prev,
                          [id]: {
                            ...prev[id],
                            clearApiKey: !prev[id].clearApiKey,
                            apiKey: "",
                          },
                        }))
                      }
                    >
                      <Trash2 data-icon="inline-start" />
                      {t.clearKey}
                      {form.clearApiKey ? " ✓" : ""}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={testing === id}
                      onClick={() => void handleTest(id, "chat")}
                    >
                      {testing === id ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <PlugZap data-icon="inline-start" />
                      )}
                      {testing === id ? t.testing : t.test}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testingEmbed === id}
                      onClick={() => void handleTest(id, "embed")}
                    >
                      {testingEmbed === id ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Sparkles data-icon="inline-start" />
                      )}
                      {testingEmbed === id ? t.testing : t.testEmbed}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Separator />

          <Alert>
            <AlertTitle>
              {"اولویت پیکربندی"}
            </AlertTitle>
            <AlertDescription>
              {"مقادیر ذخیره‌شده در SQLite بر متغیرهای محیطی (.env) اولویت دارند. اگر در Settings کلیدی نباشد، از env استفاده می‌شود."}
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {saving ? t.saving : t.save}
          </Button>
        </>
      )}
    </div>
  );
}
