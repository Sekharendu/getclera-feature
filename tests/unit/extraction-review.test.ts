import { describe, expect, it } from "vitest";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import { roleSchema } from "@/lib/domain/schemas";
import { createReview, editReview, confirmReview, revertReviewConstraint } from "@/lib/extraction/review";
import type { ExtractionSuccess } from "@/lib/extraction/contracts";
import { evaluateMatches } from "@/lib/matching/match";

function sample() {
  const { role } = loadDemoFixtures();
  role.constraints.forEach((item) => { item.requirement.origin = "extracted"; });
  return { draftRole: role, warnings: [{ code: "review_required", message: "Review all claims." }] } satisfies ExtractionSuccess;
}
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

describe("isolated extraction review and atomic confirmation", () => {
  it("detaches original data, preserves no-op provenance and tracks value/editorial edits separately", () => {
    const source = freeze(sample()); const { role } = loadDemoFixtures(); const review = freeze(createReview(source, role, 1));
    const id = "role-skill-typescript";
    const noop = editReview(review, { kind: "constraint", patch: { constraintId: id, kind: "skill", value: "typescript" } });
    expect(noop.draft.constraints[0].requirement).toEqual(source.draftRole.constraints[0].requirement);
    const metadata = editReview(noop, { kind: "constraint", patch: { constraintId: id, kind: "skill", importance: "preferred", enabled: false } });
    expect(metadata.edits[id]).toEqual({ valueManual: false, importanceEdited: true, enabledEdited: true });
    expect(metadata.draft.constraints[0].requirement.evidence).toEqual(source.draftRole.constraints[0].requirement.evidence);
    const manual = editReview(metadata, { kind: "constraint", patch: { constraintId: id, kind: "skill", value: "python" } });
    expect(manual.draft.constraints[0].requirement).toEqual({ value: "python", evidence: [], origin: "manual" });
    const typedBack = editReview(manual, { kind: "constraint", patch: { constraintId: id, kind: "skill", value: "typescript" } });
    expect(typedBack.draft.constraints[0].requirement.origin).toBe("manual");
    expect(revertReviewConstraint(typedBack, id).draft.constraints[0]).toEqual(source.draftRole.constraints[0]);
    expect(editReview(review, { kind: "title", value: "Reviewed title" }).titleManual).toBe(true);
    expect(review.original).toEqual(source);
  });
  it("validates all typed kinds and retains null unknown requirements", () => {
    const { role } = loadDemoFixtures(); let review = createReview(sample(), role, 1);
    const patches = [
      { constraintId: "role-skill-typescript", kind: "skill" as const, value: "python" },
      { constraintId: "role-work-mode", kind: "work_mode" as const, value: ["office" as const, "remote" as const] },
      { constraintId: "role-location", kind: "location" as const, value: ["ca-toronto"] },
      { constraintId: "role-latest-start", kind: "latest_start" as const, value: "2027-02-01" },
      { constraintId: "role-salary", kind: "salary" as const, value: { min: 100000, max: 200000, currency: "USD", basis: "annual_base" as const, minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false } },
    ];
    for (const patch of patches) review = editReview(review, { kind: "constraint", patch });
    expect(roleSchema.safeParse(review.draft).success).toBe(true);
    expect(patches.every((p) => review.edits[p.constraintId].valueManual)).toBe(true);
    const original = sample(); original.draftRole.constraints[0].requirement = { value: null, evidence: [], origin: "extracted" };
    const unknown = confirmReview(role, createReview(original, role, 1), 1).role;
    expect(unknown.constraints[0].requirement.value).toBeNull();
    expect(evaluateMatches(unknown, loadDemoFixtures().candidates).some((match) => match.checks.some((check) => check.status === "unknown" && check.clarificationQuestion))).toBe(true);
  });
  it("increments active revision7 to8, atomically clears overrides and rejects stale sessions", () => {
    const { role } = loadDemoFixtures(); role.revision = 7;
    const review = createReview(sample(), role, 4); const state = confirmReview(role, review, 4);
    expect(state.role).toMatchObject({ id: role.id, revision: 8 }); expect(state.scenario).toMatchObject({ roleId: role.id, baselineRevision: 8, overrides: [] });
    expect(() => confirmReview({ ...role, revision: 8 }, review, 4)).toThrow("stale");
    expect(() => confirmReview(role, review, 5)).toThrow("stale");
    expect(() => editReview(review, { kind: "title", value: "  " })).toThrow();
    expect(() => editReview(review, { kind: "constraint", patch: { constraintId: "role-latest-start", kind: "latest_start", value: "2027-02-30" } })).toThrow();
    const invalid = structuredClone(review); invalid.draft.constraints[0].weight = 0;
    expect(() => confirmReview(role, invalid, 4)).toThrow();
    expect(review.draft.revision).toBe(1);
  });
});
