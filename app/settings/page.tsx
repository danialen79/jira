"use client";

import { useEffect, useState } from "react";
import { KeyRound, PlugZap, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAiSettings,
  type PublicAiProvider,
} from "@/components/providers/ai-settings-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
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
import type { AIProvider } from "@/lib/ai-provider";

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

export default function SettingsPage() {
  const { language, isRtl } = useJiraApp();
  const { settings, loading, saveSettings, refresh, aiProvider, selectedModel, setAiProvider, setSelectedModel } =
    useAiSettings();

  const [forms, setForms] = useState<Record<AIProvider, ProviderFormState>>({
    gemini: emptyForm(),
    avalai: emptyForm(),
    arvan: emptyForm(),
  });
  const [defaultModels, setDefaultModels] = useState({
    gemini: "gemini-3.5-flash",
    avalai: "gpt-4o-mini",
    arvan: "Gemini-3-Flash-Preview",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<AIProvider | null>(null);

  useEffect(() => {
    if (!settings) return;
    setDefaultModels(settings.defaultModels);
    setForms((prev) => {
      const next = { ...prev };
      for (const p of settings.providers) {
        next[p.id] = {
          apiKey: "",
          baseUrl: p.baseUrl || "",
          clearApiKey: false,
        };
      }
      return next;
    });
  }, [settings]);

  const t =
    language === "fa"
      ? {
          title: "تنظیمات AI",
          subtitle: "پروایدرها و کلیدها؛ ذخیره فقط روی سرور.",
          defaultProvider: "پروایدر پیش‌فرض",
          defaultModel: "مدل پیش‌فرض",
          save: "ذخیره تنظیمات",
          saving: "در حال ذخیره…",
          test: "تست اتصال",
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
        }
      : {
          title: "AI Settings",
          subtitle: "Providers and keys; secrets stay on the server.",
          defaultProvider: "Default provider",
          defaultModel: "Default model",
          save: "Save settings",
          saving: "Saving…",
          test: "Test connection",
          testing: "Testing…",
          apiKey: "API Key",
          apiKeyHint: "Leave blank to keep the current key",
          clearKey: "Clear stored key",
          baseUrl: "Base URL",
          configured: "Configured",
          missing: "Not configured",
          fromEnv: "from env",
          saved: "Settings saved",
          testOk: "Connection succeeded",
          testFail: "Connection test failed",
        };

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
      }> = (["gemini", "avalai", "arvan"] as AIProvider[]).map((id) => {
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
        defaultModels,
        providers,
      });
      setForms({
        gemini: { ...forms.gemini, apiKey: "", clearApiKey: false },
        avalai: { ...forms.avalai, apiKey: "", clearApiKey: false },
        arvan: { ...forms.arvan, apiKey: "", clearApiKey: false },
      });
      await refresh();
      toast.success(t.saved);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider: AIProvider) => {
    setTesting(provider);
    try {
      // Persist current form for this provider first so test uses latest values
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
      });
      const res = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t.testFail);
      }
      toast.success(`${t.testOk}: ${data.model || provider}`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || t.testFail);
    } finally {
      setTesting(null);
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
      return [{ value: "gpt-4o-mini", label: "gpt-4o-mini" }];
    }
    return [
      { value: "Gemini-3-Flash-Preview", label: "Gemini-3-Flash-Preview" },
    ];
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="size-6 text-primary" />
          {t.title}
        </h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

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
                Used by Workspace, Daily Board, and Mattermost when no override is passed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>{t.defaultProvider}</FieldLabel>
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
                  <FieldLabel>{t.defaultModel}</FieldLabel>
                  <SearchableSelect
                    options={modelOptions(aiProvider)}
                    value={selectedModel}
                    onChange={(val) => {
                      setSelectedModel(val);
                      setDefaultModels((prev) => ({
                        ...prev,
                        [aiProvider]: val,
                      }));
                    }}
                    isRtl={isRtl}
                    showSearch={false}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {(["gemini", "avalai", "arvan"] as AIProvider[]).map((id) => {
            const meta = providerMeta(id);
            const form = forms[id];
            const showBaseUrl = id === "avalai" || id === "arvan";
            return (
              <Card key={id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base capitalize">{id === "arvan" ? "Arvan AIaaS" : id === "avalai" ? "AvalAI" : "Gemini"}</CardTitle>
                    <Badge variant={meta?.configured ? "success" : "secondary"}>
                      {meta?.configured
                        ? meta.apiKeyLast4 === "env"
                          ? t.fromEnv
                          : `${t.configured}${meta.apiKeyLast4 ? ` ••••${meta.apiKeyLast4}` : ""}`
                        : t.missing}
                    </Badge>
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
                        placeholder={
                          id === "avalai"
                            ? "https://api.avalai.ir/v1"
                            : "https://your-arvan-gateway/v1"
                        }
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
                    <SearchableSelect
                      options={modelOptions(id)}
                      value={defaultModels[id]}
                      onChange={(val) =>
                        setDefaultModels((prev) => ({ ...prev, [id]: val }))
                      }
                      isRtl={isRtl}
                      showSearch={false}
                    />
                  </Field>

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
                      onClick={() => void handleTest(id)}
                    >
                      {testing === id ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <PlugZap data-icon="inline-start" />
                      )}
                      {testing === id ? t.testing : t.test}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Separator />

          <Alert>
            <AlertTitle>
              {isRtl ? "اولویت پیکربندی" : "Config priority"}
            </AlertTitle>
            <AlertDescription>
              {isRtl
                ? "مقادیر ذخیره‌شده در SQLite بر متغیرهای محیطی (.env) اولویت دارند. اگر در Settings کلیدی نباشد، از env استفاده می‌شود."
                : "Values stored in SQLite override .env. If a key is empty in Settings, the environment fallback is used."}
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
