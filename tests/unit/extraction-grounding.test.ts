import { describe, expect, it } from "vitest";
import { roleSchema } from "@/lib/domain/schemas";
import { groundExtraction, resolveQuote } from "@/lib/extraction/grounding";
import { claim, output } from "../helpers/extraction";

describe("grounded extraction drafts", () => {
  it("preserves exact text/UTF-16 evidence and supports each known claim kind", () => {
    const text = "😀\nRole: Founding Engineer\nMust have TypeScript skills.\nAnnual base salary budget USD 120000 to 180000.\nWork policy: office only.\nPermitted locations: us-san-francisco.\nMust start by 2027-01-15.";
    const proposed = output([
      claim(),
      claim({ kind: "salary", value: { min: 120000, max: 180000, currency: "USD", basis: "annual_base", minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false }, quote: "Annual base salary budget USD 120000 to 180000." }),
      claim({ kind: "work_mode", value: ["office"], quote: "Work policy: office only." }),
      claim({ kind: "location", value: ["us-san-francisco"], quote: "Permitted locations: us-san-francisco." }),
      claim({ kind: "latest_start", value: "2027-01-15", quote: "Must start by 2027-01-15." }),
    ]);
    proposed.title = { value: "Founding Engineer", quote: "Role: Founding Engineer", start: null, end: null };
    const before = structuredClone(proposed);
    const result = groundExtraction(text, proposed);
    expect(roleSchema.safeParse(result.draftRole).success).toBe(true);
    expect(result.draftRole.title).toBe("Founding Engineer");
    expect(result.draftRole.sources[0].text).toBe(text);
    expect(result.draftRole.constraints.every((c) => c.requirement.value !== null)).toBe(true);
    for (const item of result.draftRole.constraints.flatMap((c) => c.requirement.evidence)) expect(text.slice(item.start, item.end)).toBe(item.quote);
    expect(result.draftRole.constraints[0].requirement.evidence[0].start).toBe(text.indexOf("Must"));
    expect(groundExtraction(text, proposed)).toEqual(result);
    expect(proposed).toEqual(before);
  });
  it("requires disambiguation for repeated quotes and validates supplied bounds", () => {
    const quote = "Must have TypeScript skills."; const text = `${quote}\n${quote}`;
    expect(resolveQuote(text, { quote, start: null, end: null }).code).toBe("ambiguous_quote");
    const start = text.lastIndexOf(quote);
    expect(resolveQuote(text, { quote, start, end: start + quote.length }).evidence?.start).toBe(start);
    expect(resolveQuote(text, { quote, start: 0, end: 999 }).code).toBe("invalid_span");
    expect(resolveQuote(text, { quote: "absent", start: null, end: null }).code).toBe("missing_quote");
    expect(groundExtraction(text, output()).draftRole.constraints[0].requirement.value).toBeNull();
  });
  it.each([
    claim({ quote: null }), claim({ value: "react" }), claim({ value: "rust" }), claim({ value: "constructor" }),
    claim({ quote: "TypeScript is not required." }), claim({ quote: "We might require TypeScript skills." }),
    claim({ quote: "Must have TypeScript or Python skills." }), claim({ value: "react", quote: "Must have React Native experience." }),
    claim({ kind: "location", value: ["mars"], quote: "Permitted locations: mars." }),
    claim({ kind: "location", value: ["us"], quote: "Permitted locations: us-san-francisco." }),
    claim({ kind: "latest_start", value: "2027-02-30", quote: "Must start by 2027-02-30." }),
  ])("keeps unsupported or ungrounded claim %# unknown without evidence", (item) => {
    const result = groundExtraction(item.quote ?? "Must have TypeScript skills.", output([item]));
    expect(result.draftRole.constraints[0].requirement).toEqual({ value: null, origin: "extracted", evidence: [] });
    expect(result.warnings.some((w) => ["missing_quote", "unsupported_value"].includes(w.code))).toBe(true);
  });
  it("does not assume salary currency/units or trust unrelated numerical quotes", () => {
    for (const quote of ["Salary USD 120000 to 180000 monthly.", "Annual base salary budget EUR 120000 to 180000.", "Annual base salary budget USD 100000 to 150000.", "Annual base salary budget USD 120000 to 180000.5.", "Annual base salary budget USD 120000 to -180000.", "Annual base salary budget USD 120000 to − 180000.", "Annual base salary budget USD 120000 to +180000."]) {
      const item = claim({ kind: "salary", quote, value: { min: 120000, max: 180000, currency: "USD", basis: "annual_base", minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false } });
      expect(groundExtraction(quote, output([item])).draftRole.constraints[0].requirement.value).toBeNull();
    }
    const quote = "Salary 120000 to 180000.";
    const item = claim({ kind: "salary", quote, value: { min: 120000, max: 180000, currency: null, basis: null, minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false } });
    expect(groundExtraction(quote, output([item])).warnings.some((w) => w.code === "missing_salary_units")).toBe(true);
  });
  it("warns on inferred importance, unknown fields/title and empty requirements", () => {
    const result = groundExtraction("TypeScript experience.", { ...output([claim({ quote: "TypeScript experience.", importanceExplicit: false })]), unsupportedFields: ["visa sponsorship"] });
    expect(result.draftRole.constraints[0].importance).toBe("preferred");
    expect(result.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["inferred_importance", "unsupported_field", "title_unconfirmed", "review_required"]));
    expect(groundExtraction("A role.", output([])).warnings.map((w) => w.code)).toContain("no_requirements");
    expect(groundExtraction("A role.", output([claim({ value: null, quote: null })])).warnings.map((w) => w.code)).toContain("unknown_fact");
    expect(() => groundExtraction("A role.", { ...output(), extra: "untrusted" })).toThrow();
  });
  it.each([
    claim({ kind: "salary", quote: "Annual base salary USD -120000 to 180000.", value: { min: 120000, max: 180000, currency: "USD", basis: "annual_base", minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false } }),
    claim({ kind: "work_mode", quote: "Remote work is prohibited.", value: ["remote"] }),
    claim({ kind: "location", quote: "Permitted locations: us except ca.", value: ["ca"] }),
  ])("rejects explicitly contradictory source text rather than promoting it to a known fact %#", (item) => {
    const result = groundExtraction(item.quote!, output([item]));
    expect(result.draftRole.constraints[0].requirement).toEqual({ value: null, origin: "extracted", evidence: [] });
    expect(result.warnings.some((warning) => warning.code === "unsupported_value")).toBe(true);
  });
  it.each(["-120000", "- 120000", "−120000", "− 120000", "+120000", "＋ 120000", "—120000"])("does not drop a sign from salary lower amount %s", (minimum) => {
    const quote = `Annual base salary USD ${minimum} to 180000.`;
    const item = claim({ kind: "salary", quote, value: { min: 120000, max: 180000, currency: "USD", basis: "annual_base", minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false } });
    const result = groundExtraction(quote, output([item]));
    expect(result.draftRole.constraints[0].requirement).toEqual({ value: null, evidence: [], origin: "extracted" });
    expect(result.warnings.some((w) => w.code === "unsupported_value")).toBe(true);
  });
  it.each(["120000 to 180000.", "120000-180000.", "120000 - 180000.", "120,000 – 180,000."])("retains positive salary range %s", (range) => {
    const quote = `Annual base salary USD ${range}`;
    const value = { min: 120000, max: 180000, currency: "USD", basis: "annual_base", minExplicitlyUnbounded: false, maxExplicitlyUnbounded: false };
    expect(groundExtraction(quote, output([claim({ kind: "salary", quote, value })])).draftRole.constraints[0].requirement.value).toEqual(value);
  });
  it.each([
    "Remote work is disallowed.", "Remote work is banned.", "Remote work is forbidden.", "Remote work isn't allowed.",
    "We don't offer remote work.", "We don’t offer remote work.", "Required remote work is prohibited unless approved.",
  ])("rejects work-policy exclusion including importance: %s", (quote) => {
    const result = groundExtraction(quote, output([claim({ kind: "work_mode", value: ["remote"], quote })]));
    expect(result.draftRole.constraints[0]).toMatchObject({ importance: "preferred", requirement: { value: null, evidence: [] } });
    expect(result.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["unsupported_value", "inferred_importance"]));
  });
  it.each(["Permitted locations: us, excluding ca.", "Permitted locations: ca is excluded.", "Permitted locations: us except ca unless approved."])("rejects excluded geographic claims: %s", (quote) => {
    expect(groundExtraction(quote, output([claim({ kind: "location", value: ["ca"], quote })])).draftRole.constraints[0].requirement.value).toBeNull();
  });
  it("preserves affirmative modes and locations under the shared language gate", () => {
    for (const item of [claim({ kind: "work_mode", value: ["remote"], quote: "Required work policy: remote." }), claim({ kind: "location", value: ["ca"], quote: "Required permitted locations: ca." })]) {
      const result = groundExtraction(item.quote!, output([item]));
      expect(result.draftRole.constraints[0]).toMatchObject({ importance: "mandatory", requirement: { value: item.value } });
    }
  });
});
