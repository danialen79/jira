import {
  getScrumBoard,
  type ScrumBoardSetting,
} from "@/lib/db/repos/jira-settings";

export class JiraBoardConfigError extends Error {
  constructor(message = "Configure Scrum board in Settings") {
    super(message);
    this.name = "JiraBoardConfigError";
  }
}

export function requireScrumBoard(): ScrumBoardSetting {
  const board = getScrumBoard();
  if (!board) {
    throw new JiraBoardConfigError();
  }
  return board;
}
