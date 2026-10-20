import { describe, expect, it } from "vitest";
import type { ConstraintCheck, MatchResult } from "@/lib/domain/types";
import { aggregateEligibility, evidenceCoverage, preferenceScore, rankMatches } from "@/lib/matching/match";

function check(status: ConstraintCheck["status"], importance: ConstraintCheck["importance"] = "mandatory", weight = 1): ConstraintCheck {
  return { constraintId: "test", direction: "employer", status, importance, weight, reasonCode: "test", evidence: [] };
}
function result(candidateId: string, overrides: Partial<MatchResult> = {}): MatchResult {
  return { candidateId, eligibility: "eligible", preferenceScore: 50, evidenceCoverage: 50, checks: [], ...overrides };
}

describe("eligibility and weighted metrics", () => {
  it.each(["employer", "candidate"] as const)("prioritizes mandatory failure over unknown in %s direction", (direction) => {
    expect(aggregateEligibility([check("unknown"), { ...check("fail"), direction }])).toBe("blocked");
    expect(aggregateEligibility([{ ...check("unknown"), direction }, check("fail", "preferred")])).toBe("needs_clarification");
  });
  it("does not block on preferred failures or unknowns", () => {
    expect(aggregateEligibility([check("pass"), check("fail", "preferred"), check("unknown", "preferred")])).toBe("eligible");
  });
  it("separates passed preference weights from all known outcome weights", () => {
    const checks = [check("pass", "mandatory", 10), check("pass", "preferred", 2), check("fail", "preferred", 3), check("unknown", "preferred", 5)];
    expect(preferenceScore(checks)).toBe(20);
    expect(evidenceCoverage(checks)).toBe(75);
  });
  it("distinguishes no preferences from unknown preferences", () => {
    expect(preferenceScore([check("pass")])).toBeNull();
    expect(preferenceScore([check("unknown", "preferred")])).toBe(0);
    expect(evidenceCoverage([check("unknown")])).toBe(0);
    expect(evidenceCoverage([check("fail")])).toBe(100);
  });
  it("uses explicit empty semantics", () => {
    expect(aggregateEligibility([])).toBe("eligible");
    expect(preferenceScore([])).toBeNull();
    expect(evidenceCoverage([])).toBeNull();
  });
  it("handles maximum and subnormal finite positive weights without overflow", () => {
    for (const weight of [Number.MAX_VALUE, Number.MIN_VALUE]) {
      const checks = [check("pass", "preferred", weight), check("unknown", "preferred", weight)];
      expect(preferenceScore(checks)).toBe(50);
      expect(evidenceCoverage(checks)).toBe(50);
    }
  });
});

describe("ranking", () => {
  it("prioritizes eligibility before score", () => {
    expect(rankMatches([result("blocked", { eligibility: "blocked", preferenceScore: 100 }), result("unknown", { eligibility: "needs_clarification", preferenceScore: 90 }), result("eligible", { preferenceScore: 0 })]).map((r) => r.candidateId)).toEqual(["eligible", "unknown", "blocked"]);
  });
  it("prioritizes score then coverage then explicit lexical ID", () => {
    const input = [result("z", { preferenceScore: 51, evidenceCoverage: 0 }), result("a", { evidenceCoverage: 99 }), result("b"), result("a")];
    const before = structuredClone(input);
    expect(rankMatches(Object.freeze(input)).map((r) => r.candidateId)).toEqual(["z", "a", "a", "b"]);
    expect(input).toEqual(before);
    expect(rankMatches([...input].reverse())).toEqual(rankMatches(input));
  });
  it("places numeric zero ahead of null for either metric", () => {
    expect(rankMatches([result("a", { preferenceScore: null, evidenceCoverage: 100 }), result("b", { preferenceScore: 0, evidenceCoverage: null })])[0].candidateId).toBe("b");
    expect(rankMatches([result("a", { evidenceCoverage: null }), result("b", { evidenceCoverage: 0 })])[0].candidateId).toBe("b");
  });
});
