import type { CheckStatus } from "@/lib/domain/types";

export interface Evaluation {
  status: CheckStatus;
  reasonCode: string;
  clarificationQuestion?: string;
}

export function unknown(reasonCode: string, clarificationQuestion: string): Evaluation {
  return { status: "unknown", reasonCode, clarificationQuestion };
}

const aliases = new Map([
  ["ts", "typescript"], ["js", "javascript"],
  ["node", "nodejs"], ["node.js", "nodejs"],
  ["reactjs", "react"], ["react.js", "react"],
]);

/** Exact, documented aliases only. No substring, fuzzy, or related-skill matching. */
export function canonicalSkillId(skill: string): string {
  const normalized = skill.trim().toLowerCase();
  return aliases.get(normalized) ?? normalized;
}

export function evaluateSkill(
  required: string | null, supplied: readonly string[] | null,
  declined: readonly string[] | null = null,
): Evaluation {
  if (required === null || required.trim() === "") {
    return unknown("skill_requirement_unknown", "Which skill is required?");
  }
  const skill = canonicalSkillId(required);
  const present = supplied?.some((value) => canonicalSkillId(value) === skill) ?? false;
  const rejected = declined?.some((value) => canonicalSkillId(value) === skill) ?? false;
  if (present && rejected) {
    return unknown("skill_statements_conflict", `Is ${skill} supplied or explicitly declined?`);
  }
  if (rejected) return { status: "fail", reasonCode: "skill_explicitly_declined" };
  if (present) return { status: "pass", reasonCode: "skill_supplied" };
  return unknown("skill_not_supplied", `Can ${skill} be confirmed?`);
}

/** Partial normalized salary data can be inspected without inventing missing units. */
export interface SalaryInput {
  min: number | null;
  max: number | null;
  currency?: string | null;
  basis?: string | null;
  minExplicitlyUnbounded?: boolean;
  maxExplicitlyUnbounded?: boolean;
}

export function evaluateSalary(left: SalaryInput | null, right: SalaryInput | null): Evaluation {
  if (left === null || right === null) {
    return unknown("salary_unknown", "What are the annual base salary budget and acceptable range, including currency?");
  }
  if (!left.currency || !right.currency || !left.basis || !right.basis) {
    return unknown("salary_units_missing", "What currency and compensation basis apply to both salary ranges?");
  }
  if (left.currency !== right.currency || left.basis !== "annual_base" || right.basis !== "annual_base") {
    return unknown("salary_units_incompatible", "Can both salary ranges be supplied as annual base amounts in the same currency?");
  }
  for (const range of [left, right]) {
    if ((range.min !== null && (!Number.isFinite(range.min) || range.min < 0 || range.minExplicitlyUnbounded)) ||
        (range.max !== null && (!Number.isFinite(range.max) || range.max < 0 || range.maxExplicitlyUnbounded)) ||
        (range.min !== null && range.max !== null && range.min > range.max)) {
      return unknown("salary_range_invalid", "What is the corrected minimum and maximum salary?");
    }
    if ((range.min === null && !range.minExplicitlyUnbounded) || (range.max === null && !range.maxExplicitlyUnbounded)) {
      return unknown("salary_endpoint_unknown", "Is each omitted salary endpoint unknown or explicitly unbounded?");
    }
  }
  const lower = Math.max(left.min ?? -Infinity, right.min ?? -Infinity);
  const upper = Math.min(left.max ?? Infinity, right.max ?? Infinity);
  return lower <= upper
    ? { status: "pass", reasonCode: "salary_overlap" }
    : { status: "fail", reasonCode: "salary_disjoint" };
}

/** Hybrid schedule detail is not represented by the current domain model. */
export function evaluateWorkModes(left: readonly string[] | null, right: readonly string[] | null): Evaluation {
  if (left?.length === 0 || right?.length === 0) {
    return { status: "fail", reasonCode: "work_mode_none_accepted" };
  }
  if (left === null || right === null) {
    return unknown("work_mode_unknown", "Which work modes are offered and accepted?");
  }
  const supported = new Set(["remote", "hybrid", "office"]);
  if ([...left, ...right].some((mode) => !supported.has(mode))) {
    return unknown("work_mode_unsupported", "Does the work policy mean remote, hybrid, or office work?");
  }
  const common = left.filter((mode) => right.includes(mode));
  if (common.includes("remote") || common.includes("office")) {
    return { status: "pass", reasonCode: "work_mode_overlap" };
  }
  if (common.includes("hybrid")) {
    return unknown("hybrid_schedule_unknown", "What office attendance schedule is required, and is it accepted?");
  }
  return { status: "fail", reasonCode: "work_mode_disjoint" };
}

/** Canonical IDs only; country membership and commute distances are not inferred. */
export function evaluateLocations(left: readonly string[] | null, right: readonly string[] | null): Evaluation {
  if (left?.length === 0 || right?.length === 0) {
    return { status: "fail", reasonCode: "location_none_accepted" };
  }
  if (left === null || right === null) {
    return unknown("location_unknown", "Which geographic locations are permitted and accepted, including for remote work?");
  }
  if (left.some((location) => right.includes(location))) {
    return { status: "pass", reasonCode: "location_overlap" };
  }
  // Country IDs are two lowercase letters; city IDs include their country prefix.
  // Mixed scopes need explicit canonical facts rather than a guessed containment rule.
  if (left.some((a) => right.some((b) => /^[a-z]{2}$/.test(a) !== /^[a-z]{2}$/.test(b)))) {
    return unknown("location_scope_unknown", "Can geographic eligibility be confirmed using matching city or country IDs?");
  }
  return { status: "fail", reasonCode: "location_disjoint" };
}

export function evaluateAvailability(latestStart: string | null, earliestStart: string | null): Evaluation {
  if (latestStart === null || earliestStart === null) {
    return unknown("availability_unknown", "What are the latest acceptable and earliest available start dates?");
  }
  // Validated YYYY-MM-DD dates sort chronologically without accessing the clock.
  return earliestStart <= latestStart
    ? { status: "pass", reasonCode: "availability_within_deadline" }
    : { status: "fail", reasonCode: "availability_after_deadline" };
}
