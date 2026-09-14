import type { BulkActionId } from "@/lib/issue-ops/types";
import type { StoryLens } from "@/lib/lens";

export type BulkActionDef = {
  id: BulkActionId;
  /** Issuetypes this action applies to; empty = all. */
  issuetypes: string[];
  requiresConfirm: boolean;
};

export const OPS_BULK_ACTIONS: BulkActionDef[] = [
  {
    id: "setLens",
    issuetypes: ["Story"],
    requiresConfirm: true,
  },
  {
    id: "setAssignee",
    issuetypes: [],
    requiresConfirm: true,
  },
  {
    id: "setFixVersion",
    issuetypes: [],
    requiresConfirm: true,
  },
  {
    id: "setStatus",
    issuetypes: [],
    requiresConfirm: true,
  },
];

export function getBulkActionDef(id: BulkActionId): BulkActionDef | undefined {
  return OPS_BULK_ACTIONS.find((a) => a.id === id);
}

export type SetLensParams = { lens: StoryLens };
export type SetAssigneeParams = { assignee: string | null };
export type SetFixVersionParams = { fixVersionId: string };
export type SetStatusParams = { statusName: string };

export type BulkActionParams =
  | SetLensParams
  | SetAssigneeParams
  | SetFixVersionParams
  | SetStatusParams;
