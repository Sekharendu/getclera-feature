import { z } from "zod";
import roleData from "@/data/demo-role.json";
import candidateData from "@/data/demo-candidates.json";
import { candidateSchema, idSchema, roleSchema } from "./schemas";

/** Demo-only invariants; general role/candidate schemas also support manual facts. */
export const fixtureDatasetSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fictional: z.literal(true),
  label: z.literal("Fictional demonstration data — not real people or a live job"),
  currency: z.literal("USD"),
  role: roleSchema,
  candidates: z.array(candidateSchema).length(25),
}).superRefine((dataset, ctx) => {
  const ids = new Set<string>();
  const remember = (id: string, path: (string | number)[]) => {
    if (ids.has(id)) ctx.addIssue({ code: "custom", path, message: "Dataset IDs must be globally unique" });
    ids.add(id);
  };
  const records = [
    { record: dataset.role, path: ["role"] },
    ...dataset.candidates.map((record, index) => ({ record, path: ["candidates", index] })),
  ];
  records.forEach(({ record, path }) => {
    remember(record.id, [...path, "id"]);
    if (record.sources.length === 0) {
      ctx.addIssue({ code: "custom", path: [...path, "sources"], message: "Fixtures require source text" });
    }
    record.sources.forEach((source, index) => remember(source.id, [...path, "sources", index, "id"]));
    const key = "constraints" in record ? "constraints" : "preferences";
    const constraints = "constraints" in record ? record.constraints : record.preferences;
    constraints.forEach((constraint, index) => remember(constraint.id, [...path, key, index, "id"]));
    const facts = constraints.map((constraint, index) => ({
      fact: constraint.requirement, path: [...path, key, index, "requirement"],
    }));
    if ("skills" in record) {
      const fields = ["skills", "explicitlyDeclinedSkills", "salaryExpectation", "acceptedWorkModes", "acceptedLocations", "earliestStartDate"] as const;
      fields.forEach((field) => facts.push({ fact: record[field], path: [...path, field] }));
    }
    facts.forEach(({ fact, path: factPath }) => {
      if (fact.origin !== "fixture") {
        ctx.addIssue({ code: "custom", path: [...factPath, "origin"], message: "Demo facts must declare fixture origin" });
      }
      if (fact.value !== null && typeof fact.value === "object" && "currency" in fact.value && fact.value.currency !== dataset.currency) {
        ctx.addIssue({ code: "custom", path: [...factPath, "value", "currency"], message: "Fixture salaries must use the dataset currency" });
      }
    });
  });
});

export type FixtureDataset = z.infer<typeof fixtureDatasetSchema>;

/** Validates unknown JSON, including evidence references, before it enters the app. */
export function parseFixtureDataset(input: unknown): FixtureDataset {
  return fixtureDatasetSchema.parse(input);
}

/** Zod returns a fresh parsed copy on every load; edits cannot change imported JSON. */
export function loadDemoFixtures(): FixtureDataset {
  return parseFixtureDataset({
    schemaVersion: 1,
    fictional: true,
    label: "Fictional demonstration data — not real people or a live job",
    currency: "USD",
    role: roleData,
    candidates: candidateData,
  });
}

/** Hand-authored expectations, kept separate from computed matching results. */
export const fixtureExpectationSchema = z.strictObject({
  candidateId: idSchema,
  eligibility: z.enum(["eligible", "blocked", "needs_clarification"]),
  reason: z.string().min(1),
});
