import { CheckCircle2, Circle, CircleDot, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getIssueStatusBadgeClass,
  resolveIssueStatusTone,
  type IssueStatusTone,
} from "@/lib/issue-status-badge";
import { cn } from "@/lib/utils";

const TONE_ICON: Record<
  IssueStatusTone,
  typeof Circle | typeof CircleDot | typeof CheckCircle2 | typeof XCircle
> = {
  todo: Circle,
  inProgress: CircleDot,
  done: CheckCircle2,
  canceled: XCircle,
};

export function IssueStatusBadge({
  status,
  statusCategoryKey,
  className,
}: {
  status: string;
  /** Jira statusCategory key or name (`new` / `indeterminate` / `done`, etc.). */
  statusCategoryKey?: string;
  className?: string;
}) {
  const tone = resolveIssueStatusTone(status, statusCategoryKey);
  const Icon = TONE_ICON[tone];

  return (
    <Badge
      className={cn(getIssueStatusBadgeClass(status, statusCategoryKey), className)}
    >
      <Icon data-icon="inline-start" />
      {status}
    </Badge>
  );
}
