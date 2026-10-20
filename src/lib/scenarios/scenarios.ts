import type { Candidate, Constraint, ConstraintPatch, MatchResult, Role, Scenario, ScenarioComparison } from "@/lib/domain/types";
import { roleSchema, scenarioSchema } from "@/lib/domain/schemas";
import { evaluateMatches } from "@/lib/matching/match";

const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Stable structural equality: object key order is irrelevant; array order is not. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => canonical(item)));
  if (value && typeof value === "object") return JSON.stringify(Object.entries(value).sort(([a], [b]) => lexical(a, b)).map(([key, item]) => [key, canonical(item)]));
  return JSON.stringify(value) ?? "undefined";
}

function equivalentValue(kind: Constraint["kind"], left: unknown, right: unknown): boolean {
  if ((kind === "work_mode" || kind === "location") && Array.isArray(left) && Array.isArray(right)) {
    return canonical([...left].sort(lexical)) === canonical([...right].sort(lexical));
  }
  return canonical(left) === canonical(right);
}

export function createScenario(role: Role, id = "working-scenario"): Scenario {
  return scenarioSchema.parse({ id, roleId: role.id, baselineRevision: role.revision, overrides: [] });
}

/** Reset deliberately creates a fresh identity against the supplied baseline revision. */
export function resetScenario(role: Role, id = "working-scenario"): Scenario {
  return createScenario(role, id);
}

function validatedScenario(role: Role, input: unknown): Scenario {
  const scenario = scenarioSchema.parse(input);
  if (scenario.roleId !== role.id) throw new Error("Scenario role ID does not match baseline");
  if (scenario.baselineRevision !== role.revision) throw new Error("Scenario baseline revision is stale");
  for (const patch of scenario.overrides) {
    const constraint = role.constraints.find((item) => item.id === patch.constraintId);
    if (!constraint) throw new Error(`Unknown role constraint: ${patch.constraintId}`);
    if (constraint.kind !== patch.kind) throw new Error(`Constraint kind mismatch: ${patch.constraintId}`);
  }
  return scenario;
}

/** Returned role is fully detached from baseline. Reparse rejects invalid effective constraints. */
export function applyScenario(role: Role, input: unknown): Role {
  const scenario = validatedScenario(role, input);
  const effective = structuredClone(role);
  for (const patch of scenario.overrides) {
    const constraint = effective.constraints.find((item) => item.id === patch.constraintId)!;
    if (patch.enabled === true && constraint.weight === 0) throw new Error(`Cannot enable zero-weight constraint: ${constraint.id}`);
    if (patch.importance !== undefined) constraint.importance = patch.importance;
    if (patch.enabled !== undefined) constraint.enabled = patch.enabled;
    if (patch.value !== undefined && !equivalentValue(constraint.kind, constraint.requirement.value, patch.value)) {
      // Kind equality was checked above; final role parsing enforces each value contract.
      Object.assign(constraint, { requirement: { value: structuredClone(patch.value), origin: "manual", evidence: [] } });
    }
  }
  return roleSchema.parse(effective);
}

export function editedConstraintIds(baseline: Role, effective: Role): string[] {
  return baseline.constraints.filter((before) => {
    const after = effective.constraints.find((item) => item.id === before.id);
    return !after || before.kind !== after.kind || before.importance !== after.importance || before.enabled !== after.enabled ||
      !equivalentValue(before.kind, before.requirement.value, after.requirement.value);
  }).map((constraint) => constraint.id).sort(lexical);
}

export interface ScenarioEvaluation {
  role: Role;
  matches: MatchResult[];
  editedIds: string[];
}

export function evaluateScenario(baseline: Role, candidates: readonly Candidate[], scenario: unknown): ScenarioEvaluation {
  const role = applyScenario(baseline, scenario);
  return { role, matches: evaluateMatches(role, candidates), editedIds: editedConstraintIds(baseline, role) };
}

export type MatchMetrics = Pick<MatchResult, "eligibility" | "preferenceScore" | "evidenceCoverage">;
export interface CandidateDelta {
  candidateId: string;
  before: MatchMetrics;
  after: MatchMetrics;
}
function indexMatches(results: readonly MatchResult[]): Map<string, MatchResult> {
  const map = new Map<string, MatchResult>();
  for (const result of results) {
    if (map.has(result.candidateId)) throw new Error(`Duplicate candidate result: ${result.candidateId}`);
    const checks = new Set<string>();
    for (const check of result.checks) {
      if (checks.has(check.constraintId)) throw new Error(`Duplicate check ID: ${check.constraintId}`);
      checks.add(check.constraintId);
    }
    map.set(result.candidateId, result);
  }
  return map;
}

export function compareScenarioDetails(baseline: readonly MatchResult[], scenario: readonly MatchResult[]): { comparison: ScenarioComparison; deltas: CandidateDelta[] } {
  const before = indexMatches(baseline);
  const after = indexMatches(scenario);
  if (before.size !== after.size || [...before.keys()].some((id) => !after.has(id))) throw new Error("Scenario comparison requires identical candidate sets");
  const comparison: ScenarioComparison = { newlyEligible: [], newlyBlocked: [], newlyNeedsClarification: [], changedChecks: {} };
  const deltas: CandidateDelta[] = [];
  for (const id of [...before.keys()].sort(lexical)) {
    const old = before.get(id)!;
    const next = after.get(id)!;
    if (old.eligibility !== next.eligibility) {
      const key = { eligible: "newlyEligible", blocked: "newlyBlocked", needs_clarification: "newlyNeedsClarification" } as const;
      comparison[key[next.eligibility]].push(id);
    }
    const oldChecks = new Map(old.checks.map((check) => [check.constraintId, check]));
    const nextChecks = new Map(next.checks.map((check) => [check.constraintId, check]));
    const changed = [...new Set([...oldChecks.keys(), ...nextChecks.keys()])].filter((checkId) => canonical(oldChecks.get(checkId)) !== canonical(nextChecks.get(checkId))).sort(lexical);
    if (changed.length) Object.defineProperty(comparison.changedChecks, id, { value: changed, enumerable: true, configurable: true, writable: true });
    const metrics = (result: MatchResult): MatchMetrics => ({ eligibility: result.eligibility, preferenceScore: result.preferenceScore, evidenceCoverage: result.evidenceCoverage });
    if (canonical(metrics(old)) !== canonical(metrics(next))) deltas.push({ candidateId: id, before: metrics(old), after: metrics(next) });
  }
  return { comparison, deltas };
}

export function compareScenarios(baseline: readonly MatchResult[], scenario: readonly MatchResult[]): ScenarioComparison {
  return compareScenarioDetails(baseline, scenario).comparison;
}

/** Merge partial edits by ID so suggestions preserve other changes to the same requirement. */
export function withOverride(role: Role, input: unknown, patch: ConstraintPatch): Scenario {
  const scenario = validatedScenario(role, input);
  const previous = scenario.overrides.find((item) => item.constraintId === patch.constraintId);
  const combined = { ...previous, ...patch };
  const next = { ...scenario, overrides: [...scenario.overrides.filter((item) => item.constraintId !== patch.constraintId), combined].sort((a, b) => lexical(a.constraintId, b.constraintId)) };
  applyScenario(role, next);
  return scenarioSchema.parse(next);
}
