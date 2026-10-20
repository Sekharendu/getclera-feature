import { describe, expect, it } from "vitest";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import type { MatchResult } from "@/lib/domain/types";
import { applyScenario, compareScenarioDetails, compareScenarios, createScenario, editedConstraintIds, evaluateScenario, resetScenario, withOverride } from "@/lib/scenarios/scenarios";

describe("validated immutable overrides", () => {
  const { role, candidates } = loadDemoFixtures();
  const scenario = createScenario(role);
  it.each([
    { ...scenario, roleId: "other" }, { ...scenario, baselineRevision: 999 },
    { ...scenario, overrides: [{ constraintId: "missing", kind: "skill", value: "typescript" }] },
    { ...scenario, overrides: [{ constraintId: "role-work-mode", kind: "skill", value: "typescript" }] },
    { ...scenario, overrides: [{ constraintId: "role-work-mode", kind: "work_mode" }] },
    { ...scenario, overrides: [{ constraintId: "role-latest-start", kind: "latest_start", value: "bad-date" }] },
    { ...scenario, overrides: [{ constraintId: "role-salary", kind: "salary", value: { min: 3, max: 1 } }] },
    { ...scenario, overrides: [{ constraintId: "role-work-mode", kind: "work_mode", enabled: true }, { constraintId: "role-work-mode", kind: "work_mode", enabled: false }] },
  ])("rejects invalid input without mutation %#", (input) => {
    const before = structuredClone(role);
    expect(() => applyScenario(role, input)).toThrow();
    expect(role).toEqual(before);
  });
  it("rejects enabling zero-weight constraints", () => {
    const baseline = structuredClone(role);
    baseline.constraints[0].enabled = false;
    baseline.constraints[0].weight = 0;
    expect(() => applyScenario(baseline, { ...scenario, overrides: [{ constraintId: baseline.constraints[0].id, kind: baseline.constraints[0].kind, enabled: true }] })).toThrow("zero-weight");
  });
  it("uses manual provenance for changed values, preserving source and untouched facts", () => {
    const next = applyScenario(role, withOverride(role, scenario, { constraintId: "role-work-mode", kind: "work_mode", value: ["office", "remote"] }));
    expect(next.constraints.find((c) => c.id === "role-work-mode")?.requirement).toEqual({ value: ["office", "remote"], origin: "manual", evidence: [] });
    expect(next.sources).toEqual(role.sources);
    expect(next.constraints[0].requirement).toEqual(role.constraints[0].requirement);
    next.sources[0].text = "mutated";
    next.constraints[0].requirement.evidence[0].quote = "mutated";
    expect(role.sources[0].text).not.toBe("mutated");
    expect(role.constraints[0].requirement.evidence[0].quote).not.toBe("mutated");
  });
  it("preserves provenance on importance-only and semantic no-op edits", () => {
    const constraint = role.constraints.find((c) => c.id === "role-work-mode")!;
    const changed = applyScenario(role, withOverride(role, scenario, { constraintId: constraint.id, kind: "work_mode", importance: "preferred" }));
    expect(changed.constraints.find((c) => c.id === constraint.id)?.requirement).toEqual(constraint.requirement);
    const baseline = structuredClone(role);
    const work = baseline.constraints.find((c) => c.kind === "work_mode")!;
    if (work.kind !== "work_mode") throw Error();
    work.requirement = { value: ["office", "remote"], origin: "manual", evidence: [] };
    const noop = applyScenario(baseline, withOverride(baseline, createScenario(baseline), { constraintId: work.id, kind: "work_mode", value: ["remote", "office"] }));
    expect(noop).toEqual(baseline);
    expect(editedConstraintIds(baseline, noop)).toEqual([]);
  });
  it("ignores salary property order and preserves reset provenance", () => {
    const salary = role.constraints.find((c) => c.kind === "salary")!;
    if (salary.kind !== "salary" || !salary.requirement.value) throw Error();
    const reversed = Object.fromEntries(Object.entries(salary.requirement.value).reverse()) as typeof salary.requirement.value;
    const noop = withOverride(role, scenario, { constraintId: salary.id, kind: "salary", value: reversed });
    expect(evaluateScenario(role, candidates, noop).editedIds).toEqual([]);
    expect(applyScenario(role, resetScenario(role))).toEqual(role);
    expect(evaluateScenario(role, candidates, resetScenario(role))).toEqual(evaluateScenario(role, candidates, scenario));
    const confirmed = { ...role, revision: role.revision + 1 };
    expect(() => applyScenario(confirmed, scenario)).toThrow("stale");
    expect(resetScenario(confirmed).baselineRevision).toBe(confirmed.revision);
  });
  it("merges different fields on the same override", () => {
    const first = withOverride(role, scenario, { constraintId: "role-work-mode", kind: "work_mode", value: ["remote"] });
    const next = withOverride(role, first, { constraintId: "role-work-mode", kind: "work_mode", importance: "preferred" });
    expect(next.overrides).toEqual([{ constraintId: "role-work-mode", kind: "work_mode", value: ["remote"], importance: "preferred" }]);
    expect(first.overrides[0]).not.toHaveProperty("importance");
  });
});

describe("scenario comparison", () => {
  const check = { constraintId: "check", direction: "employer" as const, importance: "mandatory" as const, weight: 1, status: "pass" as const, reasonCode: "test", evidence: [] };
  const result: MatchResult = { candidateId: "a", eligibility: "eligible", preferenceScore: null, evidenceCoverage: 100, checks: [check] };
  it("reports metric-only changes and changed importance without eligibility transition", () => {
    const next: MatchResult = { ...result, preferenceScore: 100, checks: [{ ...check, importance: "preferred" }] };
    const details = compareScenarioDetails([result], [next]);
    expect(details.comparison).toEqual({ newlyEligible: [], newlyBlocked: [], newlyNeedsClarification: [], changedChecks: { a: ["check"] } });
    expect(details.deltas).toEqual([{ candidateId: "a", before: { eligibility: "eligible", preferenceScore: null, evidenceCoverage: 100 }, after: { eligibility: "eligible", preferenceScore: 100, evidenceCoverage: 100 } }]);
  });
  it("detects removed/added checks, ignores input order, rejects candidate mismatches", () => {
    const other = { ...result, candidateId: "b" };
    const next = { ...result, checks: [] };
    expect(compareScenarios([other, result], [next, other]).changedChecks).toEqual({ a: ["check"] });
    expect(compareScenarios([result, other], [other, next])).toEqual(compareScenarios([other, result], [next, other]));
    expect(compareScenarios([next], [result]).changedChecks).toEqual({ a: ["check"] });
    expect(() => compareScenarios([result], [other])).toThrow("identical");
    expect(() => compareScenarios([result, result], [result])).toThrow("Duplicate");
    expect(() => compareScenarios([result], [{ ...result, checks: [check, check] }])).toThrow("Duplicate check");
  });
  it.each(["direction", "importance", "weight", "status", "reasonCode", "clarificationQuestion", "evidence"])("detects %s differences", (field) => {
    const edits = { direction: "candidate", importance: "preferred", weight: 2, status: "unknown", reasonCode: "other", clarificationQuestion: "Why?", evidence: [{ sourceId: "source", start: 0, end: 1, quote: "a" }] };
    const edited = { ...check, [field]: edits[field as keyof typeof edits] };
    expect(compareScenarios([result], [{ ...result, checks: [edited] } as MatchResult]).changedChecks).toEqual({ a: ["check"] });
  });
  it("ignores check ordering but detects evidence changes, including ordering", () => {
    const evidence = [{ sourceId: "source", start: 0, end: 1, quote: "a" }, { sourceId: "source", start: 1, end: 2, quote: "b" }];
    const a = { ...check, evidence };
    const b = { ...check, constraintId: "second" };
    expect(compareScenarios([{ ...result, checks: [a, b] }], [{ ...result, checks: [b, a] }]).changedChecks).toEqual({});
    expect(compareScenarios([{ ...result, checks: [a, b] }], [{ ...result, checks: [b, { ...a, evidence: [...evidence].reverse() }] }]).changedChecks).toEqual({ a: ["check"] });
  });
  it("records entering each eligibility category", () => {
    for (const [eligibility, key] of [["eligible", "newlyEligible"], ["blocked", "newlyBlocked"], ["needs_clarification", "newlyNeedsClarification"]] as const) {
      const before = { ...result, eligibility: eligibility === "eligible" ? "blocked" as const : "eligible" as const };
      expect(compareScenarios([before], [{ ...result, eligibility }])[key]).toEqual(["a"]);
    }
  });
});
