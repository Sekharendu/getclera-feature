import { describe, expect, it } from "vitest";
import expectations from "@/data/demo-expectations.json";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import { matchResultSchema } from "@/lib/domain/schemas";
import { evaluateMatch, evaluateMatches } from "@/lib/matching/match";
import { explainMatch } from "@/lib/matching/explanations";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe("full fixture matching", () => {
  it("agrees with all 25 independent eligibility expectations and counts", () => {
    const data = deepFreeze(loadDemoFixtures());
    const before = structuredClone(data);
    const results = evaluateMatches(data.role, data.candidates);
    expect(results).toHaveLength(25);
    for (const expected of expectations) expect(results.find((r) => r.candidateId === expected.candidateId)?.eligibility, expected.reason).toBe(expected.eligibility);
    for (const eligibility of ["eligible", "blocked", "needs_clarification"]) {
      expect(results.filter((r) => r.eligibility === eligibility)).toHaveLength(expectations.filter((e) => e.eligibility === eligibility).length);
    }
    expect(evaluateMatches(data.role, [...data.candidates].reverse())).toEqual(results);
    expect(data).toEqual(before);
  });
  it("validates results and preserves exact source slices and questions", () => {
    const data = loadDemoFixtures();
    const sources = new Map([data.role, ...data.candidates].flatMap((record) => record.sources).map((source) => [source.id, source.text]));
    for (const result of evaluateMatches(data.role, data.candidates)) {
      expect(matchResultSchema.safeParse(result).success).toBe(true);
      for (const evidence of result.checks.flatMap((c) => c.evidence)) {
        expect(sources.get(evidence.sourceId)?.slice(evidence.start, evidence.end)).toBe(evidence.quote);
      }
      expect(explainMatch(result).questions).toHaveLength(result.checks.filter((c) => c.status === "unknown" && c.clarificationQuestion).length);
    }
  });
  it("keeps all independent blockers and treats preferred-only misses as nonblocking", () => {
    const data = loadDemoFixtures();
    for (const id of ["candidate-15", "candidate-16", "candidate-25"]) {
      const result = evaluateMatch(data.role, data.candidates.find((c) => c.id === id)!);
      expect(result.eligibility).toBe("blocked");
      const explanation = explainMatch(result);
      if (id === "candidate-15") {
        expect(explanation.checks.filter((c) => c.category === "blocker").map((c) => c.reasonCode)).toEqual(expect.arrayContaining(["work_mode_disjoint", "salary_disjoint"]));
      } else {
        const failedReason = id === "candidate-16" ? "skill_explicitly_declined" : "location_disjoint";
        const unknownReason = id === "candidate-16" ? "salary_unknown" : "skill_not_supplied";
        expect(explanation.checks).toEqual(expect.arrayContaining([
          expect.objectContaining({ category: "blocker", reasonCode: failedReason }),
          expect.objectContaining({ category: "clarification", reasonCode: unknownReason }),
        ]));
      }
    }
    for (const id of ["candidate-22", "candidate-23", "candidate-24"]) {
      expect(evaluateMatch(data.role, data.candidates.find((c) => c.id === id)!).eligibility).toBe("eligible");
    }
  });
  it("ignores disabled zero-weight requirements and supports manual known facts", () => {
    const { role, candidates } = loadDemoFixtures();
    const candidate = candidates[0];
    role.constraints = role.constraints.map((c) => ({ ...c, enabled: false, weight: 0 }));
    candidate.preferences = [];
    expect(evaluateMatch(role, candidate)).toMatchObject({ eligibility: "eligible", checks: [], preferenceScore: null, evidenceCoverage: null });
    role.constraints = [{ id: "manual-skill", kind: "skill", direction: "employer", importance: "mandatory", weight: 1, enabled: true, requirement: { value: "typescript", evidence: [], origin: "manual" } }];
    candidate.skills = { value: ["typescript"], evidence: [], origin: "manual" };
    candidate.explicitlyDeclinedSkills = { value: [], evidence: [], origin: "manual" };
    expect(evaluateMatch(role, candidate)).toMatchObject({ eligibility: "eligible", preferenceScore: null, evidenceCoverage: 100 });
    expect(evaluateMatch(role, candidate).checks[0].evidence).toEqual([]);
  });
});
