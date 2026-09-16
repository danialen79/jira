"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, RefreshCw, Sparkles, Unlink } from "lucide-react";
import { IssueKeyLink } from "@/components/issue-card/IssueKeyLink";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import SearchableSelect from "@/components/SearchableSelect";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LENS_OPTIONS,
  isStoryLens,
  type StoryLens,
} from "@/lib/lens";
import { selectableFixVersions } from "@/lib/fix-version-policy";
import { cn } from "@/lib/utils";

type SupportAttachment = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  content: string;
};

type SupportComment = {
  id: string;
  author: string;
  created: string;
  body: string;
};

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
  attachments?: SupportAttachment[];
  comments?: SupportComment[];
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

const DEFAULT_AI_PROMPT =
  "Rewrite as a clear delivery ticket for the engineering team. Keep the customer problem explicit. Output concise summary and structured description with acceptance criteria.";

function formatCommentTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function attachmentHref(
  jiraUrl: string,
  att: SupportAttachment
): string {
  if (att.content) return att.content;
  const base = (jiraUrl || "").replace(/\/$/, "");
  return `${base}/secure/attachment/${encodeURIComponent(att.id)}/${encodeURIComponent(att.filename)}`;
}

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
  const { jiraUrl,
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

  const fa = true;
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
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const uniqueStatuses = useMemo(() => {
    const set = new Set(items.map((i) => i.status).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  const queueLabel = useMemo(() => {
    if (statusFilter === "all") {
      return `صف من (${items.length})`;
    }
    return `صف من (${filteredItems.length}/${items.length})`;
  }, [fa, filteredItems.length, items.length, statusFilter]);

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
      toast.error("لنز را انتخاب کنید.");
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
        `ساخته شد: ${data.sipKey}`
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
      toast.error("قبلاً لینک شده.");
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
      toast.success(`لینک شد به ${sipKey}`);
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
      toast.success("کامنت ثبت شد.");
      setComment("");
      await loadDetail(detail.key);
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
        `وضعیت: ${data.transitionedTo}`
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
          customPrompt: aiCustomPrompt.trim() || DEFAULT_AI_PROMPT,
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
      toast.success("پیش‌نویس AI آماده شد.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "AI draft failed");
    } finally {
      setAiDrafting(false);
    }
  }

  if (!jiraConnected) {
    return (
      <p className="text-sm text-muted-foreground">
        {"در Settings به جیرا وصل شوید."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Capacity strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {"ظرفیت from-ps"}
        </span>
        <div className="w-48">
          <SearchableSelect
            options={versionOptions}
            value={capacityVersionId}
            onChange={setCapacityVersionId}
            placeholder={"ورژن SIP"}
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
          <div className="flex flex-col gap-2 border-b px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {queueLabel}
            </span>
            {uniqueStatuses.length > 0 ? (
              <ToggleGroup
                value={[statusFilter]}
                onValueChange={(values) => {
                  if (!values.length) return;
                  setStatusFilter(values[0]);
                }}
                variant="outline"
                size="sm"
                className="flex max-w-full flex-wrap justify-start gap-1"
              >
                <ToggleGroupItem value="all" className="text-[10px]">
                  {"همه"}
                </ToggleGroupItem>
                {uniqueStatuses.map((s) => (
                  <ToggleGroupItem key={s} value={s} className="text-[10px]">
                    {s}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Spinner /> {"بارگذاری…"}
              </div>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {"ایشویی assign نیست."}
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {"با این وضعیت چیزی نیست."}
              </p>
            ) : (
              filteredItems.map((item) => {
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
              {"یک ایشو انتخاب کنید."}
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
                {detail.description || ("(بدون توضیح)")}
              </div>

              {(detail.attachments || []).length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {"پیوست‌ها"}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {(detail.attachments || []).map((att) => (
                      <li key={att.id}>
                        <a
                          href={attachmentHref(jiraUrl || "", att)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {att.filename}
                          {att.size > 0
                            ? ` (${Math.round(att.size / 1024)} KB)`
                            : ""}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(detail.comments || []).length > 0 ? (
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {"کامنت‌ها"}
                  </span>
                  {(detail.comments || []).map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-0.5 rounded-md border bg-muted/20 px-2 py-1.5"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {c.author || "—"}
                        </span>
                        <span>{formatCommentTime(c.created)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed">
                        {c.body}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {(detail.linkedSip || []).length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {"لینک‌های SIP"}
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
                    {"کامنت"}
                  </FieldLabel>
                  <Textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={"متن کامنت…"}
                  />
                </Field>
                <Button
                  type="button"
                  size="sm"
                  disabled={commenting || !comment.trim()}
                  onClick={() => void handleComment()}
                >
                  {commenting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {"ثبت کامنت"}
                </Button>
              </div>

              <div className="flex flex-col gap-2 border-t pt-3">
                <Field>
                  <FieldLabel>
                    {"وضعیت"}
                  </FieldLabel>
                  <SearchableSelect
                    options={statuses.map((s) => ({ value: s, label: s }))}
                    value={statusTarget}
                    onChange={setStatusTarget}
                    placeholder={"انتقال به…"}
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
                  {"اعمال وضعیت"}
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
              {"ساخت در SIP"}
            </ToggleGroupItem>
            <ToggleGroupItem value="link">
              {"لینک موجود"}
            </ToggleGroupItem>
          </ToggleGroup>

          {!detail ? (
            <p className="text-sm text-muted-foreground">
              {"اول ایشو را انتخاب کنید."}
            </p>
          ) : actionTab === "create" ? (
            <Card>
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="text-sm">
                  {"تیکت SIP"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {"یک Story یا Bug بساز و به PS لینک کن."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                <FieldGroup className="gap-3">
                  <Field>
                    <FieldLabel>
                      {"دستور AI (اختیاری)"}
                    </FieldLabel>
                    <Input
                      value={aiCustomPrompt}
                      onChange={(e) => setAiCustomPrompt(e.target.value)}
                      placeholder={
                        "خالی = پیش‌فرض تیم تحویل"
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={aiDrafting}
                    onClick={() => void handleAiDraft()}
                  >
                    {aiDrafting ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Sparkles data-icon="inline-start" />
                    )}
                    {"پیش‌نویس AI"}
                  </Button>

                  <Separator />

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
                              val === "Story"
                                ? f.selectedLens || "customer"
                                : "",
                          }))
                        }
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
                    <FieldLabel>
                      {"توضیحات (مارک‌داون)"}
                    </FieldLabel>
                    <Textarea
                      rows={5}
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                    />
                    {form.description.trim() ? (
                      <div className="mt-2 rounded-md border bg-muted/30 p-2">
                        <MarkdownPreview text={form.description} />
                      </div>
                    ) : null}
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
                        />
                    </Field>
                    <Field>
                      <FieldLabel>Priority</FieldLabel>
                      <SearchableSelect
                        options={PRIORITIES.map((p) => ({
                          value: p,
                          label: p,
                        }))}
                        value={form.selectedPriority}
                        onChange={(val) =>
                          setForm((f) => ({ ...f, selectedPriority: val }))
                        }
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
                        />
                    </Field>
                  </div>
                </FieldGroup>

                <Button
                  type="button"
                  disabled={promoting || !form.summary.trim()}
                  onClick={() => void handlePromote()}
                >
                  {promoting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {"بساز و لینک کن"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {(detail.linkedSipKeys || []).length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {`لینک‌شده: ${(detail.linkedSipKeys || []).join(", ")}`}
                </p>
              ) : null}
              <Field>
                <FieldLabel>
                  {"جستجوی SIP"}
                </FieldLabel>
                <Input
                  value={sipQuery}
                  onChange={(e) => setSipQuery(e.target.value)}
                  placeholder={"کلید یا خلاصه…"}
                />
              </Field>
              {sipSearching ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner /> {"جستجو…"}
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
                          ? "لینک‌شده"
                          : "لینک"}
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
