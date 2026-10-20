import { describe, expect, it } from "vitest";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import { evaluateMatches } from "@/lib/matching/match";
import { compareScenarios, createScenario, evaluateScenario, resetScenario, withOverride } from "@/lib/scenarios/scenarios";
import { evaluateSuggestions } from "@/lib/scenarios/suggestions";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

describe("evaluated fixture scenarios and suggestions", () => {
  it("remote improves candidate02, preserves candidate15 salary blocker, and never mutates baseline", () => {
    const { role, candidates } = freeze(loadDemoFixtures());
    const before = structuredClone({ role, candidates });
    const scenario = freeze(withOverride(role, createScenario(role), { constraintId: "role-work-mode", kind: "work_mode", value: ["office", "remote"] }));
    const base = evaluateMatches(role, candidates);
    const next = evaluateScenario(role, candidates, scenario);
    expect(next.matches.find((r) => r.candidateId === "candidate-02")?.eligibility).toBe("eligible");
    const oak = next.matches.find((r) => r.candidateId === "candidate-15")!;
    expect(oak.eligibility).toBe("blocked");
    expect(oak.checks).toEqual(expect.arrayContaining([expect.objectContaining({ reasonCode: "salary_disjoint", status: "fail", importance: "mandatory" })]));
    expect(compareScenarios(base, next.matches).newlyEligible).toContain("candidate-02");
    expect(next.editedIds).toEqual(["role-work-mode"]);
    expect(evaluateScenario(role, [...candidates].reverse(), scenario)).toEqual(next);
    expect(evaluateScenario(role, candidates, resetScenario(role)).matches).toEqual(base);
    expect({ role, candidates }).toEqual(before);
  });
  it("disabling removes only one check and retains independent salary/candidate checks", () => {
    const { role, candidates } = loadDemoFixtures();
    const baseline = evaluateMatches(role, candidates);
    const scenario = withOverride(role, createScenario(role), { constraintId: "role-work-mode", kind: "work_mode", enabled: false });
    const next = evaluateScenario(role, candidates, scenario);
    const oak = next.matches.find((r) => r.candidateId === "candidate-15")!;
    expect(oak.eligibility).toBe("blocked");
    expect(oak.checks.some((c) => c.constraintId === "role-work-mode")).toBe(false);
    expect(oak.checks.some((c) => c.status === "fail" && c.reasonCode === "salary_disjoint")).toBe(true);
    expect(next.matches.find((r) => r.candidateId === "candidate-06")?.eligibility).toBe("blocked");
    expect(compareScenarios(baseline, next.matches).changedChecks["candidate-15"]).toContain("role-work-mode");
  });
  it("computed suggestions match direct evaluations, merge overrides, and remain independent", () => {
    const { role, candidates } = freeze(loadDemoFixtures());
    const scenario = freeze(withOverride(role, createScenario(role), { constraintId: "role-work-mode", kind: "work_mode", value: ["office", "remote"] }));
    const proposals = [{ constraintId: "role-work-mode", kind: "work_mode" as const, importance: "preferred" as const }, { constraintId: "role-salary", kind: "salary" as const, importance: "preferred" as const }];
    const suggestions = evaluateSuggestions(role, candidates, scenario, proposals);
    expect(evaluateSuggestions(role, [...candidates].reverse(), scenario, proposals)).toEqual(suggestions);
    expect(suggestions[0].scenario.overrides.find((p) => p.constraintId === "role-work-mode")).toMatchObject({ value: ["office", "remote"], importance: "preferred" });
    expect(suggestions[1].scenario.overrides.find((p) => p.constraintId === "role-work-mode")).not.toHaveProperty("importance");
    for (const suggestion of suggestions) {
      const direct = evaluateScenario(role, candidates, suggestion.scenario);
      for (const category of ["eligible", "blocked", "needs_clarification"] as const) expect(suggestion.counts[category]).toBe(direct.matches.filter((r) => r.eligibility === category).length);
      expect(suggestion.tradeoff).toContain("Optional change");
    }
    expect(suggestions[0].remaining.find((r) => r.candidateId === "candidate-15")?.blockers.length).toBeGreaterThan(0);
    expect(suggestions[1].comparison.newlyEligible).not.toContain("candidate-15");
    expect(suggestions[1].remaining.find((r) => r.candidateId === "candidate-15")?.blockers).toContain("candidate-15-preference-salary");
    const remoteOption = evaluateSuggestions(role, candidates, createScenario(role), [{ constraintId: "role-work-mode", kind: "work_mode", value: ["office", "remote"] }])[0];
    expect(remoteOption.comparison.newlyEligible).toContain("candidate-02");
    expect(remoteOption.remaining.find((r) => r.candidateId === "candidate-15")?.blockers).toContain("candidate-15-preference-salary");
    expect(evaluateSuggestions(role, candidates, scenario, proposals, 1)).toHaveLength(1);
    expect(evaluateSuggestions(role, candidates, scenario, undefined, 0)).toEqual([]);
    expect(() => evaluateSuggestions(role, candidates, scenario, proposals, 51)).toThrow("limit");
    expect(() => evaluateSuggestions(role, candidates, scenario, [{ constraintId: "missing", kind: "skill", enabled: false }])).toThrow("Unknown");
  });
  it("built-in suggestions are bounded and keep candidate preferences and unknowns visible", () => {
    const { role, candidates } = loadDemoFixtures();
    const suggestions = evaluateSuggestions(role, candidates, createScenario(role), undefined, 2);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.patch.importance === "preferred")).toBe(true);
    expect(suggestions.some((s) => s.remaining.some((r) => r.unknowns.length > 0))).toBe(true);
  });
});
