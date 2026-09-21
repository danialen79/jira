"use client";

import type { ReactNode } from "react";
import { CalendarIcon, PackageIcon, TagIcon } from "lucide-react";
import type { JiraVersion } from "@/lib/types";
import {
  formatRoadmapDate,
  parseProductVersionParts,
} from "@/lib/roadmap";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const t = {
  start: "شروع",
  release: "انتشار",
  product: "محصول",
  productVer: "ورژن",
} as const;

export function VersionMetaChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Badge
      variant="outline"
      className="h-auto max-w-full gap-1.5 rounded-full border-border/80 bg-muted/40 px-2.5 py-1 font-normal"
    >
      <span className="text-muted-foreground [&_svg]:size-3">{icon}</span>
      <span className="text-[0.65rem] text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground" translate="no">
        {value}
      </span>
    </Badge>
  );
}

type Props = {
  version: Pick<JiraVersion, "name" | "startDate" | "releaseDate">;
  className?: string;
};

export default function VersionMetaChips({ version, className }: Props) {
  const parts = parseProductVersionParts(version.name);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <VersionMetaChip
        icon={<CalendarIcon />}
        label={t.start}
        value={formatRoadmapDate(version.startDate)}
      />
      <VersionMetaChip
        icon={<CalendarIcon />}
        label={t.release}
        value={formatRoadmapDate(version.releaseDate)}
      />
      <VersionMetaChip
        icon={<PackageIcon />}
        label={t.product}
        value={parts.product}
      />
      <VersionMetaChip
        icon={<TagIcon />}
        label={t.productVer}
        value={parts.version || "—"}
      />
    </div>
  );
}
