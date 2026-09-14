import { getSetting, setSetting } from "@/lib/db/repos/settings";

export const SCRUM_BOARD_KEY = "jira.scrum_board";

export type ScrumBoardSetting = {
  boardId: number;
  boardName: string;
  boardType: "scrum";
};

export function getScrumBoard(): ScrumBoardSetting | null {
  const value = getSetting<ScrumBoardSetting>(SCRUM_BOARD_KEY);
  if (
    !value ||
    typeof value.boardId !== "number" ||
    !Number.isFinite(value.boardId) ||
    value.boardId <= 0
  ) {
    return null;
  }
  return {
    boardId: value.boardId,
    boardName: typeof value.boardName === "string" ? value.boardName : "",
    boardType: "scrum",
  };
}

export function setScrumBoard(board: ScrumBoardSetting): ScrumBoardSetting {
  const next: ScrumBoardSetting = {
    boardId: board.boardId,
    boardName: board.boardName.trim(),
    boardType: "scrum",
  };
  setSetting(SCRUM_BOARD_KEY, next);
  return next;
}
