import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ConstraintCheck, MatchResult } from "@/lib/domain/types";
import { explainMatch, reasonDescriptions } from "@/lib/matching/explanations";

const result: MatchResult = { candidateId: "test", eligibility: "eligible", preferenceScore: null, evidenceCoverage: null, checks: [] };
const check: ConstraintCheck = { constraintId: "test", direction: "candidate", importance: "mandatory", weight: 1, status: "unknown", reasonCode: "future-code", evidence: [], clarificationQuestion: "Can this be confirmed?" };

describe("deterministic explanations", () => {
  it("covers every literal reason code emitted by T04", () => {
    const source = ["evaluators.ts", "evaluate.ts"].map((file) => readFileSync(`src/lib/matching/${file}`, "utf8")).join("\n");
    const codes = [...source.matchAll(/(?:unknown\(|reasonCode:\s*)"([a-z_]+)"/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(20);
    for (const code of codes) expect(reasonDescriptions[code], code).toBeTruthy();
  });
  it("labels no preferences and no requirements explicitly", () => {
    const explanation = explainMatch(result);
    expect(explanation.preferenceLabel).toBe("No preferences scored");
    expect(explanation.summary).toContain("Define requirements");
    expect(explanation.disclaimer).toContain("not a hiring probability");
  });
  it("preserves independent blockers, unknown questions, direction and evidence", () => {
    const evidence = { sourceId: "source", quote: "Text", start: 0, end: 4 };
    const input: MatchResult = { ...result, eligibility: "blocked", checks: [
      { ...check, constraintId: "one", status: "fail", reasonCode: "salary_disjoint", evidence: [evidence] },
      { ...check, constraintId: "two", direction: "employer", status: "fail", reasonCode: "work_mode_disjoint" }, check,
      { ...check, constraintId: "preferred", importance: "preferred", status: "fail" },
    ] };
    const before = structuredClone(input);
    const explanation = explainMatch(input);
    expect(explanation.checks.map((c) => c.category)).toEqual(["blocker", "blocker", "clarification", "preference_miss"]);
    expect(explanation.questions).toEqual([{ constraintId: "test", direction: "candidate", question: check.clarificationQuestion }]);
    expect(explanation.checks[0].evidence).toEqual([evidence]);
    expect(explanation.checks[0].evidence[0]).not.toBe(evidence);
    expect(explanation.checks[2].text).toBe("This check needs clarification.");
    expect(explainMatch(input)).toEqual(explanation);
    expect(input).toEqual(before);
  });
  it.each(["pass", "fail", "unknown"] as const)("uses neutral fallback for future %s codes, including object property names", (status) => {
    for (const reasonCode of ["future-code", "constructor"]) {
      expect(explainMatch({ ...result, checks: [{ ...check, status, reasonCode }] }).checks[0].text).toBe({ pass: "This check passed.", fail: "This check failed.", unknown: "This check needs clarification." }[status]);
    }
  });
});
