"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, RefreshCw, Sparkles, Unlink } from "lucide-react";
import { IssueKeyLink } from "@/components/issue-card/IssueKeyLink";
import SearchableSelect from "@/components/SearchableSelect";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LENS_OPTIONS,
  isStoryLens,
  type StoryLens,
} from "@/lib/lens";
import { selectableFixVersions } from "@/lib/fix-version-policy";
import { cn } from "@/lib/utils";

type InboxItem = {
  key: string;
  summary: string;
  description: string;
  status: string;
  issuetype: string;
  priority: string;
  updated: string;
  created: string;
  linkedSipKeys: string[];
  linkedSip?: { key: string; summary: string; type: string }[];
  reporter?: string;
  assignee?: string;
  assigneeDisplayName?: string;
};

type WorkshopForm = {
  issuetype: "Story" | "Bug";
  summary: string;
  description: string;
  selectedComponent: string;
  selectedPriority: string;
  selectedAssignee: string;
  selectedSprint: string;
  selectedRelease: string;
  epicKey: string;
  selectedLens: StoryLens | "";
};

type SipHit = {
  key: string;
  summary: string;
  status: string;
  issuetype: string;
  priority: string;
};

const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];

function defaultType(issuetype: string): "Story" | "Bug" {
  const t = issuetype.toLowerCase();
  if (t === "problem" || t === "bug" || t === "incident") return "Bug";
  return "Story";
}

function emptyForm(): WorkshopForm {
  return {
    issuetype: "Story",
    summary: "",
    description: "",
    selectedComponent: "",
    selectedPriority: "Medium",
    selectedAssignee: "",
    selectedSprint: "",
    selectedRelease: "",
    epicKey: "",
    selectedLens: "customer",
  };
}

function formFromPs(item: InboxItem): WorkshopForm {
  return {
    ...emptyForm(),
    issuetype: defaultType(item.issuetype),
    summary: item.summary || "",
    description: item.description || "",
    selectedPriority: item.priority || "Medium",
    selectedLens: "customer",
  };
}

export default function SupportInbox() {
  const {
    language,
    isRtl,
    jiraUrl,
    jiraConnected,
    componentNames,
    jiraUsers,
    jiraVersions,
    jiraSprints,
    existingEpics,
    refreshWorkspaceMeta,
    fetchExistingEpics,
  } = useJiraApp();
  const { aiProvider, selectedModel } = useAiSettings();

  const fa = language === "fa";
  const browse = (key: string) =>
    `${(jiraUrl || "").replace(/\/$/, "")}/browse/${key}`;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [form, setForm] = useState<WorkshopForm>(emptyForm());
  const [actionTab, setActionTab] = useState<"create" | "link">("create");
  const [promoting, setPromoting] = useState(false);

  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [statusTarget, setStatusTarget] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  const [sipQuery, setSipQuery] = useState("");
  const [sipHits, setSipHits] = useState<SipHit[]>([]);
  const [sipSearching, setSipSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const [aiDrafting, setAiDrafting] = useState(false);

  const [capacityVersionId, setCapacityVersionId] = useState("");
  const [capacity, setCapacity] = useState<{
    total: number;
    fromPs: number;
    pct: number;
    targetPct: number;
  } | null>(null);

  const unreleasedVersions = useMemo(
    () => selectableFixVersions(jiraVersions || []),
    [jiraVersions]
  );

  const loadInbox = useCallback(async () => {
    if (!jiraConnected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/jira/support/inbox");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load inbox");
      const list: InboxItem[] = data.issues || [];
      setItems(list);
      setSelectedKey((prev) => {
        if (prev && list.some((i) => i.key === prev)) return prev;
        return list[0]?.key || null;
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Inbox load failed");
    } finally {
      setLoading(false);
    }
  }, [jiraConnected]);

  const loadDetail = useCallback(async (key: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/jira/support/issue?key=${encodeURIComponent(key)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load issue");
      const issue = data.issue as InboxItem;
      setDetail(issue);
      setForm(formFromPs(issue));
      setComment("");
      setStatusTarget("");

      const tr = await fetch(
        `/api/jira/issues/transitions?issueKey=${encodeURIComponent(key)}`
      );
      const trData = await tr.json();
      if (tr.ok) {
        setStatuses(trData.statuses || []);
      } else {
        setStatuses([]);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Detail load failed");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshWorkspaceMeta();
    void fetchExistingEpics();
  }, [refreshWorkspaceMeta, fetchExistingEpics]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (selectedKey) void loadDetail(selectedKey);
  }, [selectedKey, loadDetail]);

  useEffect(() => {
    if (!capacityVersionId) {
      setCapacity(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/jira/support/capacity?versionId=${encodeURIComponent(capacityVersionId)}`
        );
        const data = await res.json();
        if (!res.ok || cancelled) return;
        setCapacity({
          total: data.total || 0,
          fromPs: data.fromPs || 0,
          pct: data.pct || 0,
          targetPct: data.targetPct || 20,
        });
      } catch {
        if (!cancelled) setCapacity(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capacityVersionId]);

  useEffect(() => {
    if (actionTab !== "link") return;
    const q = sipQuery.trim();
    if (q.length < 2) {
      setSipHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSipSearching(true);
      try {
        const res = await fetch(
          `/api/jira/support/sip-search?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (res.ok) setSipHits(data.issues || []);
      } finally {
        setSipSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [sipQuery, actionTab]);

  const componentOptions = useMemo(
    () => componentNames.map((n) => ({ value: n, label: n })),
    [componentNames]
  );
  const userOptions = useMemo(
    () =>
      jiraUsers
        .map((u) => ({
          value: u.name || "",
          label: u.displayName || u.name || "",
          sublabel: u.name,
        }))
        .filter((o) => o.value),
    [jiraUsers]
  );
  const versionOptions = useMemo(
    () =>
      unreleasedVersions.map((v: { id: string; name: string }) => ({
        value: String(v.id),
        label: v.name,
      })),
    [unreleasedVersions]
  );
  const sprintOptions = useMemo(
    () =>
      (jiraSprints || []).map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    [jiraSprints]
  );
  const epicOptions = useMemo(
    () =>
      (existingEpics || []).map((e) => ({
        value: e.key,
        label: `${e.key} — ${e.summary || ""}`,
      })),
    [existingEpics]
  );

  async function handlePromote() {
    if (!detail) return;
    if (form.issuetype === "Story" && !isStoryLens(form.selectedLens)) {
      toast.error(fa ? "لنز را انتخاب کنید." : "Pick a Lens.");
      return;
    }
    setPromoting(true);
    try {
      const res = await fetch("/api/jira/support/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          psKey: detail.key,
          issue: {
            summary: form.summary,
            description: form.description,
            issuetype: form.issuetype,
            selectedComponent: form.selectedComponent || undefined,
            selectedPriority: form.selectedPriority || undefined,
            selectedAssignee: form.selectedAssignee || undefined,
            selectedSprint: form.selectedSprint || undefined,
            selectedRelease: form.epicKey ? "" : form.selectedRelease,
            epicKey: form.epicKey || undefined,
            selectedLens:
              form.issuetype === "Story" ? form.selectedLens : undefined,
            fromPs: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Promote failed");
      toast.success(
        fa
          ? `ساخته شد: ${data.sipKey}`
          : `Created ${data.sipKey}`
      );
      await loadDetail(detail.key);
      await loadInbox();
      if (capacityVersionId) {
        setCapacityVersionId((v) => v); // trigger refresh via effect by toggling
        const capRes = await fetch(
          `/api/jira/support/capacity?versionId=${encodeURIComponent(capacityVersionId)}`
        );
        const cap = await capRes.json();
        if (capRes.ok) {
          setCapacity({
            total: cap.total || 0,
            fromPs: cap.fromPs || 0,
            pct: cap.pct || 0,
            targetPct: cap.targetPct || 20,
          });
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Promote failed");
    } finally {
      setPromoting(false);
    }
  }

  async function handleLinkExisting(sipKey: string) {
    if (!detail) return;
    if (detail.linkedSipKeys?.some((k) => k.toUpperCase() === sipKey.toUpperCase())) {
      toast.error(fa ? "قبلاً لینک شده." : "Already linked.");
      return;
    }
    setLinking(true);
    try {
      const res = await fetch("/api/jira/support/link-existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ psKey: detail.key, sipKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Link failed");
      toast.success(fa ? `لینک شد به ${sipKey}` : `Linked to ${sipKey}`);
      await loadDetail(detail.key);
      await loadInbox();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Link failed");
    } finally {
      setLinking(false);
    }
  }

  async function handleComment() {
    if (!detail || !comment.trim()) return;
    setCommenting(true);
    try {
      const res = await fetch("/api/jira/issue-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: detail.key, body: comment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Comment failed");
      toast.success(fa ? "کامنت ثبت شد." : "Comment added.");
      setComment("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setCommenting(false);
    }
  }

  async function handleTransition() {
    if (!detail || !statusTarget) return;
    setTransitioning(true);
    try {
      const res = await fetch("/api/jira/issues/transitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: detail.key,
          statusName: statusTarget,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transition failed");
      toast.success(
        fa
          ? `وضعیت: ${data.transitionedTo}`
          : `Status → ${data.transitionedTo}`
      );
      await loadDetail(detail.key);
      await loadInbox();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

  async function handleAiDraft() {
    if (!detail) return;
    setAiDrafting(true);
    try {
      const res = await fetch("/api/refine-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: form.summary || detail.summary,
          description: form.description || detail.description,
          issuetype: form.issuetype,
          draftText: `Support ticket ${detail.key} (${detail.issuetype}):\n${detail.summary}\n\n${detail.description}`,
          customPrompt:
            "Rewrite as a clear delivery ticket for the engineering team. Keep the customer problem explicit. Output concise summary and structured description with acceptance criteria.",
          provider: aiProvider,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI draft failed");
      setForm((f) => ({
        ...f,
        summary: data.summary || f.summary,
        description: data.description || f.description,
      }));
      toast.success(fa ? "پیش‌نویس AI آماده شد." : "AI draft ready.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "AI draft failed");
    } finally {
      setAiDrafting(false);
    }
  }

  if (!jiraConnected) {
    return (
      <p className="text-sm text-muted-foreground">
        {fa ? "در Settings به جیرا وصل شوید." : "Connect Jira in Settings."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Capacity strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {fa ? "ظرفیت from-ps" : "from-ps capacity"}
        </span>
        <div className="w-48">
          <SearchableSelect
            options={versionOptions}
            value={capacityVersionId}
            onChange={setCapacityVersionId}
            placeholder={fa ? "ورژن SIP" : "SIP version"}
            isRtl={isRtl}
          />
        </div>
        {capacity ? (
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                {capacity.fromPs}/{capacity.total} ({capacity.pct}%)
              </span>
              <span>target {capacity.targetPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  capacity.pct >= capacity.targetPct
                    ? "bg-emerald-600"
                    : "bg-primary"
                )}
                style={{
                  width: `${Math.min(100, capacity.pct)}%`,
                }}
              />
            </div>
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadInbox()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </Button>
      </div>

      <div className="grid min-h-[70vh] grid-cols-1 gap-3 lg:grid-cols-12">
        {/* List */}
        <div className="flex flex-col gap-1 overflow-hidden rounded-lg border lg:col-span-3">
          <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            {fa ? `صف من (${items.length})` : `My queue (${items.length})`}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Spinner /> {fa ? "بارگذاری…" : "Loading…"}
              </div>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {fa ? "ایشویی assign نیست." : "Nothing assigned."}
              </p>
            ) : (
              items.map((item) => {
                const linked = (item.linkedSipKeys || []).length > 0;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedKey(item.key)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b px-3 py-2.5 text-start transition-colors hover:bg-muted/50",
                      selectedKey === item.key && "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-primary">
                        {item.key}
                      </span>
                      {linked ? (
                        <Badge
                          variant="secondary"
                          className="gap-0.5 px-1 py-0 text-[10px]"
                        >
                          <Link2 className="size-2.5" />
                          SIP
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-0.5 px-1 py-0 text-[10px] text-muted-foreground"
                        >
                          <Unlink className="size-2.5" />
                        </Badge>
                      )}
                    </div>
                    <span className="line-clamp-2 text-xs leading-snug">
                      {item.summary}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.issuetype} · {item.status} · {item.priority}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-lg border p-3 lg:col-span-4">
          {detailLoading && !detail ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
            </div>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground">
              {fa ? "یک ایشو انتخاب کنید." : "Select an issue."}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <IssueKeyLink href={browse(detail.key)} issueKey={detail.key} />
                <Badge variant="outline">{detail.status}</Badge>
                <Badge variant="secondary">{detail.issuetype}</Badge>
                <Badge variant="outline">{detail.priority}</Badge>
              </div>
              <h3 className="text-sm font-semibold leading-snug">
                {detail.summary}
              </h3>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 font-sans text-xs leading-relaxed">
                {detail.description || (fa ? "(بدون توضیح)" : "(no description)")}
              </div>

              {(detail.linkedSip || []).length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {fa ? "لینک‌های SIP" : "Linked SIP"}
                  </span>
                  {(detail.linkedSip || []).map((l) => (
                    <IssueKeyLink
                      key={l.key}
                      href={browse(l.key)}
                      issueKey={l.key}
                    />
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 border-t pt-3">
                <Field>
                  <FieldLabel>
                    {fa ? "کامنت" : "Comment"}
                  </FieldLabel>
                  <Textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={fa ? "متن کامنت…" : "Comment…"}
                  />
                </Field>
                <Button
                  type="button"
                  size="sm"
                  disabled={commenting || !comment.trim()}
                  onClick={() => void handleComment()}
                >
                  {commenting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {fa ? "ثبت کامنت" : "Add comment"}
                </Button>
              </div>

              <div className="flex flex-col gap-2 border-t pt-3">
                <Field>
                  <FieldLabel>
                    {fa ? "وضعیت" : "Status"}
                  </FieldLabel>
                  <SearchableSelect
                    options={statuses.map((s) => ({ value: s, label: s }))}
                    value={statusTarget}
                    onChange={setStatusTarget}
                    placeholder={fa ? "انتقال به…" : "Transition to…"}
                    isRtl={isRtl}
                  />
                </Field>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={transitioning || !statusTarget}
                  onClick={() => void handleTransition()}
                >
                  {transitioning ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {fa ? "اعمال وضعیت" : "Apply status"}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 overflow-y-auto rounded-lg border p-3 lg:col-span-5">
          <ToggleGroup
            value={[actionTab]}
            onValueChange={(values) => {
              if (!values.length) return;
              const next = values[0];
              if (next === "create" || next === "link") setActionTab(next);
            }}
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <ToggleGroupItem value="create">
              {fa ? "ساخت در SIP" : "Create in SIP"}
            </ToggleGroupItem>
            <ToggleGroupItem value="link">
              {fa ? "لینک موجود" : "Link existing"}
            </ToggleGroupItem>
          </ToggleGroup>

          {!detail ? (
            <p className="text-sm text-muted-foreground">
              {fa ? "اول ایشو را انتخاب کنید." : "Select a PS issue first."}
            </p>
          ) : actionTab === "create" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={aiDrafting}
                  onClick={() => void handleAiDraft()}
                >
                  {aiDrafting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {fa ? "پیش‌نویس AI" : "AI draft"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <SearchableSelect
                    options={[
                      { value: "Story", label: "Story" },
                      { value: "Bug", label: "Bug" },
                    ]}
                    value={form.issuetype}
                    onChange={(val) =>
                      setForm((f) => ({
                        ...f,
                        issuetype: val as "Story" | "Bug",
                        selectedLens:
                          val === "Story" ? f.selectedLens || "customer" : "",
                      }))
                    }
                    isRtl={isRtl}
                  />
                </Field>
                {form.issuetype === "Story" ? (
                  <Field>
                    <FieldLabel>Lens</FieldLabel>
                    <SearchableSelect
                      options={LENS_OPTIONS.map((o) => ({
                        value: o.value,
                        label: fa ? o.labelFa : o.labelEn,
                      }))}
                      value={form.selectedLens || ""}
                      onChange={(val) =>
                        setForm((f) => ({
                          ...f,
                          selectedLens: val as StoryLens,
                        }))
                      }
                      isRtl={isRtl}
                    />
                  </Field>
                ) : (
                  <div />
                )}
              </div>

              <Field>
                <FieldLabel>Summary</FieldLabel>
                <Input
                  value={form.summary}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, summary: e.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  rows={6}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel>Component</FieldLabel>
                  <SearchableSelect
                    options={componentOptions}
                    value={form.selectedComponent}
                    onChange={(val) =>
                      setForm((f) => ({ ...f, selectedComponent: val }))
                    }
                    placeholder="—"
                    isRtl={isRtl}
                  />
                </Field>
                <Field>
                  <FieldLabel>Priority</FieldLabel>
                  <SearchableSelect
                    options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                    value={form.selectedPriority}
                    onChange={(val) =>
                      setForm((f) => ({ ...f, selectedPriority: val }))
                    }
                    isRtl={isRtl}
                  />
                </Field>
                <Field>
                  <FieldLabel>Assignee</FieldLabel>
                  <SearchableSelect
                    options={userOptions}
                    value={form.selectedAssignee}
                    onChange={(val) =>
                      setForm((f) => ({ ...f, selectedAssignee: val }))
                    }
                    placeholder="—"
                    isRtl={isRtl}
                  />
                </Field>
                <Field>
                  <FieldLabel>Epic</FieldLabel>
                  <div className="flex gap-1">
                    <SearchableSelect
                      className="flex-1"
                      options={epicOptions}
                      value={form.epicKey}
                      onChange={(val) =>
                        setForm((f) => ({
                          ...f,
                          epicKey: val,
                          selectedRelease: val ? "" : f.selectedRelease,
                        }))
                      }
                      placeholder="—"
                      isRtl={isRtl}
                    />
                    {form.epicKey ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setForm((f) => ({ ...f, epicKey: "" }))
                        }
                      >
                        ×
                      </Button>
                    ) : null}
                  </div>
                </Field>
                {!form.epicKey ? (
                  <Field>
                    <FieldLabel>Fix Version</FieldLabel>
                    <SearchableSelect
                      options={versionOptions}
                      value={form.selectedRelease}
                      onChange={(val) =>
                        setForm((f) => ({ ...f, selectedRelease: val }))
                      }
                      placeholder="—"
                      isRtl={isRtl}
                    />
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel>Sprint</FieldLabel>
                  <SearchableSelect
                    options={sprintOptions}
                    value={form.selectedSprint}
                    onChange={(val) =>
                      setForm((f) => ({ ...f, selectedSprint: val }))
                    }
                    placeholder="—"
                    isRtl={isRtl}
                  />
                </Field>
              </div>

              <Button
                type="button"
                disabled={promoting || !form.summary.trim()}
                onClick={() => void handlePromote()}
              >
                {promoting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {fa ? "بساز و لینک کن" : "Create & link"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(detail.linkedSipKeys || []).length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {fa
                    ? `لینک‌شده: ${(detail.linkedSipKeys || []).join(", ")}`
                    : `Already linked: ${(detail.linkedSipKeys || []).join(", ")}`}
                </p>
              ) : null}
              <Field>
                <FieldLabel>
                  {fa ? "جستجوی SIP" : "Search SIP"}
                </FieldLabel>
                <Input
                  value={sipQuery}
                  onChange={(e) => setSipQuery(e.target.value)}
                  placeholder={fa ? "کلید یا خلاصه…" : "Key or summary…"}
                />
              </Field>
              {sipSearching ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner /> {fa ? "جستجو…" : "Searching…"}
                </div>
              ) : null}
              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {sipHits.map((hit) => {
                  const already = (detail.linkedSipKeys || []).some(
                    (k) => k.toUpperCase() === hit.key.toUpperCase()
                  );
                  return (
                    <div
                      key={hit.key}
                      className="flex items-start justify-between gap-2 rounded-md border px-2 py-2"
                    >
                      <div className="min-w-0">
                        <IssueKeyLink
                          href={browse(hit.key)}
                          issueKey={hit.key}
                        />
                        <p className="line-clamp-2 text-xs">{hit.summary}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {hit.issuetype} · {hit.status}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={already ? "secondary" : "default"}
                        disabled={linking || already}
                        onClick={() => void handleLinkExisting(hit.key)}
                      >
                        {already
                          ? fa
                            ? "لینک‌شده"
                            : "Linked"
                          : fa
                            ? "لینک"
                            : "Link"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
