import type { Constraint, Evidence } from "@/lib/domain/types";
import { isoDateSchema, roleSchema, salaryRangeSchema } from "@/lib/domain/schemas";
import { canonicalSkillId } from "@/lib/matching/evaluators";
import { providerOutputSchema, type ExtractionSuccess, type ExtractionWarning, type ProviderClaim } from "./contracts";

const sourceId = "extracted-role-source";
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const token = (text: string, value: string) => new RegExp(`(^|[^a-z0-9])${escapeRegex(value)}(?=$|[^a-z0-9])`, "i").test(text);
const skillAliases: Record<string, string[]> = { typescript: ["typescript", "ts"], javascript: ["javascript", "js"], react: ["react", "react.js", "reactjs"], nodejs: ["node.js", "nodejs", "node"], python: ["python"], sql: ["sql"] };
const locations = new Set(["us", "ca", "us-san-francisco", "us-new-york", "ca-toronto"]);
const uncertain = (quote: string) => /\b(no|not|never|without|avoid|may|might|possibly|depending|tbd|cannot|negative|prohibit(?:ed|s|ing|ion)?|disallow(?:ed|s|ing)?|ban(?:ned|s|ning)?|forbid(?:den|s|ding)?|exclud(?:e|ed|es|ing)|except(?:ing|ions?)?|den(?:ied|y|ies))\b|\b(isn|aren|wasn|weren|don|doesn|didn|can|couldn|won|wouldn|shouldn|mustn|hasn|haven|hadn)['’]t\b/i.test(quote);

export function resolveQuote(text: string, claim: { quote: string | null; start: number | null; end: number | null }): { evidence?: Evidence; code?: string } {
  if (!claim.quote) return { code: "missing_quote" };
  if (claim.start !== null || claim.end !== null) {
    if (claim.start === null || claim.end === null || !Number.isInteger(claim.start) || !Number.isInteger(claim.end) || claim.start < 0 || claim.end > text.length || claim.end <= claim.start || text.slice(claim.start, claim.end) !== claim.quote) return { code: "invalid_span" };
    return { evidence: { sourceId, quote: claim.quote, start: claim.start, end: claim.end } };
  }
  const start = text.indexOf(claim.quote);
  if (start < 0) return { code: "missing_quote" };
  if (text.indexOf(claim.quote, start + 1) >= 0) return { code: "ambiguous_quote" };
  return { evidence: { sourceId, quote: claim.quote, start, end: start + claim.quote.length } };
}

function supported(claim: ProviderClaim, quote: string): boolean {
  // This is a conservative supported-language gate, not arbitrary semantic entailment.
  if (uncertain(quote)) return false;
  switch (claim.kind) {
    case "skill": {
      if (claim.value === null) return false;
      const skill = canonicalSkillId(claim.value);
      const aliases = Object.hasOwn(skillAliases, skill) ? skillAliases[skill] : undefined;
      if (/\b(or|either)\b/i.test(quote) || (skill === "react" && /\breact[ -]native\b/i.test(quote))) return false;
      return !!aliases && aliases.some((alias) => token(quote, alias)) && /\b(skill|experience|must|required|preferred|proficien|knowledge)\b/i.test(quote);
    }
    case "work_mode": return !!claim.value?.length && /\b(work|policy|mode|only)\b/i.test(quote) && claim.value.every((mode) => token(quote, mode));
    case "location": return !!claim.value?.length && /\b(location|locations|geographic|geography|permitted)\b/i.test(quote) && claim.value.every((id) => locations.has(id) && new RegExp(`(^|[^a-z0-9-])${escapeRegex(id)}(?=$|[^a-z0-9-])`, "i").test(quote));
    case "latest_start": return !!claim.value && isoDateSchema.safeParse(claim.value).success && quote.includes(claim.value) && /\b(latest|deadline|by)\b/i.test(quote) && /\b(start|join)\b/i.test(quote);
    case "salary": {
      const value = claim.value;
      if (!value || !salaryRangeSchema.safeParse(value).success || !value.currency || !token(quote, value.currency) || !/\bannual\s+base\b/i.test(quote) || !/\b(salary|budget|compensation)\b/i.test(quote)) return false;
      const clean = quote.replace(/(?<=\d),(?=\d)/g, "");
      if (value.min !== null && value.max !== null) {
        const range = new RegExp(`(?<![\\d.])${escapeRegex(String(value.min))}\\s*(?:to|[-–])\\s*${escapeRegex(String(value.max))}(?!\\d|\\.\\d)`, "i").exec(clean);
        if (!range) return false;
        // Do not consume an unsigned suffix of a signed lower amount. The range's
        // internal hyphen remains a permitted delimiter between positive amounts.
        return !/[+\-−‐‑‒–—―﹣－＋]\s*$/u.test(clean.slice(0, range.index));
      }
      return false; // Open/partial salary prose requires manual review in this first version.
    }
  }
}

export function groundExtraction(text: string, input: unknown): ExtractionSuccess {
  const output = providerOutputSchema.parse(input);
  const warnings: ExtractionWarning[] = [{ code: "review_required", message: "This is a proposed extraction. Review every fact, importance and source quote before confirming a role." }];
  const titleQuote = resolveQuote(text, output.title);
  const titleSupported = !!output.title.value?.trim() && !!titleQuote.evidence && titleQuote.evidence.quote.includes(output.title.value);
  const title = titleSupported ? output.title.value! : "Untitled role — review required";
  if (!titleSupported) warnings.push({ code: "title_unconfirmed", field: "title", message: "No uniquely grounded title was confirmed. A placeholder is shown for review." });
  const constraints: Constraint[] = output.claims.map((claim, index) => {
    const id = `extracted-${claim.kind.replaceAll("_", "-")}-${index + 1}`;
    const { evidence, code } = resolveQuote(text, claim);
    const warn = (warningCode: string, message: string) => warnings.push({ code: warningCode, constraintId: id, message });
    if (claim.value === null) warn("unknown_fact", "This requirement is unknown and needs review.");
    else if (code) warn(code, "The proposed value has no unique verified exact quote. It remains unknown.");
    let known = claim.value !== null && !!evidence;
    if (claim.kind === "salary" && claim.value && (claim.value.currency === null || claim.value.basis !== "annual_base" || !/\bannual\s+base\b/i.test(evidence?.quote ?? ""))) {
      warn("missing_salary_units", "Salary currency and annual base units must be explicit. Salary remains unknown."); known = false;
    }
    if (known && evidence && !supported(claim, evidence.quote)) { warn("unsupported_value", "The value is unsupported, negated, ambiguous, or outside the supported language rules. It remains unknown."); known = false; }
    const mandatory = claim.importance === "mandatory" && claim.importanceExplicit && !uncertain(evidence?.quote ?? "") && /\b(must|required|mandatory)\b/i.test(evidence?.quote ?? "") && !/\b(preferred|optional)\b/i.test(evidence?.quote ?? "");
    const preferred = claim.importance === "preferred" && claim.importanceExplicit && !uncertain(evidence?.quote ?? "") && /\b(preferred|optional|nice.to.have)\b/i.test(evidence?.quote ?? "");
    if (!mandatory && !preferred) warn("inferred_importance", "Importance was not explicitly verified. The draft marks this preferred; review before confirmation.");
    const value = known ? claim.kind === "skill" ? canonicalSkillId(claim.value as string) : claim.value : null;
    return { id, direction: "employer", kind: claim.kind, enabled: true, importance: mandatory ? "mandatory" : "preferred", weight: 1, requirement: { value, origin: "extracted", evidence: known && evidence ? [evidence] : [] } } as Constraint;
  });
  for (const field of output.unsupportedFields) warnings.push({ code: "unsupported_field", field, message: "The provider reported an unsupported field. It was not converted into a matching requirement." });
  if (constraints.length === 0) warnings.push({ code: "no_requirements", message: "No supported requirements were extracted. Define and review requirements before matching." });
  return { draftRole: roleSchema.parse({ id: "extracted-role", revision: 1, title, sources: [{ id: sourceId, kind: "job_description", text }], constraints }), warnings };
}
