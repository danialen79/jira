"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AIProvider } from "@/lib/ai-providers";
import { DEFAULT_AI_MODELS } from "@/lib/ai-providers";

export type PublicAiProvider = {
  id: AIProvider;
  configured: boolean;
  apiKeyLast4: string | null;
  baseUrl: string | null;
  enabled: boolean;
};

export type PublicAiSettings = {
  defaultProvider: AIProvider;
  defaultModels: {
    gemini: string;
    avalai: string;
    arvan: string;
    omniroute: string;
  };
  providers: PublicAiProvider[];
};

type AiSettingsContextValue = {
  loading: boolean;
  settings: PublicAiSettings | null;
  aiProvider: AIProvider;
  selectedModel: string;
  setAiProvider: (provider: AIProvider) => void;
  setSelectedModel: (model: string) => void;
  refresh: () => Promise<void>;
  saveSettings: (
    patch: Partial<{
      defaultProvider: AIProvider;
      defaultModels: Partial<PublicAiSettings["defaultModels"]>;
      providers: Array<{
        id: AIProvider;
        apiKey?: string | null;
        clearApiKey?: boolean;
        baseUrl?: string | null;
        enabled?: boolean;
      }>;
    }>
  ) => Promise<PublicAiSettings>;
};

const DEFAULT_MODELS = DEFAULT_AI_MODELS;

const AiSettingsContext = createContext<AiSettingsContextValue | null>(null);

function modelForProvider(
  provider: AIProvider,
  models: PublicAiSettings["defaultModels"]
): string {
  return models[provider] || DEFAULT_MODELS[provider];
}

export function AiSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PublicAiSettings | null>(null);
  const [aiProvider, setAiProviderState] = useState<AIProvider>("gemini");
  const [selectedModel, setSelectedModelState] = useState<string>(
    DEFAULT_MODELS.gemini
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/ai");
      const data = (await res.json()) as PublicAiSettings;
      if (!res.ok) throw new Error((data as any).error || "Failed to load");
      setSettings(data);
      if (!hydrated.current) {
        setAiProviderState(data.defaultProvider);
        setSelectedModelState(
          modelForProvider(data.defaultProvider, data.defaultModels)
        );
        hydrated.current = true;
      }
    } catch (e) {
      console.error("Failed to load AI settings", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistDefaults = useCallback(
    (provider: AIProvider, model: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/settings/ai", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              defaultProvider: provider,
              defaultModels: { [provider]: model },
            }),
          });
          const data = await res.json();
          if (res.ok) setSettings(data);
        } catch (e) {
          console.error("Failed to persist AI defaults", e);
        }
      }, 400);
    },
    []
  );

  const setAiProvider = useCallback(
    (provider: AIProvider) => {
      setAiProviderState(provider);
      const models = settings?.defaultModels || DEFAULT_MODELS;
      const nextModel = modelForProvider(provider, models);
      setSelectedModelState(nextModel);
      persistDefaults(provider, nextModel);
    },
    [persistDefaults, settings?.defaultModels]
  );

  const setSelectedModel = useCallback(
    (model: string) => {
      setSelectedModelState(model);
      persistDefaults(aiProvider, model);
    },
    [aiProvider, persistDefaults]
  );

  const saveSettings = useCallback(
    async (
      patch: Partial<{
        defaultProvider: AIProvider;
        defaultModels: Partial<PublicAiSettings["defaultModels"]>;
        providers: Array<{
          id: AIProvider;
          apiKey?: string | null;
          clearApiKey?: boolean;
          baseUrl?: string | null;
          enabled?: boolean;
        }>;
      }>
    ) => {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setSettings(data);
      if (patch.defaultProvider) {
        setAiProviderState(patch.defaultProvider);
        const models = {
          ...(settings?.defaultModels || DEFAULT_MODELS),
          ...(patch.defaultModels || {}),
        };
        setSelectedModelState(
          modelForProvider(patch.defaultProvider, models as any)
        );
        hydrated.current = true;
      }
      return data as PublicAiSettings;
    },
    [settings?.defaultModels]
  );

  const value = useMemo(
    () => ({
      loading,
      settings,
      aiProvider,
      selectedModel,
      setAiProvider,
      setSelectedModel,
      refresh,
      saveSettings,
    }),
    [
      loading,
      settings,
      aiProvider,
      selectedModel,
      setAiProvider,
      setSelectedModel,
      refresh,
      saveSettings,
    ]
  );

  return (
    <AiSettingsContext.Provider value={value}>
      {children}
    </AiSettingsContext.Provider>
  );
}

export function useAiSettings(): AiSettingsContextValue {
  const ctx = useContext(AiSettingsContext);
  if (!ctx) {
    throw new Error("useAiSettings must be used within AiSettingsProvider");
  }
  return ctx;
}
