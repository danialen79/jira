"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  IssueMetaLine,
  type IssueMetaItem,
} from "@/components/issue-card/IssueMetaLine";
import { cn } from "@/lib/utils";

export type IssueCardDensity = "comfortable" | "compact";

type IssueCardContextValue = {
  density: IssueCardDensity;
  nested: boolean;
  expandable: boolean;
  open: boolean;
};

const IssueCardContext = React.createContext<IssueCardContextValue | null>(
  null
);

function useIssueCardContext(component: string): IssueCardContextValue {
  const ctx = React.useContext(IssueCardContext);
  if (!ctx) {
    throw new Error(`${component} must be used within IssueCard`);
  }
  return ctx;
}

type IssueCardProps = {
  children: React.ReactNode;
  className?: string;
  density?: IssueCardDensity;
  /** Flush child row inside an expanded parent (no outer border). */
  nested?: boolean;
  /** Enables collapsible behavior when also expandable. */
  collapsible?: boolean;
  /** Show chevron and allow expand (typically has children). */
  expandable?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function IssueCard({
  children,
  className,
  density = "comfortable",
  nested = false,
  collapsible = false,
  expandable = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: IssueCardProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : uncontrolledOpen;
  const canCollapse = collapsible && expandable;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!canCollapse) return;
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [canCollapse, isControlled, onOpenChange]
  );

  const ctx: IssueCardContextValue = {
    density,
    nested,
    expandable: canCollapse,
    open: canCollapse && open,
  };

  const pad = density === "compact" ? "px-2.5 py-1.5" : "px-3 py-2.5";

  const shellClass = cn(
    "flex flex-col",
    pad,
    nested
      ? "rounded-none border-0 bg-transparent shadow-none ring-0"
      : cn(
          "rounded-lg border border-border/80 bg-card/40",
          canCollapse && open && "bg-muted/40 ring-1 ring-border/80"
        ),
    className
  );

  const body = (
    <IssueCardContext.Provider value={ctx}>
      <div
        data-slot="issue-card"
        data-density={density}
        data-nested={nested ? "true" : "false"}
        data-state={canCollapse && open ? "open" : "closed"}
        className={shellClass}
      >
        {children}
      </div>
    </IssueCardContext.Provider>
  );

  if (!canCollapse) return body;

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      {body}
    </Collapsible>
  );
}

type IssueCardHeaderProps = {
  title: React.ReactNode;
  badges?: React.ReactNode;
  leading?: React.ReactNode;
  className?: string;
};

function IssueCardHeader({
  title,
  badges,
  leading,
  className,
}: IssueCardHeaderProps) {
  const ctx = useIssueCardContext("IssueCardHeader");

  const titleClass =
    ctx.density === "compact"
      ? "min-w-0 flex-1 truncate text-xs font-medium leading-snug text-pretty"
      : "min-w-0 flex-1 text-sm font-medium leading-snug text-pretty";

  const row = (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      {leading ? (
        <div
          className="mt-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {leading}
        </div>
      ) : null}

      {ctx.expandable ? (
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            ctx.open && "rotate-180"
          )}
          aria-hidden
        />
      ) : null}

      <div className={titleClass}>{title}</div>

      {badges ? (
        <div
          className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {badges}
        </div>
      ) : null}
    </div>
  );

  if (!ctx.expandable) return row;

  return (
    <CollapsibleTrigger className="group w-full cursor-pointer text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
      {row}
    </CollapsibleTrigger>
  );
}

type IssueCardFooterProps = {
  meta?: IssueMetaItem[];
  actions?: React.ReactNode;
  className?: string;
};

function IssueCardFooter({ meta, actions, className }: IssueCardFooterProps) {
  const filteredMeta = (meta ?? []).filter((item) => {
    if (item.label == null || item.label === false) return false;
    if (typeof item.label === "string" && !item.label.trim()) return false;
    return true;
  });
  const hasMeta = filteredMeta.length > 0;
  const hasActions = !!actions;
  if (!hasMeta && !hasActions) return null;

  return (
    <div className={cn("flex flex-col gap-2 pt-2", className)}>
      <Separator />
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {hasMeta ? <IssueMetaLine items={filteredMeta} /> : null}
        </div>
        {hasActions ? (
          <div
            className="flex shrink-0 flex-wrap items-center justify-end gap-1.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type IssueCardChildrenProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Expanded children panel. Nested IssueCards should use `nested`.
 * Separators are inserted between element children automatically.
 */
function IssueCardChildren({ children, className }: IssueCardChildrenProps) {
  const ctx = useIssueCardContext("IssueCardChildren");
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;

  const flushX = ctx.density === "compact" ? "-mx-2.5" : "-mx-3";

  return (
    <CollapsibleContent
      className={cn(
        flushX,
        "mt-2 border-t border-border/60",
        className
      )}
    >
      <ul className="flex flex-col">
        {items.map((child, i) => (
          <li key={i} className="flex flex-col">
            {i > 0 ? <Separator /> : null}
            {child}
          </li>
        ))}
      </ul>
    </CollapsibleContent>
  );
}

export {
  IssueCard,
  IssueCardHeader,
  IssueCardFooter,
  IssueCardChildren,
  useIssueCardContext,
};
export type { IssueMetaItem };
