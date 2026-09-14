"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Save } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Spinner } from "@/components/ui/spinner";
import type { Language } from "@/lib/types";

type BoardOption = {
  id: number;
  name: string;
  type: string;
};

type ScrumBoardSetting = {
  boardId: number;
  boardName: string;
  boardType: "scrum";
};

type Props = {
  language: Language;
  isRtl: boolean;
  jiraConnected: boolean;
};

const copy = {
  en: {
    title: "Scrum board",
    subtitle: "Used by Sprint Control for all sprint actions.",
    board: "Board",
    save: "Save board",
    saving: "Saving…",
    refresh: "Refresh boards",
    saved: "Board saved.",
    saveFailed: "Could not save board.",
    loadFailed: "Could not load boards.",
    notConnected: "Connect Jira first.",
    pick: "Select a Scrum board",
    missing: "No board saved",
    configured: "Configured",
    stale: "Saved board is not in the current list. Pick again.",
    empty: "No Scrum boards found for this project.",
  },
  fa: {
    title: "بورد اسکرام",
    subtitle: "مرکز کنترل اسپرینت از این بورد استفاده می‌کند.",
    board: "بورد",
    save: "ذخیره بورد",
    saving: "در حال ذخیره…",
    refresh: "بروزرسانی بوردها",
    saved: "بورد ذخیره شد.",
    saveFailed: "ذخیره بورد ناموفق بود.",
    loadFailed: "بارگذاری بوردها ناموفق بود.",
    notConnected: "ابتدا جیرا را وصل کنید.",
    pick: "یک بورد اسکرام انتخاب کنید",
    missing: "بوردی ذخیره نشده",
    configured: "پیکربندی شده",
    stale: "بورد ذخیره‌شده در لیست نیست. دوباره انتخاب کنید.",
    empty: "برای این پروژه بورد اسکرامی یافت نشد.",
  },
} as const;

export default function JiraBoardSettings({
  language,
  isRtl,
  jiraConnected,
}: Props) {
  const t = copy[language];
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saved, setSaved] = useState<ScrumBoardSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, boardsRes] = await Promise.all([
        fetch("/api/settings/jira"),
        jiraConnected
          ? fetch("/api/jira/boards")
          : Promise.resolve(null),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const board = data.scrumBoard as ScrumBoardSetting | null;
        setSaved(board);
        if (board?.boardId) setSelectedId(String(board.boardId));
      }

      if (boardsRes) {
        if (!boardsRes.ok) {
          const data = await boardsRes.json().catch(() => ({}));
          throw new Error(data.error || t.loadFailed);
        }
        const data = await boardsRes.json();
        setBoards(data.scrumBoards || []);
      } else {
        setBoards([]);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [jiraConnected, t.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(
    () =>
      boards.map((b) => ({
        value: String(b.id),
        label: b.name,
        sublabel: b.type,
      })),
    [boards]
  );

  const stale =
    !!saved &&
    boards.length > 0 &&
    !boards.some((b) => b.id === saved.boardId);

  const handleSave = async () => {
    const board = boards.find((b) => String(b.id) === selectedId);
    if (!board) {
      toast.error(t.pick);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/jira", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrumBoard: {
            boardId: board.id,
            boardName: board.name,
            boardType: "scrum",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.saveFailed);
      setSaved(data.scrumBoard);
      toast.success(t.saved);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="size-4" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
          <Badge variant={saved ? "success" : "secondary"}>
            {saved
              ? `${t.configured}${saved.boardName ? `: ${saved.boardName}` : ""}`
              : t.missing}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!jiraConnected && (
          <Alert>
            <AlertDescription>{t.notConnected}</AlertDescription>
          </Alert>
        )}
        {stale && (
          <Alert>
            <AlertDescription>{t.stale}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel>{t.board}</FieldLabel>
              <SearchableSelect
                options={options}
                value={selectedId}
                onChange={setSelectedId}
                placeholder={options.length ? t.pick : t.empty}
                isRtl={isRtl}
                disabled={!jiraConnected || options.length === 0}
              />
            </Field>
          </FieldGroup>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !selectedId || !jiraConnected}
          >
            {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {saving ? t.saving : t.save}
          </Button>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading || !jiraConnected}
          >
            {t.refresh}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
