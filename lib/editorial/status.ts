/**
 * The editorial status model.
 *
 * Two independent review gates:
 *
 *   draft  -> review -> approved -> generate thread
 *   thread -> review -> approved -> publish
 *
 * `scheduled` and `published` are deliberately NOT editable through the normal
 * editorial routes. Only the publishing flow may set them, so nothing can end
 * up marked as published without having actually been published.
 */

export const EDITABLE_DRAFT_STATUSES = [
  "draft",
  "approved",
  "rejected",
] as const;

export const EDITABLE_THREAD_STATUSES = [
  "draft",
  "approved",
  "rejected",
] as const;

export type EditableDraftStatus = (typeof EDITABLE_DRAFT_STATUSES)[number];
export type EditableThreadStatus = (typeof EDITABLE_THREAD_STATUSES)[number];

export type ThreadStatus =
  | EditableThreadStatus
  | "scheduled"
  | "published";

export type DraftStatus = EditableDraftStatus | "scheduled" | "published";
