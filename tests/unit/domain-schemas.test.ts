import { describe, expect, it } from "vitest";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import {
  candidateSchema, constraintPatchSchema, constraintSchema, evidenceSchema,
  factSchema, isoDateSchema, matchResultSchema, roleSchema, salaryRangeSchema,
  scenarioSchema,
} from "@/lib/domain/schemas";
import { z } from "zod";

const { role, candidates } = loadDemoFixtures();
const candidate = candidates[0];
const salary = candidate.salaryExpectation.value!;

describe("salary validation", () => {
  it.each([
    ["reversed range", { ...salary, min: 200000, max: 100000 }],
    ["negative salary", { ...salary, min: -1 }],
    ["nonfinite salary", { ...salary, max: Infinity }],
    ["wrong currency format", { ...salary, currency: "usd" }],
    ["missing currency", { ...salary, currency: undefined }],
    ["missing basis", { ...salary, basis: undefined }],
    ["unsupported basis", { ...salary, basis: "monthly" }],
    ["bounded and unbounded minimum", { ...salary, minExplicitlyUnbounded: true }],
    ["bounded and unbounded maximum", { ...salary, maxExplicitlyUnbounded: true }],
  ])("rejects %s", (_label, input) => {
    expect(salaryRangeSchema.safeParse(input).success).toBe(false);
  });

  it("preserves the distinction between omitted and explicitly unbounded endpoints", () => {
    const missing = salaryRangeSchema.parse({ ...salary, max: null });
    const open = salaryRangeSchema.parse({ ...salary, max: null, maxExplicitlyUnbounded: true });
    expect(missing.maxExplicitlyUnbounded).toBe(false);
    expect(open.maxExplicitlyUnbounded).toBe(true);
    expect(salaryRangeSchema.safeParse({ ...salary, min: 0, max: 0 }).success).toBe(true);
  });
});

describe("facts and dates", () => {
  const schema = factSchema(z.array(z.string()));

  it("keeps an explicitly confirmed empty list distinct from unknown", () => {
    expect(schema.parse({ value: [], origin: "manual", evidence: [] }).value).toEqual([]);
    expect(schema.parse({ value: null, origin: "fixture", evidence: [] }).value).toBeNull();
  });

  it("rejects invented evidence and unsupported source facts", () => {
    expect(schema.safeParse({ value: null, origin: "fixture", evidence: candidate.skills.evidence }).success).toBe(false);
    expect(schema.safeParse({ value: ["react"], origin: "extracted", evidence: [] }).success).toBe(false);
    expect(schema.safeParse({ ...candidate.skills, origin: "manual" }).success).toBe(false);
  });

  it.each(["2027-02-29", "2027-04-31", "01/15/2027", "2027-1-15", "2027-01-15T00:00:00Z"])("rejects invalid date %s", (date) => {
    expect(isoDateSchema.safeParse(date).success).toBe(false);
  });

  it("accepts a real leap day", () => {
    expect(isoDateSchema.parse("2028-02-29")).toBe("2028-02-29");
  });
});

describe("domain records", () => {
  it("enforces the constraint discriminator and nonempty stable IDs", () => {
    expect(constraintSchema.safeParse({ ...role.constraints[0], kind: "salary" }).success).toBe(false);
    expect(constraintSchema.safeParse({ ...role.constraints[0], id: "" }).success).toBe(false);
    expect(constraintSchema.safeParse({ ...role.constraints[0], id: "Random ID" }).success).toBe(false);
  });

  it("requires positive active weights but permits a disabled zero-weight requirement", () => {
    expect(constraintSchema.safeParse({ ...role.constraints[0], weight: 0 }).success).toBe(false);
    expect(constraintSchema.safeParse({ ...role.constraints[0], weight: -1 }).success).toBe(false);
    expect(constraintSchema.safeParse({ ...role.constraints[0], enabled: false, weight: 0 }).success).toBe(true);
  });

  it("rejects duplicate constraints and incorrect directions", () => {
    expect(roleSchema.safeParse({ ...role, constraints: [...role.constraints, role.constraints[0]] }).success).toBe(false);
    expect(roleSchema.safeParse({ ...role, constraints: [{ ...role.constraints[0], direction: "candidate" }] }).success).toBe(false);
    expect(candidateSchema.safeParse({ ...candidate, preferences: [{ ...candidate.preferences[0], direction: "employer" }] }).success).toBe(false);
  });

  it("rejects duplicate skills, unsupported modes, conflicting skill statements, and extra fields", () => {
    expect(candidateSchema.safeParse({ ...candidate, skills: { ...candidate.skills, value: ["react", "react"] } }).success).toBe(false);
    expect(candidateSchema.safeParse({ ...candidate, acceptedWorkModes: { ...candidate.acceptedWorkModes, value: ["flexible"] } }).success).toBe(false);
    expect(candidateSchema.safeParse({ ...candidate, explicitlyDeclinedSkills: { ...candidate.skills, value: ["react"] } }).success).toBe(false);
    expect(candidateSchema.safeParse({ ...candidate, age: 30 }).success).toBe(false);
  });

  it("validates evidence offset ordering", () => {
    const evidence = candidate.skills.evidence[0];
    expect(evidenceSchema.safeParse({ ...evidence, start: -1 }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...evidence, end: evidence.start }).success).toBe(false);
  });

  it("rejects invalid score ranges", () => {
    expect(matchResultSchema.safeParse({ candidateId: candidate.id, eligibility: "eligible", preferenceScore: 101, evidenceCoverage: null, checks: [] }).success).toBe(false);
  });

  it("validates typed patches, allows disabling, and rejects duplicate overrides", () => {
    expect(constraintPatchSchema.safeParse({ constraintId: "role-salary", kind: "salary", value: "typescript" }).success).toBe(false);
    expect(constraintPatchSchema.safeParse({ constraintId: "role-salary", kind: "salary" }).success).toBe(false);
    const patch = { constraintId: "role-salary", kind: "salary", enabled: false };
    expect(constraintPatchSchema.safeParse(patch).success).toBe(true);
    expect(scenarioSchema.safeParse({ id: "scenario-demo", roleId: role.id, baselineRevision: 1, overrides: [patch, patch] }).success).toBe(false);
  });
});
