import type { Candidate, ConstraintPatch, Eligibility, Role, Scenario } from "@/lib/domain/types";
import { compareScenarioDetails, evaluateScenario, withOverride, type CandidateDelta } from "./scenarios";

export interface ScenarioSuggestion {
  patch: ConstraintPatch;
  scenario: Scenario;
  tradeoff: string;
  counts: Record<Eligibility, number>;
  comparison: ReturnType<typeof compareScenarioDetails>["comparison"];
  deltas: CandidateDelta[];
  remaining: { candidateId: string; blockers: string[]; unknowns: string[] }[];
}

/** Explicitly bounded, independent proposals relative to the current scenario, never cumulative. */
export function evaluateSuggestions(role: Role, candidates: readonly Candidate[], scenario: unknown, proposals?: readonly ConstraintPatch[], limit = 10): ScenarioSuggestion[] {
  if (!Number.isInteger(limit) || limit < 0 || limit > 50) throw new Error("Suggestion limit must be an integer from 0 to 50");
  const current = evaluateScenario(role, candidates, scenario);
  const defaults: ConstraintPatch[] = current.role.constraints.filter((constraint) => constraint.enabled && constraint.importance === "mandatory").map((constraint) => ({ constraintId: constraint.id, kind: constraint.kind, importance: "preferred" }));
  return (proposals ?? defaults).slice(0, limit).map((proposal) => {
    const proposed = withOverride(role, scenario, proposal);
    const evaluation = evaluateScenario(role, candidates, proposed);
    const { comparison, deltas } = compareScenarioDetails(current.matches, evaluation.matches);
    const counts: Record<Eligibility, number> = { eligible: 0, blocked: 0, needs_clarification: 0 };
    evaluation.matches.forEach((match) => counts[match.eligibility]++);
    return {
      patch: structuredClone(proposal), scenario: proposed,
      tradeoff: `Optional change to ${proposal.constraintId}: ${[
        proposal.value !== undefined ? `set requirement to ${JSON.stringify(proposal.value)}` : null,
        proposal.importance !== undefined ? `treat as ${proposal.importance}` : null,
        proposal.enabled !== undefined ? (proposal.enabled ? "enable requirement" : "disable requirement") : null,
      ].filter(Boolean).join("; ")}. This changes the stated requirements; observed results apply only to this loaded sample. Options are evaluated independently, not additively.`,
      counts, comparison, deltas,
      remaining: evaluation.matches.map((match) => ({
        candidateId: match.candidateId,
        blockers: match.checks.filter((check) => check.importance === "mandatory" && check.status === "fail").map((check) => check.constraintId),
        unknowns: match.checks.filter((check) => check.status === "unknown").map((check) => check.constraintId),
      })),
    };
  });
}
