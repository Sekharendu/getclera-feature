import { describe, expect, it } from "vitest";
import {
  canonicalSkillId, evaluateAvailability, evaluateLocations, evaluateSalary,
  evaluateSkill, evaluateWorkModes, type SalaryInput,
} from "@/lib/matching/evaluators";

const salary: SalaryInput = {
  min: 120000, max: 180000, currency: "USD", basis: "annual_base",
  minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false,
};

describe("skills", () => {
  it.each([
    ["ts", "typescript"], [" JS ", "javascript"], ["Node.js", "nodejs"],
    ["node", "nodejs"], ["React.js", "react"], ["reactjs", "react"],
  ])("normalizes the exact alias %s", (alias, expected) => {
    expect(canonicalSkillId(alias)).toBe(expected);
    expect(evaluateSkill(expected, [alias]).status).toBe("pass");
  });

  it.each([
    ["typescript", ["typescript"], [], "pass"],
    ["typescript", null, ["ts"], "fail"],
    ["typescript", ["react"], [], "unknown"],
    ["typescript", [], [], "unknown"],
    ["typescript", null, null, "unknown"],
    [null, ["typescript"], [], "unknown"],
    ["javascript", ["java"], [], "unknown"],
    ["react", ["react-native"], [], "unknown"],
    ["sql", ["postgresql"], [], "unknown"],
    ["nodejs", ["node"], ["node.js"], "unknown"],
  ] as const)("evaluates skill %s against %j and declined %j", (required, supplied, declined, status) => {
    expect(evaluateSkill(required, supplied, declined).status).toBe(status);
  });
});

describe("salary interval comparison", () => {
  const cases: [string, SalaryInput | null, SalaryInput | null, string][] = [
    ["interior overlap", salary, { ...salary, min: 130000, max: 170000 }, "pass"],
    ["upper boundary equality", salary, { ...salary, min: 180000, max: 200000 }, "pass"],
    ["lower boundary equality", salary, { ...salary, min: 100000, max: 120000 }, "pass"],
    ["one unit above", salary, { ...salary, min: 180001, max: 200000 }, "fail"],
    ["one unit below", salary, { ...salary, min: 100000, max: 119999 }, "fail"],
    ["missing salary", salary, null, "unknown"],
    ["missing budget", null, salary, "unknown"],
    ["missing currency", salary, { ...salary, currency: undefined }, "unknown"],
    ["missing basis", salary, { ...salary, basis: null }, "unknown"],
    ["different currency", salary, { ...salary, currency: "EUR" }, "unknown"],
    ["different basis", salary, { ...salary, basis: "monthly" }, "unknown"],
    ["both unsupported bases", { ...salary, basis: "monthly" }, { ...salary, basis: "monthly" }, "unknown"],
    ["missing upper endpoint", salary, { ...salary, max: null }, "unknown"],
    ["missing lower endpoint", salary, { ...salary, min: null }, "unknown"],
    ["explicit open upper endpoint", salary, { ...salary, max: null, maxExplicitlyUnbounded: true }, "pass"],
    ["explicit open lower endpoint", salary, { ...salary, min: null, minExplicitlyUnbounded: true }, "pass"],
    ["open range still disjoint", salary, { ...salary, min: 180001, max: null, maxExplicitlyUnbounded: true }, "fail"],
    ["both endpoints unbounded", salary, { ...salary, min: null, max: null, minExplicitlyUnbounded: true, maxExplicitlyUnbounded: true }, "pass"],
    ["reversed bounds", salary, { ...salary, min: 200000 }, "unknown"],
    ["invalid infinite bound", salary, { ...salary, max: Infinity }, "unknown"],
    ["negative bound", salary, { ...salary, min: -1 }, "unknown"],
    ["contradictory bound flag", salary, { ...salary, maxExplicitlyUnbounded: true }, "unknown"],
    ["zero is a known bound", { ...salary, min: 0, max: 0 }, { ...salary, min: 0, max: 0 }, "pass"],
  ];
  it.each(cases)("handles %s symmetrically", (_label, left, right, status) => {
    expect(evaluateSalary(left, right).status).toBe(status);
    expect(evaluateSalary(right, left).status).toBe(status);
  });
});

describe("work policies", () => {
  it.each([
    [["office"], ["office"], "pass"],
    [["remote"], ["office", "remote"], "pass"],
    [["office"], ["remote"], "fail"],
    [[], ["office"], "fail"],
    [["remote"], [], "fail"],
    [null, ["office"], "unknown"],
    [["office"], null, "unknown"],
    [["flexible"], ["office"], "unknown"],
    [["remote", "flexible"], ["remote"], "unknown"],
    [["hybrid"], ["hybrid"], "unknown"],
    [["hybrid"], ["office"], "fail"],
    [["hybrid", "remote"], ["hybrid", "remote"], "pass"],
  ] as const)("compares %j with %j", (left, right, status) => {
    expect(evaluateWorkModes(left, right).status).toBe(status);
  });
});

describe("locations", () => {
  it.each([
    [["us-san-francisco"], ["us-san-francisco"], "pass"],
    [["us-san-francisco"], ["us-new-york"], "fail"],
    [["us"], ["ca"], "fail"],
    [["us", "ca"], ["ca"], "pass"],
    [["us"], ["us-san-francisco"], "unknown"],
    [["us-san-francisco"], ["us"], "unknown"],
    [["us"], null, "unknown"],
    [null, ["us"], "unknown"],
    [[], ["us"], "fail"],
  ] as const)("compares %j with %j", (left, right, status) => {
    expect(evaluateLocations(left, right).status).toBe(status);
  });
});

describe("availability", () => {
  it.each([
    ["2027-01-15", "2027-01-14", "pass"],
    ["2027-01-15", "2027-01-15", "pass"],
    ["2027-01-15", "2027-01-16", "fail"],
    ["2027-01-01", "2026-12-31", "pass"],
    [null, "2027-01-15", "unknown"],
    ["2027-01-15", null, "unknown"],
  ] as const)("compares deadline %s with earliest start %s", (latest, earliest, status) => {
    expect(evaluateAvailability(latest, earliest).status).toBe(status);
  });
});
