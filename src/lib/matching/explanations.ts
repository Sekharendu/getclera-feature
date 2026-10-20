import type { ConstraintCheck, MatchResult } from "@/lib/domain/types";

/** Static descriptions say only what the evaluator established; no inferred facts. */
export const reasonDescriptions: Readonly<Record<string, string>> = {
  skill_requirement_unknown: "The required skill is unspecified.",
  skill_statements_conflict: "Supplied and explicitly declined skill statements conflict.",
  skill_explicitly_declined: "The required skill is explicitly declined.",
  skill_supplied: "The required skill is supplied, including documented exact aliases.",
  skill_not_supplied: "The required skill has not been confirmed; omission is not rejection.",
  salary_unknown: "A salary range is missing.",
  salary_units_missing: "Salary currency or compensation basis is missing.",
  salary_units_incompatible: "Salary ranges cannot be compared in the same currency and annual base basis.",
  salary_range_invalid: "A salary range needs correction.",
  salary_endpoint_unknown: "A salary endpoint is unknown rather than explicitly unbounded.",
  salary_overlap: "The salary ranges overlap, including their boundaries.",
  salary_disjoint: "The salary ranges do not overlap.",
  work_mode_none_accepted: "A work-mode list explicitly accepts no modes.",
  work_mode_unknown: "An offered or accepted work-mode list is missing.",
  work_mode_unsupported: "A work mode needs normalization before comparison.",
  work_mode_overlap: "There is a shared remote or office work mode.",
  hybrid_schedule_unknown: "A shared hybrid mode needs attendance-schedule clarification.",
  work_mode_disjoint: "The offered and accepted work modes do not overlap.",
  location_none_accepted: "A geographic list explicitly accepts no locations.",
  location_unknown: "A permitted or accepted geographic list is missing.",
  location_overlap: "There is a shared canonical geographic ID.",
  location_scope_unknown: "Different geographic scopes need explicit confirmation.",
  location_disjoint: "The geographic lists do not overlap.",
  availability_unknown: "A start-date boundary is missing.",
  availability_within_deadline: "The earliest available start is on or before the latest acceptable start.",
  availability_after_deadline: "The earliest available start is after the latest acceptable start.",
  role_start_date_unknown: "The role's latest deadline does not establish its offered start date.",
  role_offer_ambiguous: "Multiple role offerings need clarification before comparison.",
};

export interface CheckExplanation extends ConstraintCheck {
  text: string;
  category: "blocker" | "clarification" | "satisfied" | "preference_miss";
}

export interface MatchExplanation {
  summary: string;
  checks: CheckExplanation[];
  questions: { constraintId: string; direction: ConstraintCheck["direction"]; question: string }[];
  preferenceLabel: string;
  coverageLabel: string;
  disclaimer: string;
}

export function explainMatch(result: MatchResult): MatchExplanation {
  const fallback = { pass: "This check passed.", fail: "This check failed.", unknown: "This check needs clarification." };
  const checks: CheckExplanation[] = result.checks.map((check) => ({
    ...check,
    evidence: check.evidence.map((item) => ({ ...item })),
    text: Object.hasOwn(reasonDescriptions, check.reasonCode) ? reasonDescriptions[check.reasonCode] : fallback[check.status],
    category: check.status === "unknown" ? "clarification" : check.status === "pass" ? "satisfied" :
      check.importance === "mandatory" ? "blocker" : "preference_miss",
  }));
  const summaries = {
    blocked: "One or more mandatory checks failed. All independent blockers and unresolved questions remain listed.",
    needs_clarification: "No mandatory check failed, but mandatory facts need clarification.",
    eligible: "All evaluated mandatory checks passed, or no mandatory checks were defined.",
  };
  return {
    summary: checks.length === 0 ? "No requirements were evaluated. Define requirements before assessing fit." : summaries[result.eligibility],
    checks,
    questions: checks.flatMap((check) => check.status === "unknown" && check.clarificationQuestion ? [{
      constraintId: check.constraintId, direction: check.direction, question: check.clarificationQuestion,
    }] : []),
    preferenceLabel: result.preferenceScore === null ? "No preferences scored" : "Weighted preferred fit",
    coverageLabel: result.evidenceCoverage === null ? "No checks evaluated" : "Weighted known-outcome coverage",
    disclaimer: "Preferred fit is a rule-based comparison, not a hiring probability. Coverage measures known check outcomes, including manual facts and failures; it does not certify source completeness. Eligibility is not an employment recommendation or verification of qualifications.",
  };
}
