export type OfficeSelectionKind = "agent" | "task" | "artifact" | "approval" | "room";

export interface OfficeSelection {
  kind: OfficeSelectionKind;
  id: string;
}
