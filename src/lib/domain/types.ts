/** Initial domain contracts. Runtime validation is implemented in T03. */
export type SourceKind = "job_description" | "candidate_profile";
export type Origin = "fixture" | "extracted" | "manual";
export type CheckStatus = "pass" | "fail" | "unknown";
export type Eligibility = "eligible" | "blocked" | "needs_clarification";
export type WorkMode = "remote" | "hybrid" | "office";
export type Direction = "employer" | "candidate";

export interface SourceDocument {
  id: string;
  kind: SourceKind;
  text: string;
}

export interface Evidence {
  sourceId: string;
  quote: string;
  /** UTF-16 offsets; source.text.slice(start, end) must equal quote. */
  start: number;
  end: number;
}

export interface Fact<T> {
  value: T | null;
  evidence: Evidence[];
  origin: Origin;
}

export interface SalaryRange {
  min: number | null;
  max: number | null;
  currency: string;
  basis: "annual_base";
  /** A null endpoint is unbounded only when explicitly stated. */
  minExplicitlyUnbounded: boolean;
  maxExplicitlyUnbounded: boolean;
}

interface ConstraintBase {
  id: string;
  direction: Direction;
  importance: "mandatory" | "preferred";
  weight: number;
  enabled: boolean;
}

export type Constraint = ConstraintBase & (
  | { kind: "skill"; requirement: Fact<string> }
  | { kind: "salary"; requirement: Fact<SalaryRange> }
  | { kind: "work_mode"; requirement: Fact<WorkMode[]> }
  | { kind: "location"; requirement: Fact<string[]> }
  | { kind: "latest_start"; requirement: Fact<string> }
);

export interface Role {
  id: string;
  title: string;
  revision: number;
  sources: SourceDocument[];
  constraints: Constraint[];
}

export interface Candidate {
  id: string;
  displayName: string;
  sources: SourceDocument[];
  skills: Fact<string[]>;
  explicitlyDeclinedSkills: Fact<string[]>;
  salaryExpectation: Fact<SalaryRange>;
  acceptedWorkModes: Fact<WorkMode[]>;
  acceptedLocations: Fact<string[]>;
  earliestStartDate: Fact<string>;
  preferences: Constraint[];
}

export interface ConstraintCheck {
  constraintId: string;
  direction: Direction;
  importance: "mandatory" | "preferred";
  weight: number;
  status: CheckStatus;
  reasonCode: string;
  evidence: Evidence[];
  clarificationQuestion?: string;
}

export interface MatchResult {
  candidateId: string;
  eligibility: Eligibility;
  preferenceScore: number | null;
  evidenceCoverage: number | null;
  checks: ConstraintCheck[];
}

/** Value changes retain the discriminator of their target constraint. */
export type ConstraintPatch = {
  constraintId: string;
  importance?: "mandatory" | "preferred";
  enabled?: boolean;
} & (
  | { kind: "skill"; value?: string }
  | { kind: "salary"; value?: SalaryRange }
  | { kind: "work_mode"; value?: WorkMode[] }
  | { kind: "location"; value?: string[] }
  | { kind: "latest_start"; value?: string }
);

export interface Scenario {
  id: string;
  roleId: string;
  baselineRevision: number;
  overrides: ConstraintPatch[];
}

export interface ScenarioComparison {
  newlyEligible: string[];
  newlyBlocked: string[];
  newlyNeedsClarification: string[];
  changedChecks: Record<string, string[]>;
}
