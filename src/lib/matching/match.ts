import type { Candidate, ConstraintCheck, Eligibility, MatchResult, Role } from "@/lib/domain/types";
import { evaluateConstraints } from "./evaluate";

export function aggregateEligibility(checks: readonly ConstraintCheck[]): Eligibility {
  const mandatory = checks.filter((check) => check.importance === "mandatory");
  if (mandatory.some((check) => check.status === "fail")) return "blocked";
  if (mandatory.some((check) => check.status === "unknown")) return "needs_clarification";
  return "eligible";
}

/** Scale first so finite positive input weights cannot overflow their sums. */
function percentage(checks: readonly ConstraintCheck[], included: (check: ConstraintCheck) => boolean): number | null {
  if (checks.length === 0) return null;
  const scale = checks.reduce((max, check) => Math.max(max, check.weight), 0);
  let total = 0;
  let counted = 0;
  for (const check of checks) {
    const weight = check.weight / scale;
    total += weight;
    if (included(check)) counted += weight;
  }
  return Math.min(100, Math.max(0, (counted / total) * 100));
}

export function preferenceScore(checks: readonly ConstraintCheck[]): number | null {
  return percentage(checks.filter((check) => check.importance === "preferred"), (check) => check.status === "pass");
}

export function evidenceCoverage(checks: readonly ConstraintCheck[]): number | null {
  return percentage(checks, (check) => check.status !== "unknown");
}

const eligibilityOrder: Record<Eligibility, number> = { eligible: 0, needs_clarification: 1, blocked: 2 };
function descending(left: number | null, right: number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

/** Returns a sorted copy; numeric zero sorts before an unscored null. */
export function rankMatches(results: readonly MatchResult[]): MatchResult[] {
  return [...results].sort((a, b) =>
    eligibilityOrder[a.eligibility] - eligibilityOrder[b.eligibility] ||
    descending(a.preferenceScore, b.preferenceScore) ||
    descending(a.evidenceCoverage, b.evidenceCoverage) ||
    (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0));
}

/** Inputs must have passed domain validation. All enabled checks remain visible. */
export function evaluateMatch(role: Role, candidate: Candidate): MatchResult {
  const checks = evaluateConstraints(role, candidate);
  return {
    candidateId: candidate.id,
    eligibility: aggregateEligibility(checks),
    preferenceScore: preferenceScore(checks),
    evidenceCoverage: evidenceCoverage(checks),
    checks,
  };
}

export function evaluateMatches(role: Role, candidates: readonly Candidate[]): MatchResult[] {
  return rankMatches(candidates.map((candidate) => evaluateMatch(role, candidate)));
}
