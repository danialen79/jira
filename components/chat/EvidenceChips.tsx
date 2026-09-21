"use client";

import { BookMarked, Globe, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EvidenceChip } from "@/lib/ai/agents/activity";

function IconFor({ kind }: { kind: EvidenceChip["kind"] }) {
  if (kind === "jira") return <Ticket className="size-3" aria-hidden="true" />;
  if (kind === "web") return <Globe className="size-3" aria-hidden="true" />;
  return <BookMarked className="size-3" aria-hidden="true" />;
}

function hrefFor(
  chip: EvidenceChip,
  jiraBrowseBase?: string | null
): string | null {
  if (chip.kind === "web" && /^https?:\/\//i.test(chip.ref)) return chip.ref;
  if (
    chip.kind === "jira" &&
    jiraBrowseBase &&
    /^[A-Z][A-Z0-9]+-\d+$/i.test(chip.ref)
  ) {
    return `${jiraBrowseBase.replace(/\/+$/, "")}/browse/${chip.ref}`;
  }
  return null;
}

export function EvidenceChips({
  chips,
  jiraBrowseBase,
  className,
}: {
  chips: EvidenceChip[];
  jiraBrowseBase?: string | null;
  className?: string;
}) {
  if (!chips.length) return null;

  return (
    <div
      className={cn(
        "flex max-w-[90%] min-w-0 flex-wrap items-center gap-1.5",
        className
      )}
      aria-label="شواهد"
    >
      <span className="text-muted-foreground text-[10px]">شواهد:</span>
      {chips.map((c) => {
        const href = hrefFor(c, jiraBrowseBase);
        const label =
          c.kind === "knowledge"
            ? "دانش"
            : c.kind === "jira"
              ? "جیرا"
              : "وب";
        const body = (
          <span className="inline-flex min-w-0 items-center gap-1">
            <IconFor kind={c.kind} />
            <span className="max-w-40 truncate">{c.ref}</span>
            <span className="text-muted-foreground">{label}</span>
          </span>
        );
        return (
          <Badge
            key={`${c.kind}-${c.ref}`}
            variant="outline"
            className="max-w-56 gap-1 truncate text-[10px] font-normal"
            title={c.claim || c.snippet || c.ref}
            render={
              href
                ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center"
                    />
                  )
                : undefined
            }
          >
            {body}
          </Badge>
        );
      })}
    </div>
  );
}
