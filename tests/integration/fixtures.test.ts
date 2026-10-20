import { describe, expect, it } from "vitest";
import { z } from "zod";
import expectations from "@/data/demo-expectations.json";
import {
  fixtureExpectationSchema, loadDemoFixtures, parseFixtureDataset,
  type FixtureDataset,
} from "@/lib/domain/fixtures";

describe("fictional fixture loader", () => {
  it("loads one role and 25 profiles with stable, unique IDs and explicit sample labels", () => {
    const data = loadDemoFixtures();
    expect(data.fictional).toBe(true);
    expect(data.candidates).toHaveLength(25);
    expect(data.role.constraints.map((constraint) => constraint.id)).toContain("role-work-mode");
    expect(new Set(data.candidates.map((candidate) => candidate.id)).size).toBe(25);
    expect(data.candidates.every((candidate) => candidate.sources[0].text.includes("FICTIONAL"))).toBe(true);
    expect(data.candidates.every((candidate) => candidate.preferences.length >= 3)).toBe(true);
  });

  it("documents one hand-authored expected outcome per profile without computing matches", () => {
    const cases = z.array(fixtureExpectationSchema).length(25).parse(expectations);
    expect(cases.map((testCase) => testCase.candidateId).sort()).toEqual(loadDemoFixtures().candidates.map((candidate) => candidate.id).sort());
    expect(cases.filter((testCase) => testCase.eligibility === "eligible")).toHaveLength(8);
    expect(cases.filter((testCase) => testCase.eligibility === "blocked")).toHaveLength(9);
    expect(cases.filter((testCase) => testCase.eligibility === "needs_clarification")).toHaveLength(8);
  });

  it("uses exact UTF-16 offsets even when the source contains emoji", () => {
    const candidate = loadDemoFixtures().candidates[0];
    const source = candidate.sources[0];
    const span = candidate.skills.evidence[0];
    expect(source.text).toContain("🌱");
    expect(source.text.slice(span.start, span.end)).toBe(span.quote);
    expect(Array.from(source.text.slice(0, span.start)).length).toBeLessThan(span.start);
  });

  const corruptions: [string, (data: FixtureDataset) => void][] = [
    ["wrong candidate count", (data) => { data.candidates.pop(); }],
    ["duplicate candidate ID", (data) => { data.candidates[1].id = data.candidates[0].id; }],
    ["duplicate source ID", (data) => { data.candidates[1].sources[0].id = data.candidates[0].sources[0].id; }],
    ["duplicate preference ID across profiles", (data) => { data.candidates[1].preferences[0].id = data.candidates[0].preferences[0].id; }],
    ["unknown source reference", (data) => { data.candidates[0].skills.evidence[0].sourceId = "missing-source"; }],
    ["another profile's source", (data) => { data.candidates[0].skills.evidence[0].sourceId = data.candidates[1].sources[0].id; }],
    ["mismatched quote", (data) => { data.candidates[0].skills.evidence[0].quote = "invented quote"; }],
    ["wrong UTF-16 offset", (data) => { data.candidates[0].skills.evidence[0].start -= 1; }],
    ["out-of-bounds span", (data) => { data.candidates[0].skills.evidence[0].end = 999999; }],
    ["broken candidate preference evidence", (data) => { data.candidates[0].preferences[0].requirement.evidence[0].quote = "invented"; }],
    ["broken role evidence", (data) => { data.role.constraints[0].requirement.evidence[0].quote = "invented"; }],
    ["duplicate sources within record", (data) => { data.role.sources.push(data.role.sources[0]); }],
    ["wrong source kind", (data) => { data.candidates[0].sources[0].kind = "job_description"; }],
    ["missing source text", (data) => { data.candidates[0].sources[0].text = "   "; }],
    ["missing required evidence", (data) => { data.candidates[0].skills.evidence = []; }],
    ["non-fixture origin", (data) => { data.candidates[0].skills.origin = "extracted"; }],
    ["mixed candidate currency", (data) => { data.candidates[0].salaryExpectation.value!.currency = "EUR"; }],
    ["mixed preference currency", (data) => {
      const preference = data.candidates[0].preferences[0];
      if (preference.kind === "salary") preference.requirement.value!.currency = "EUR";
    }],
  ];
  it.each(corruptions)("rejects %s", (_label, corrupt) => {
    const data = loadDemoFixtures();
    corrupt(data);
    expect(() => parseFixtureDataset(data)).toThrow(z.ZodError);
  });

  it("returns fresh copies so callers cannot alter subsequent loads", () => {
    const first = loadDemoFixtures();
    first.candidates[0].skills.value!.push("python");
    first.role.constraints[0].enabled = false;
    const next = loadDemoFixtures();
    expect(next.candidates[0].skills.value).not.toContain("python");
    expect(next.role.constraints[0].enabled).toBe(true);
  });
});
