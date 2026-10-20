import type { ConstraintPatch, Role, Scenario } from "@/lib/domain/types";
import { roleSchema } from "@/lib/domain/schemas";
import { applyScenario, createScenario } from "@/lib/scenarios/scenarios";
import { extractionSuccessSchema, type ExtractionSuccess } from "./contracts";

export interface ReviewEdits { valueManual: boolean; importanceEdited: boolean; enabledEdited: boolean }
export interface ExtractionReview {
  session: number;
  baselineId: string;
  baselineRevision: number;
  original: ExtractionSuccess;
  draft: Role;
  titleManual: boolean;
  edits: Record<string, ReviewEdits>;
}
export type ReviewChange = { kind: "title"; value: string } | { kind: "constraint"; patch: ConstraintPatch };

export function createReview(success: unknown, current: Role, session: number): ExtractionReview {
  if (!Number.isSafeInteger(session) || session < 1) throw new Error("Invalid review session");
  const original = extractionSuccessSchema.parse(success);
  return { session, baselineId: current.id, baselineRevision: current.revision, original, draft: structuredClone(original.draftRole), titleManual: false, edits: {} };
}

export function editReview(review: ExtractionReview, change: ReviewChange): ExtractionReview {
  const next = structuredClone(review);
  if (change.kind === "title") {
    next.draft = roleSchema.parse({ ...next.draft, title: change.value });
    if (change.value !== review.draft.title) next.titleManual = true;
    return next;
  }
  const previous = next.draft.constraints.find((item) => item.id === change.patch.constraintId);
  if (!previous) throw new Error("Unknown review requirement");
  next.draft = applyScenario(next.draft, { ...createScenario(next.draft), overrides: [change.patch] });
  const updated = next.draft.constraints.find((item) => item.id === previous.id)!;
  const oldEdits = next.edits[previous.id] ?? { valueManual: false, importanceEdited: false, enabledEdited: false };
  next.edits[previous.id] = {
    valueManual: updated.requirement.origin === "manual",
    importanceEdited: oldEdits.importanceEdited || updated.importance !== previous.importance,
    enabledEdited: oldEdits.enabledEdited || updated.enabled !== previous.enabled,
  };
  return next;
}

/** Only this explicit operation restores original extracted evidence after a correction. */
export function revertReviewConstraint(review: ExtractionReview, constraintId: string): ExtractionReview {
  const next = structuredClone(review);
  const original = next.original.draftRole.constraints.find((item) => item.id === constraintId);
  if (!original) throw new Error("Unknown original requirement");
  next.draft.constraints = next.draft.constraints.map((item) => item.id === constraintId ? structuredClone(original) : item);
  delete next.edits[constraintId];
  return next;
}

/** Confirm against the latest active revision; draft revision1 never determines delivery identity. */
export function confirmReview(current: Role, review: ExtractionReview, session: number): { role: Role; scenario: Scenario } {
  if (review.session !== session || current.id !== review.baselineId || current.revision !== review.baselineRevision) throw new Error("This review is stale. Extract again against the current baseline.");
  const role = roleSchema.parse({ ...review.draft, id: current.id, revision: current.revision + 1 });
  return { role, scenario: createScenario(role) };
}
