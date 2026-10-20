import type { Candidate, Constraint, ConstraintCheck, Evidence, Role } from "@/lib/domain/types";
import {
  evaluateAvailability, evaluateLocations, evaluateSalary, evaluateSkill,
  evaluateWorkModes, unknown, type Evaluation,
} from "./evaluators";

function uniqueEvidence(evidence: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = JSON.stringify([item.sourceId, item.start, item.end, item.quote]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({ ...item }));
}

/** Inputs must have passed domain validation. Disabled checks produce no result. */
export function evaluateConstraint(constraint: Constraint, role: Role, candidate: Candidate): ConstraintCheck | null {
  if (!constraint.enabled) return null;
  const evidence = [...constraint.requirement.evidence];
  let evaluation: Evaluation;

  if (constraint.direction === "employer") {
    switch (constraint.kind) {
      case "skill":
        evidence.push(...candidate.skills.evidence, ...candidate.explicitlyDeclinedSkills.evidence);
        evaluation = evaluateSkill(constraint.requirement.value, candidate.skills.value, candidate.explicitlyDeclinedSkills.value);
        break;
      case "salary":
        evidence.push(...candidate.salaryExpectation.evidence);
        evaluation = evaluateSalary(constraint.requirement.value, candidate.salaryExpectation.value);
        break;
      case "work_mode":
        evidence.push(...candidate.acceptedWorkModes.evidence);
        evaluation = evaluateWorkModes(constraint.requirement.value, candidate.acceptedWorkModes.value);
        break;
      case "location":
        evidence.push(...candidate.acceptedLocations.evidence);
        evaluation = evaluateLocations(constraint.requirement.value, candidate.acceptedLocations.value);
        break;
      case "latest_start":
        evidence.push(...candidate.earliestStartDate.evidence);
        evaluation = evaluateAvailability(constraint.requirement.value, candidate.earliestStartDate.value);
        break;
    }
  } else if (constraint.kind === "skill") {
    const skillRequirements = role.constraints.filter((item) => item.enabled && item.kind === "skill");
    const supplied: string[] = [];
    for (const item of skillRequirements) {
      if (item.kind === "skill" && item.requirement.value !== null) {
        supplied.push(item.requirement.value);
        evidence.push(...item.requirement.evidence);
      }
    }
    evaluation = evaluateSkill(constraint.requirement.value, supplied);
  } else if (constraint.kind === "latest_start") {
    // A role's latest deadline does not establish its actual or earliest start date.
    evaluation = unknown("role_start_date_unknown", "What start date does the role offer, and does it meet the candidate's latest acceptable start?");
  } else {
    const offers = role.constraints.filter((item) => item.enabled && item.kind === constraint.kind);
    evidence.push(...offers.flatMap((item) => item.requirement.evidence));
    if (offers.length > 1) {
      evaluation = unknown("role_offer_ambiguous", `Which ${constraint.kind} offering applies to this role?`);
    } else {
      const offer = offers[0];
      if (constraint.kind === "salary") {
        evaluation = evaluateSalary(offer?.kind === "salary" ? offer.requirement.value : null, constraint.requirement.value);
      } else if (constraint.kind === "work_mode") {
        evaluation = evaluateWorkModes(offer?.kind === "work_mode" ? offer.requirement.value : null, constraint.requirement.value);
      } else {
        evaluation = evaluateLocations(offer?.kind === "location" ? offer.requirement.value : null, constraint.requirement.value);
      }
    }
  }

  return {
    constraintId: constraint.id,
    direction: constraint.direction,
    importance: constraint.importance,
    weight: constraint.weight,
    ...evaluation,
    evidence: uniqueEvidence(evidence),
  };
}

/** Independent checks in input order: employer requirements, then candidate preferences.
 * Work mode and geography remain separate checks; remote never bypasses geography.
 * Eligibility aggregation, scoring, and ranking belong to T05.
 */
export function evaluateConstraints(role: Role, candidate: Candidate): ConstraintCheck[] {
  return [...role.constraints, ...candidate.preferences].flatMap((constraint) => {
    const check = evaluateConstraint(constraint, role, candidate);
    return check === null ? [] : [check];
  });
}
