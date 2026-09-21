"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  ConnectionConfig,
  JiraComponent,
  JiraEpic,
  JiraSprint,
  JiraUser,
  JiraVersion,
  RefinedIssue,
} from "@/lib/types";
import type { AIProvider } from "@/lib/ai-providers";

const appTranslations = {
  toastSuccess: "تیکت‌ها اصلاح شدند.",
  toastError: "اصلاح ناموفق بود. ورودی‌ها را بررسی کنید.",
  jiraStatus: "جیرا",
  connected: "متصل",
  disconnected: "پیکربندی نشده",
  tabHealth: "سلامت",
  tabWorkspace: "کارگاه",
  tabDailyBoard: "بورد روزانه",
  tabSupport: "ساپورت",
  tabBacklog: "بک‌لاگ",
  tabSprint: "اسپرینت",
  tabMattermost: "مترموست",
  tabEpicSync: "همگام‌سازی اپیک",
  tabRoadmap: "رودمپ",
  tabProducts: "پروداکت‌ها",
  tabKnowledge: "دانش",
  tabResearch: "Research",
  tabAvalaiUsage: "مصرف AvalAI",
  tabSettings: "تنظیمات AI",
  heroTitle: "جیرا AI",
  heroSubtitle: "پیش‌نویس، مصاحبه، دانش و انتشار.",
  supportSubtitle: "صف PS → بررسی، کامنت، ساخت یا لینک SIP.",
  draftSection: "۱. پیش‌نویس و اصلاح",
  boardSection: "۲. بازبینی و انتشار",
} as const;

type AppTranslations = typeof appTranslations;

interface JiraSessionUser {
  name?: string;
  displayName?: string;
  emailAddress?: string;
}

interface JiraAppContextValue {
  t: AppTranslations;
  jiraUrl: string;
  jiraUsername: string;
  projectKey: string;
  config: ConnectionConfig;
  jiraConnected: boolean;
  jiraConfigured: boolean;
  jiraUser: JiraSessionUser | null;
  connectionError: string | null;
  refreshingConnection: boolean;
  refreshConnection: () => Promise<void>;
  existingEpics: JiraEpic[];
  fetchingEpics: boolean;
  fetchExistingEpics: () => Promise<void>;
  availableComponents: JiraComponent[];
  fetchingComponents: boolean;
  fetchComponents: () => Promise<void>;
  manualComponentsText: string;
  setManualComponentsText: React.Dispatch<React.SetStateAction<string>>;
  componentNames: string[];
  jiraUsers: JiraUser[];
  fetchingUsers: boolean;
  fetchJiraUsers: () => Promise<void>;
  jiraVersions: JiraVersion[];
  fetchingVersions: boolean;
  fetchJiraVersions: () => Promise<void>;
  jiraSprints: JiraSprint[];
  fetchingSprints: boolean;
  fetchJiraSprints: () => Promise<void>;
  issues: RefinedIssue[];
  setIssues: React.Dispatch<React.SetStateAction<RefinedIssue[]>>;
  refining: boolean;
  handleRefine: (
    draftText: string,
    customPrompt: string,
    provider: AIProvider,
    model: string,
    outputMode: string
  ) => Promise<void>;
  clearIssues: () => void;
  importedDraftText: string | undefined;
  handleImportMattermostDraft: (text: string) => void;
  refreshWorkspaceMeta: () => void;
}

const JiraAppContext = createContext<JiraAppContextValue | null>(null);

export function useJiraApp() {
  const ctx = useContext(JiraAppContext);
  if (!ctx) {
    throw new Error("useJiraApp must be used within JiraAppProvider");
  }
  return ctx;
}

const defaultConfig: ConnectionConfig = {
  epicNameField: "customfield_10008",
  epicLinkField: "customfield_10014",
  sprintFieldId: "customfield_10010",
};

export function JiraAppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = appTranslations;

  const [importedDraftText, setImportedDraftText] = useState<string | undefined>();
  const [jiraUrl, setJiraUrl] = useState("");
  const [jiraUsername, setJiraUsername] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [config, setConfig] = useState<ConnectionConfig>(defaultConfig);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraUser, setJiraUser] = useState<JiraSessionUser | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [refreshingConnection, setRefreshingConnection] = useState(false);

  const [existingEpics, setExistingEpics] = useState<JiraEpic[]>([]);
  const [fetchingEpics, setFetchingEpics] = useState(false);
  const [availableComponents, setAvailableComponents] = useState<JiraComponent[]>([]);
  const [fetchingComponents, setFetchingComponents] = useState(false);
  const [manualComponentsText, setManualComponentsText] = useState("");
  const [jiraUsers, setJiraUsers] = useState<JiraUser[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [jiraVersions, setJiraVersions] = useState<JiraVersion[]>([]);
  const [fetchingVersions, setFetchingVersions] = useState(false);
  const [jiraSprints, setJiraSprints] = useState<JiraSprint[]>([]);
  const [fetchingSprints, setFetchingSprints] = useState(false);
  const [issues, setIssues] = useState<RefinedIssue[]>([]);
  const [refining, setRefining] = useState(false);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [issuesRes, compsRes] = await Promise.all([
          fetch("/api/kv/workspace/refined_issues"),
          fetch("/api/kv/workspace/manual_components"),
        ]);
        if (cancelled) return;
        if (issuesRes.ok) {
          const data = await issuesRes.json();
          if (Array.isArray(data.value)) setIssues(data.value);
        }
        if (compsRes.ok) {
          const data = await compsRes.json();
          const text =
            typeof data.value === "string"
              ? data.value
              : data.value?.text;
          if (typeof text === "string") setManualComponentsText(text);
        }
        // Clear legacy client-side secrets if present
        localStorage.removeItem("jira_creds");
        localStorage.removeItem("jira_project_key");
        localStorage.removeItem("jira_config");
      } catch (e) {
        console.error("Error loading saved settings", e);
      } finally {
        if (!cancelled) setWorkspaceHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceHydrated) return;
    const timer = setTimeout(() => {
      void fetch("/api/kv/workspace/refined_issues", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: issues }),
      }).catch((e) => console.error("Failed to persist refined issues", e));
    }, 400);
    return () => clearTimeout(timer);
  }, [issues, workspaceHydrated]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    const timer = setTimeout(() => {
      void fetch("/api/kv/workspace/manual_components", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: { text: manualComponentsText } }),
      }).catch((e) => console.error("Failed to persist manual components", e));
    }, 400);
    return () => clearTimeout(timer);
  }, [manualComponentsText, workspaceHydrated]);

  const refreshConnection = useCallback(async () => {
    setRefreshingConnection(true);
    try {
      const response = await fetch("/api/jira/test");
      const data = await response.json();
      setJiraConfigured(!!data.configured);
      setJiraConnected(!!data.connected && !!data.success);
      setJiraUrl(data.url || "");
      setProjectKey(data.projectKey || "");
      if (data.config) setConfig(data.config);
      if (data.user) {
        setJiraUser(data.user);
        setJiraUsername(data.user.name || "");
      } else {
        setJiraUser(null);
        setJiraUsername("");
      }
      setConnectionError(data.error || null);
    } catch (err: unknown) {
      setJiraConnected(false);
      setJiraConfigured(false);
      setConnectionError(
        err instanceof Error ? err.message : "Failed to reach Jira status endpoint"
      );
    } finally {
      setRefreshingConnection(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection]);

  const fetchExistingEpics = useCallback(async () => {
    if (!jiraConnected) return;
    setFetchingEpics(true);
    try {
      const response = await fetch("/api/jira/epics");
      const data = await response.json();
      if (response.ok && data.success) {
        setExistingEpics(data.epics || []);
      }
    } catch (e) {
      console.error("Failed to fetch existing Jira epics", e);
    } finally {
      setFetchingEpics(false);
    }
  }, [jiraConnected]);

  const fetchComponents = useCallback(async () => {
    if (!jiraConnected) return;
    setFetchingComponents(true);
    try {
      const response = await fetch("/api/jira/components");
      const data = await response.json();
      if (response.ok && data.success) {
        setAvailableComponents(data.components || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira components", e);
    } finally {
      setFetchingComponents(false);
    }
  }, [jiraConnected]);

  const fetchJiraUsers = useCallback(async () => {
    if (!jiraConnected) return;
    setFetchingUsers(true);
    try {
      const response = await fetch("/api/jira/users");
      const data = await response.json();
      if (response.ok && data.success) {
        setJiraUsers(data.users || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira users", e);
    } finally {
      setFetchingUsers(false);
    }
  }, [jiraConnected]);

  const fetchJiraVersions = useCallback(async () => {
    if (!jiraConnected) return;
    setFetchingVersions(true);
    try {
      const response = await fetch("/api/jira/versions");
      const data = await response.json();
      if (response.ok && data.success) {
        setJiraVersions(data.versions || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira versions", e);
    } finally {
      setFetchingVersions(false);
    }
  }, [jiraConnected]);

  const fetchJiraSprints = useCallback(async () => {
    if (!jiraConnected) return;
    setFetchingSprints(true);
    try {
      const response = await fetch("/api/jira/sprints");
      const data = await response.json();
      if (response.ok && data.success) {
        setJiraSprints(data.sprints || []);
      }
    } catch (e) {
      console.error("Failed to fetch Jira sprints", e);
    } finally {
      setFetchingSprints(false);
    }
  }, [jiraConnected]);

  useEffect(() => {
    if (jiraConnected) {
      void fetchExistingEpics();
      void fetchComponents();
      void fetchJiraUsers();
      void fetchJiraVersions();
      void fetchJiraSprints();
    } else {
      setExistingEpics([]);
      setAvailableComponents([]);
      setJiraUsers([]);
      setJiraVersions([]);
      setJiraSprints([]);
    }
  }, [
    jiraConnected,
    fetchExistingEpics,
    fetchComponents,
    fetchJiraUsers,
    fetchJiraVersions,
    fetchJiraSprints,
  ]);

  const componentNames = useMemo(
    () =>
      [
        ...availableComponents.map((c) => c.name),
        ...manualComponentsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ].filter((v, i, self) => self.indexOf(v) === i),
    [availableComponents, manualComponentsText]
  );

  const handleRefine = useCallback(
    async (
      draftText: string,
      customPrompt: string,
      provider: AIProvider,
      model: string,
      outputMode: string
    ) => {
      setRefining(true);
      try {
        const response = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftText,
            customPrompt,
            projectKey,
            model,
            outputMode,
            provider,
          }),
        });

        const data = await response.json();
        if (response.ok && data.issues) {
          const existingComps = [
            ...availableComponents.map((c) => c.name),
            ...manualComponentsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ].filter((v, i, self) => self.indexOf(v) === i);

          const newCompsToRegister: string[] = [];
          data.issues.forEach((issue: { suggestedComponent?: string }) => {
            if (issue.suggestedComponent) {
              const sug = issue.suggestedComponent.trim();
              if (
                sug &&
                !existingComps.some((c) => c.toLowerCase() === sug.toLowerCase())
              ) {
                if (
                  !newCompsToRegister.some(
                    (r) => r.toLowerCase() === sug.toLowerCase()
                  )
                ) {
                  newCompsToRegister.push(sug);
                }
              }
            }
          });

          if (newCompsToRegister.length > 0) {
            const currentManual = manualComponentsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const updatedManual = [...currentManual, ...newCompsToRegister].filter(
              (v, i, self) => self.indexOf(v) === i
            );
            setManualComponentsText(updatedManual.join(", "));
            existingComps.push(...newCompsToRegister);
          }

          const formatted: RefinedIssue[] = data.issues.map(
            (issue: RefinedIssue & { suggestedComponent?: string }) => {
              let matchedComponent = "";
              if (issue.suggestedComponent) {
                const sug = issue.suggestedComponent.toLowerCase().trim();
                const found = existingComps.find((c) => {
                  const name = c.toLowerCase().trim();
                  return name === sug || name.includes(sug) || sug.includes(name);
                });
                matchedComponent = found || issue.suggestedComponent.trim();
              }

              return {
                ...issue,
                status: "draft" as const,
                selectedPriority: issue.suggestedPriority || "Medium",
                selectedComponent: matchedComponent || undefined,
              };
            }
          );

          setIssues(formatted);
          toast.success(t.toastSuccess);
          setTimeout(() => {
            document
              .getElementById("refined-board-panel")
              ?.scrollIntoView({ behavior: "smooth" });
          }, 300);
        } else {
          toast.error(data.error || t.toastError);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "ارتباط با سرویس اصلاح برقرار نشد.";
        toast.error(message);
      } finally {
        setRefining(false);
      }
    },
    [availableComponents, manualComponentsText, projectKey, t]
  );

  const clearIssues = useCallback(() => {
    setIssues([]);
  }, []);

  const handleImportMattermostDraft = useCallback(
    (text: string) => {
      setImportedDraftText(text);
      router.push("/workspace");
      setTimeout(() => {
        setImportedDraftText(undefined);
      }, 150);
    },
    [router]
  );

  const refreshWorkspaceMeta = useCallback(() => {
    if (jiraConnected) {
      void fetchExistingEpics();
      void fetchComponents();
      void fetchJiraUsers();
    }
  }, [jiraConnected, fetchExistingEpics, fetchComponents, fetchJiraUsers]);

  const value: JiraAppContextValue = {
    t,
    jiraUrl,
    jiraUsername,
    projectKey,
    config,
    jiraConnected,
    jiraConfigured,
    jiraUser,
    connectionError,
    refreshingConnection,
    refreshConnection,
    existingEpics,
    fetchingEpics,
    fetchExistingEpics,
    availableComponents,
    fetchingComponents,
    fetchComponents,
    manualComponentsText,
    setManualComponentsText,
    componentNames,
    jiraUsers,
    fetchingUsers,
    fetchJiraUsers,
    jiraVersions,
    fetchingVersions,
    fetchJiraVersions,
    jiraSprints,
    fetchingSprints,
    fetchJiraSprints,
    issues,
    setIssues,
    refining,
    handleRefine,
    clearIssues,
    importedDraftText,
    handleImportMattermostDraft,
    refreshWorkspaceMeta,
  };

  return (
    <JiraAppContext.Provider value={value}>{children}</JiraAppContext.Provider>
  );
}
