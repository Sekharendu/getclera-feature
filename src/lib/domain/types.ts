/** Domain types are inferred from runtime schemas to prevent contract drift. */
import type { z } from "zod";
import type {
  sourceKindSchema, originSchema, checkStatusSchema, eligibilitySchema,
  workModeSchema, directionSchema, sourceDocumentSchema, evidenceSchema,
  salaryRangeSchema, constraintSchema, roleSchema, candidateSchema,
  constraintCheckSchema, matchResultSchema, constraintPatchSchema,
  scenarioSchema, scenarioComparisonSchema,
} from "./schemas";

export type SourceKind = z.infer<typeof sourceKindSchema>;
export type Origin = z.infer<typeof originSchema>;
export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type Eligibility = z.infer<typeof eligibilitySchema>;
export type WorkMode = z.infer<typeof workModeSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export interface Fact<T> {
  value: T | null;
  evidence: Evidence[];
  origin: Origin;
}
export type SalaryRange = z.infer<typeof salaryRangeSchema>;
export type Constraint = z.infer<typeof constraintSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type ConstraintCheck = z.infer<typeof constraintCheckSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;
export type ConstraintPatch = z.infer<typeof constraintPatchSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioComparison = z.infer<typeof scenarioComparisonSchema>;
