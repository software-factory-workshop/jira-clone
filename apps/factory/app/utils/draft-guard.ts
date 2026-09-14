import type { Draft } from "@jira-clone/context";
import type { DraftOrigin, WorkOrderAdmission } from "../../shared/cockpit";

export interface EditorText {
  title: string;
  request: string;
}

export interface DraftSnapshot extends EditorText {
  id: string | null;
  version: number;
}

export function emptySnapshot(): DraftSnapshot {
  return { id: null, version: 0, title: "", request: "" };
}

export function cleanSnapshot(id: string | null, version: number, text: EditorText): DraftSnapshot {
  return { id, version, title: text.title.trim(), request: text.request.trim() };
}

// Edits count as unsaved only when the trimmed text differs from the last
// saved or opened state, so stray whitespace never blocks navigation.
export function isDraftDirty(text: EditorText, snapshot: DraftSnapshot): boolean {
  return text.title.trim() !== snapshot.title || text.request.trim() !== snapshot.request;
}

export interface ProposalPayload {
  title: string;
  body: string;
  id?: string;
  version?: number;
  origin?: DraftOrigin;
  admission?: WorkOrderAdmission;
}

export type DraftDestination =
  | { kind: "new" }
  | { kind: "draft"; draft: Pick<Draft, "id" | "title" | "request"> & { origin?: DraftOrigin; admission?: WorkOrderAdmission } }
  | { kind: "proposal"; value: ProposalPayload };

export function destinationLabel(destination: DraftDestination): string {
  switch (destination.kind) {
    case "new":
      return "a new draft";
    case "draft":
      return `the "${destination.draft.title}" saved draft`;
    case "proposal":
      return "the proposal draft";
  }
}

export interface SaveReceipt {
  id: string;
  version: number;
}

// A delayed save receipt must never rewrite an editor that has moved on to
// another draft. Only apply identity and version when the editor is still on
// the draft the save started from; otherwise leave text and identity alone.
export function applySaveReceipt(
  current: { activeId: string | null; activeVersion: number },
  previousId: string | null,
  receipt: SaveReceipt,
): { applied: boolean; activeId: string | null; activeVersion: number } {
  if (current.activeId !== previousId) return { applied: false, ...current };
  return { applied: true, activeId: receipt.id, activeVersion: receipt.version };
}
