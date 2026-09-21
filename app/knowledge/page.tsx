"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Doc = {
  id: string;
  title: string;
  source: string;
  rawText: string;
  chunkCount?: number;
  updatedAt: string;
  layer?: "raw" | "canonical";
  status?: "active" | "merged" | "superseded" | "archived";
};

const LAYER_LABEL: Record<string, string> = {
  canonical: "مرجع",
  raw: "خام",
};

const STATUS_LABEL: Record<string, string> = {
  active: "فعال",
  merged: "ادغام‌شده",
  superseded: "جایگزین‌شده",
  archived: "بایگانی",
};

export default function KnowledgePage() {
  const { aiProvider } = useAiSettings();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<{
    docs: number;
    chunks: number;
    models: string[];
    canonical?: number;
    raw?: number;
    merged?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reembedding, setReembedding] = useState(false);
  const [refining, setRefining] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"active" | "all">("active");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "بارگذاری ناموفق");
      setDocs(data.docs || []);
      setStats(data.stats || null);
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleDocs = useMemo(() => {
    const filtered =
      filter === "active"
        ? docs.filter((d) => (d.status || "active") === "active")
        : docs;
    return [...filtered].sort((a, b) => {
      const layerRank = (d: Doc) => (d.layer === "raw" ? 1 : 0);
      const statusRank = (d: Doc) => ((d.status || "active") === "active" ? 0 : 1);
      return (
        statusRank(a) - statusRank(b) ||
        layerRank(a) - layerRank(b) ||
        b.updatedAt.localeCompare(a.updatedAt)
      );
    });
  }, [docs, filter]);

  const handleIngest = async () => {
    if (!title.trim() || !text.trim()) {
      toast.error("عنوان و متن لازم است");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          rawText: text.trim(),
          source: "manual",
          provider: aiProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ذخیره ناموفق");
      toast.success(
        data.skipped
          ? "نزدیک به سند موجود؛ سند جدید ساخته نشد"
          : `ذخیره شد (${data.chunkCount} chunk)`
      );
      setTitle("");
      setText("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "حذف ناموفق");
      toast.success("حذف شد");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    }
  };

  const handleReembed = async () => {
    setReembedding(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reembed", provider: aiProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Re-embed ناموفق");
      toast.success(`Re-embed: ${data.docs} مرجع / ${data.chunks} chunk`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    } finally {
      setReembedding(false);
    }
  };

  const handleRefine = async () => {
    setRefining(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refine", provider: aiProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "یکپارچه‌سازی ناموفق");
      if (!data.clusters) {
        toast.message("کلاستر تکراری پیدا نشد");
      } else {
        toast.success(
          `یکپارچه شد: ${data.created} سند جدید، ${data.merged} ادغام`
        );
      }
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    } finally {
      setRefining(false);
    }
  };

  const busy = saving || reembedding || refining;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5" dir="rtl">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookOpen className="text-primary size-6" />
          دانش محصول
        </h2>
        <p className="text-muted-foreground text-sm">
          نوت مرجع را ذخیره کن؛ تکراری‌ها را یکپارچه کن.
        </p>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{stats.canonical ?? stats.docs} مرجع</Badge>
          <Badge variant="secondary">{stats.chunks} chunk</Badge>
          {typeof stats.raw === "number" && stats.raw > 0 && (
            <Badge variant="outline">{stats.raw} خام</Badge>
          )}
          {typeof stats.merged === "number" && stats.merged > 0 && (
            <Badge variant="outline">{stats.merged} ادغام‌شده</Badge>
          )}
          {stats.models.map((m) => (
            <Badge key={m} variant="outline">
              {m}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">افزودن نوت</CardTitle>
          <CardDescription>متن محصول، جریان‌ها، واژه‌نامه…</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="flex flex-col gap-3">
            <Field>
              <FieldLabel>عنوان</FieldLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً جریان ورود"
              />
            </Field>
            <Field>
              <FieldLabel>متن</FieldLabel>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="توضیح محصول…"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleIngest()}
              >
                {saving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                ذخیره و embed
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !docs.length}
                onClick={() => void handleRefine()}
              >
                {refining ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                یکپارچه‌سازی
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !docs.length}
                onClick={() => void handleReembed()}
              >
                {reembedding ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Re-embed
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={filter === "active" ? "secondary" : "ghost"}
          onClick={() => setFilter("active")}
        >
          فعال
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filter === "all" ? "secondary" : "ghost"}
          onClick={() => setFilter("all")}
        >
          همه
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner />
          در حال بارگذاری…
        </div>
      ) : visibleDocs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>بدون سند</EmptyTitle>
            <EmptyDescription>اولین نوت محصول را اضافه کن.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleDocs.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle className="truncate text-base">
                    {doc.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{doc.source}</Badge>
                    <Badge variant="secondary">
                      {LAYER_LABEL[doc.layer || "canonical"]}
                    </Badge>
                    {(doc.status || "active") !== "active" && (
                      <Badge variant="outline">
                        {STATUS_LABEL[doc.status || "active"]}
                      </Badge>
                    )}
                    {doc.layer !== "raw" && (
                      <Badge variant="secondary">
                        {doc.chunkCount ?? 0} chunk
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleDelete(doc.id)}
                >
                  <Trash2 data-icon="inline-start" />
                  حذف
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap">
                  {doc.rawText}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
