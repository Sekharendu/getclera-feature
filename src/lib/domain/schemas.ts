import { z } from "zod";

export const idSchema = z.string().regex(/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/);
export const sourceKindSchema = z.enum(["job_description", "candidate_profile"]);
export const originSchema = z.enum(["fixture", "extracted", "manual"]);
export const checkStatusSchema = z.enum(["pass", "fail", "unknown"]);
export const eligibilitySchema = z.enum(["eligible", "blocked", "needs_clarification"]);
export const workModeSchema = z.enum(["remote", "hybrid", "office"]);
export const directionSchema = z.enum(["employer", "candidate"]);
const importanceSchema = z.enum(["mandatory", "preferred"]);
const nonemptyText = z.string().refine((text) => text.trim().length > 0, "Must not be blank");
const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((values) => new Set(values).size === values.length, "Duplicate values");

export const sourceDocumentSchema = z.strictObject({
  id: idSchema,
  kind: sourceKindSchema,
  text: nonemptyText,
});

export const evidenceSchema = z.strictObject({
  sourceId: idSchema,
  quote: nonemptyText,
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
}).refine((span) => span.end > span.start, "Evidence end must follow start");

/** No coercion or text normalization: source offsets must survive validation. */
export function factSchema<T extends z.ZodType>(valueSchema: T) {
  return z.strictObject({
    value: valueSchema.nullable(),
    evidence: z.array(evidenceSchema),
    origin: originSchema,
  }).superRefine((fact, ctx) => {
    if (!("value" in fact)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Facts require a value or explicit null" });
      return;
    }
    if (fact.value === null && fact.evidence.length > 0) {
      ctx.addIssue({ code: "custom", path: ["evidence"], message: "Unknown facts must have no evidence" });
    }
    if (fact.value !== null && fact.origin !== "manual" && fact.evidence.length === 0) {
      ctx.addIssue({ code: "custom", path: ["evidence"], message: "Known source facts require evidence" });
    }
    if (fact.origin === "manual" && fact.evidence.length > 0) {
      ctx.addIssue({ code: "custom", path: ["evidence"], message: "Manual overrides must not claim source evidence" });
    }
  });
}

export const salaryRangeSchema = z.strictObject({
  min: z.number().finite().nonnegative().nullable(),
  max: z.number().finite().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  basis: z.literal("annual_base"),
  minExplicitlyUnbounded: z.boolean(),
  maxExplicitlyUnbounded: z.boolean(),
}).superRefine((salary, ctx) => {
  if (salary.min !== null && salary.max !== null && salary.min > salary.max) {
    ctx.addIssue({ code: "custom", path: ["max"], message: "Maximum must be at least minimum" });
  }
  for (const endpoint of ["min", "max"] as const) {
    if (salary[endpoint] !== null && salary[`${endpoint}ExplicitlyUnbounded`]) {
      ctx.addIssue({ code: "custom", path: [endpoint], message: "A bounded endpoint cannot also be unbounded" });
    }
  }
});

export const isoDateSchema = z.iso.date();
const skillListSchema = uniqueList(idSchema);
const locationListSchema = uniqueList(idSchema);
const workModeListSchema = uniqueList(workModeSchema);
const constraintBase = {
  id: idSchema,
  direction: directionSchema,
  importance: importanceSchema,
  weight: z.number().finite().nonnegative(),
  enabled: z.boolean(),
};

export const constraintSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...constraintBase, kind: z.literal("skill"), requirement: factSchema(idSchema) }),
  z.strictObject({ ...constraintBase, kind: z.literal("salary"), requirement: factSchema(salaryRangeSchema) }),
  z.strictObject({ ...constraintBase, kind: z.literal("work_mode"), requirement: factSchema(workModeListSchema) }),
  z.strictObject({ ...constraintBase, kind: z.literal("location"), requirement: factSchema(locationListSchema) }),
  z.strictObject({ ...constraintBase, kind: z.literal("latest_start"), requirement: factSchema(isoDateSchema) }),
]).refine((constraint) => !constraint.enabled || constraint.weight > 0, {
  path: ["weight"], message: "Enabled constraints require positive weights",
});

type Source = z.infer<typeof sourceDocumentSchema>;
type GroundedFact = { evidence: z.infer<typeof evidenceSchema>[] };
type Constraint = z.infer<typeof constraintSchema>;

function validateRecord(
  sources: Source[], constraints: Constraint[], direction: z.infer<typeof directionSchema>,
  facts: { fact: GroundedFact; path: (string | number)[] }[], ctx: z.RefinementCtx,
) {
  const sourceMap = new Map<string, Source>();
  sources.forEach((source, index) => {
    if (sourceMap.has(source.id)) {
      ctx.addIssue({ code: "custom", path: ["sources", index, "id"], message: "Duplicate source ID" });
    }
    sourceMap.set(source.id, source);
    const expectedKind = direction === "employer" ? "job_description" : "candidate_profile";
    if (source.kind !== expectedKind) {
      ctx.addIssue({ code: "custom", path: ["sources", index, "kind"], message: `Expected ${expectedKind} source` });
    }
  });
  const constraintIds = new Set<string>();
  const key = direction === "employer" ? "constraints" : "preferences";
  constraints.forEach((constraint, index) => {
    if (constraintIds.has(constraint.id)) {
      ctx.addIssue({ code: "custom", path: [key, index, "id"], message: "Duplicate constraint ID" });
    }
    constraintIds.add(constraint.id);
    if (constraint.direction !== direction) {
      ctx.addIssue({ code: "custom", path: [key, index, "direction"], message: `Expected ${direction} direction` });
    }
    facts.push({ fact: constraint.requirement, path: [key, index, "requirement"] });
  });
  facts.forEach(({ fact, path }) => fact.evidence.forEach((evidence, index) => {
    const source = sourceMap.get(evidence.sourceId);
    if (!source || evidence.end > source.text.length || source.text.slice(evidence.start, evidence.end) !== evidence.quote) {
      ctx.addIssue({ code: "custom", path: [...path, "evidence", index], message: "Evidence must reference an exact UTF-16 span in this record's sources" });
    }
  }));
}

export const roleSchema = z.strictObject({
  id: idSchema,
  title: nonemptyText,
  revision: z.number().int().positive(),
  sources: z.array(sourceDocumentSchema),
  constraints: z.array(constraintSchema),
}).superRefine((role, ctx) => validateRecord(role.sources, role.constraints, "employer", [], ctx));

export const candidateSchema = z.strictObject({
  id: idSchema,
  displayName: nonemptyText,
  sources: z.array(sourceDocumentSchema),
  skills: factSchema(skillListSchema),
  explicitlyDeclinedSkills: factSchema(skillListSchema),
  salaryExpectation: factSchema(salaryRangeSchema),
  acceptedWorkModes: factSchema(workModeListSchema),
  acceptedLocations: factSchema(locationListSchema),
  earliestStartDate: factSchema(isoDateSchema),
  preferences: z.array(constraintSchema),
}).superRefine((candidate, ctx) => {
  const fields = ["skills", "explicitlyDeclinedSkills", "salaryExpectation", "acceptedWorkModes", "acceptedLocations", "earliestStartDate"] as const;
  validateRecord(candidate.sources, candidate.preferences, "candidate", fields.map((field) => ({
    fact: candidate[field], path: [field],
  })), ctx);
  const declined = new Set(candidate.explicitlyDeclinedSkills.value ?? []);
  if (candidate.skills.value?.some((skill) => declined.has(skill))) {
    ctx.addIssue({ code: "custom", path: ["explicitlyDeclinedSkills"], message: "A skill cannot be both supplied and explicitly declined" });
  }
});

export const constraintCheckSchema = z.strictObject({
  constraintId: idSchema,
  direction: directionSchema,
  importance: importanceSchema,
  weight: z.number().finite().positive(),
  status: checkStatusSchema,
  reasonCode: idSchema,
  evidence: z.array(evidenceSchema),
  clarificationQuestion: nonemptyText.optional(),
});

const percentage = z.number().finite().min(0).max(100).nullable();
export const matchResultSchema = z.strictObject({
  candidateId: idSchema,
  eligibility: eligibilitySchema,
  preferenceScore: percentage,
  evidenceCoverage: percentage,
  checks: z.array(constraintCheckSchema),
});

const patchBase = {
  constraintId: idSchema,
  importance: importanceSchema.optional(),
  enabled: z.boolean().optional(),
};
export const constraintPatchSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...patchBase, kind: z.literal("skill"), value: idSchema.optional() }),
  z.strictObject({ ...patchBase, kind: z.literal("salary"), value: salaryRangeSchema.optional() }),
  z.strictObject({ ...patchBase, kind: z.literal("work_mode"), value: workModeListSchema.optional() }),
  z.strictObject({ ...patchBase, kind: z.literal("location"), value: locationListSchema.optional() }),
  z.strictObject({ ...patchBase, kind: z.literal("latest_start"), value: isoDateSchema.optional() }),
]).refine((patch) => patch.value !== undefined || patch.importance !== undefined || patch.enabled !== undefined, "Patch must include a change");

export const scenarioSchema = z.strictObject({
  id: idSchema,
  roleId: idSchema,
  baselineRevision: z.number().int().positive(),
  overrides: z.array(constraintPatchSchema),
}).refine((scenario) => new Set(scenario.overrides.map((patch) => patch.constraintId)).size === scenario.overrides.length, "Duplicate override constraint IDs");

export const scenarioComparisonSchema = z.strictObject({
  newlyEligible: uniqueList(idSchema),
  newlyBlocked: uniqueList(idSchema),
  newlyNeedsClarification: uniqueList(idSchema),
  changedChecks: z.record(idSchema, uniqueList(idSchema)),
});
