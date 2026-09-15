export type JiraBoardType = "kanban" | "scrum" | "simple";

export type JiraBoard = {
  id: string;
  name: string;
  type: JiraBoardType;
  projectKey: string;
};

type RestBoardShape = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  location?: { projectKey?: unknown } | null;
};

function isBoardType(value: unknown): value is JiraBoardType {
  return value === "kanban" || value === "scrum" || value === "simple";
}

/** Narrow the demo Agile board response before it reaches UI state. */
export function jiraBoardsFromResponse(response: unknown): JiraBoard[] {
  if (!response || typeof response !== "object") return [];
  const values = (response as { values?: unknown }).values;
  if (!Array.isArray(values)) return [];

  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const board = value as RestBoardShape;
    const projectKey = board.location?.projectKey;
    if (
      typeof board.id !== "string" ||
      board.id.trim() === "" ||
      typeof board.name !== "string" ||
      board.name.trim() === "" ||
      !isBoardType(board.type) ||
      typeof projectKey !== "string" ||
      projectKey.trim() === ""
    ) {
      return [];
    }
    return [{
      id: board.id,
      name: board.name,
      type: board.type,
      projectKey,
    }];
  });
}

/** Keep a requested board when it exists, otherwise select the first board. */
export function availableBoardId(
  boards: readonly JiraBoard[],
  requestedId: string,
): string {
  return boards.some((board) => board.id === requestedId)
    ? requestedId
    : boards[0]?.id ?? "";
}

export function boardTypeLabel(type: JiraBoardType): string {
  return type === "simple" ? "Simple" : `${type[0]?.toUpperCase()}${type.slice(1)}`;
}
