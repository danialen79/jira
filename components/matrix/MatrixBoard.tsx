"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MatrixHealthStrip from "@/components/matrix/MatrixHealthStrip";
import PriorityMatrixChart, {
  type MatrixPoint,
} from "@/components/matrix/PriorityMatrixChart";
import SearchableSelect from "@/components/SearchableSelect";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import {
  impactHistogram,
  ownsImpactEffort,
  parseScore,
  valueRatio,
} from "@/lib/impact-effort";
import type { JiraVersion, VersionIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  versions: JiraVersion[];
  jiraConnected: boolean;
  fieldsConfigured: boolean;
  className?: string;
};

const t = {
  release: "ریلیز",
  pickRelease: "انتخاب ریلیز…",
  connect: "اول به جیرا وصل شوید.",
  noFields: "JIRA_IMPACT_FIELD و JIRA_EFFORT_FIELD را در env تنظیم کنید.",
  loadFail: "بارگذاری مسائل ریلیز ناموفق بود.",
  missingTitle: "بدون Impact یا Effort",
  impact: "Impact",
  effort: "Effort",
  value: "Value",
  key: "کلید",
  summary: "خلاصه",
  noOwners: "اپیک یا استوری مستقلی در این ریلیز نیست.",
} as const;

function formatNum(n: number): string {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 2,
  }).format(n);
}

export default function MatrixBoard({
  versions,
  jiraConnected,
  fieldsConfigured,
  className,
}: Props) {
  const { openIssue } = useIssuePeek();
  const [versionId, setVersionId] = useState("");
  const [issues, setIssues] = useState<VersionIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const versionOptions = useMemo(
    () =>
      [...versions]
        .sort((a, b) => {
          const ar = a.released ? 1 : 0;
          const br = b.released ? 1 : 0;
          if (ar !== br) return ar - br;
          return (a.name || "").localeCompare(b.name || "", "fa");
        })
        .map((v) => ({
          value: String(v.id),
          label: v.name,
          sublabel: v.released ? "منتشرشده" : undefined,
        })),
    [versions]
  );

  useEffect(() => {
    if (versionId) return;
    const firstUnreleased = versions.find((v) => !v.released && !v.archived);
    if (firstUnreleased) setVersionId(String(firstUnreleased.id));
  }, [versions, versionId]);

  const load = useCallback(async (id: string) => {
    if (!id) {
      setIssues([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/jira/versions/issues?versionId=${encodeURIComponent(id)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || t.loadFail);
      }
      setIssues(Array.isArray(data.issues) ? data.issues : []);
    } catch (e) {
      setIssues([]);
      setError(e instanceof Error ? e.message : t.loadFail);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jiraConnected || !fieldsConfigured || !versionId) return;
    void load(versionId);
  }, [jiraConnected, fieldsConfigured, versionId, load]);

  const owners = useMemo(
    () =>
      issues.filter((i) =>
        ownsImpactEffort(i.issuetype, Boolean(i.epicKey))
      ),
    [issues]
  );

  const points: MatrixPoint[] = useMemo(() => {
    const out: MatrixPoint[] = [];
    for (const i of owners) {
      const impact = parseScore(i.impact);
      const effort = parseScore(i.effort);
      if (impact == null || effort == null) continue;
      out.push({
        key: i.key,
        summary: i.summary,
        impact,
        effort,
      });
    }
    return out;
  }, [owners]);

  const missing = useMemo(
    () =>
      owners.filter(
        (i) => parseScore(i.impact) == null || parseScore(i.effort) == null
      ),
    [owners]
  );

  const histogram = useMemo(() => impactHistogram(owners), [owners]);

  const open = (key: string) => {
    openIssue(key, { replace: true });
  };

  if (!jiraConnected) {
    return (
      <p className="text-sm text-muted-foreground">{t.connect}</p>
    );
  }

  if (!fieldsConfigured) {
    return (
      <p className="text-sm text-muted-foreground">{t.noFields}</p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)} dir="rtl">
      <div className="max-w-sm">
        <SearchableSelect
          options={versionOptions}
          value={versionId}
          onChange={setVersionId}
          placeholder={t.pickRelease}
        />
      </div>

      {!versionId ? (
        <p className="text-sm text-muted-foreground">{t.pickRelease}</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : owners.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noOwners}</p>
      ) : (
        <>
          <MatrixHealthStrip histogram={histogram} />
          <PriorityMatrixChart points={points} onSelect={open} />

          {points.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">{t.key}</TableHead>
                  <TableHead>{t.summary}</TableHead>
                  <TableHead className="w-20 text-end">{t.impact}</TableHead>
                  <TableHead className="w-20 text-end">{t.effort}</TableHead>
                  <TableHead className="w-20 text-end">{t.value}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => {
                  const v = valueRatio(p.impact, p.effort);
                  return (
                    <TableRow
                      key={p.key}
                      className="cursor-pointer"
                      onClick={() => open(p.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          open(p.key);
                        }
                      }}
                      tabIndex={0}
                    >
                      <TableCell className="font-mono text-xs" translate="no">
                        {p.key}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {p.summary}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatNum(p.impact)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatNum(p.effort)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {v != null ? formatNum(v) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}

          {missing.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {t.missingTitle} ({formatNum(missing.length)})
              </p>
              <div className="flex flex-wrap gap-2">
                {missing.map((i) => (
                  <button
                    key={i.key}
                    type="button"
                    className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    translate="no"
                    onClick={() => open(i.key)}
                  >
                    {i.key}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
