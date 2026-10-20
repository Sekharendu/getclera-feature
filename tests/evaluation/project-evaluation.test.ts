import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform, release, arch, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import expectations from "@/data/demo-expectations.json";
import { loadDemoFixtures } from "@/lib/domain/fixtures";
import type { CheckStatus, MatchResult } from "@/lib/domain/types";
import { explainMatch } from "@/lib/matching/explanations";
import { evaluateMatches } from "@/lib/matching/match";
import { compareScenarios, createScenario, evaluateScenario, withOverride } from "@/lib/scenarios/scenarios";

/** Authored acceptance meanings for the reason codes exercised by these fixtures.
 * Deliberately independent of the production reasonDescriptions export. */
const meanings: Record<string, { status: CheckStatus; sentence: string }> = {
  skill_supplied: { status: "pass", sentence: "The required skill is supplied, including documented exact aliases." },
  skill_explicitly_declined: { status: "fail", sentence: "The required skill is explicitly declined." },
  skill_not_supplied: { status: "unknown", sentence: "The required skill has not been confirmed; omission is not rejection." },
  salary_overlap: { status: "pass", sentence: "The salary ranges overlap, including their boundaries." },
  salary_disjoint: { status: "fail", sentence: "The salary ranges do not overlap." },
  salary_unknown: { status: "unknown", sentence: "A salary range is missing." },
  salary_endpoint_unknown: { status: "unknown", sentence: "A salary endpoint is unknown rather than explicitly unbounded." },
  work_mode_overlap: { status: "pass", sentence: "There is a shared remote or office work mode." },
  work_mode_disjoint: { status: "fail", sentence: "The offered and accepted work modes do not overlap." },
  work_mode_unknown: { status: "unknown", sentence: "An offered or accepted work-mode list is missing." },
  work_mode_none_accepted: { status: "fail", sentence: "A work-mode list explicitly accepts no modes." },
  location_overlap: { status: "pass", sentence: "There is a shared canonical geographic ID." },
  location_disjoint: { status: "fail", sentence: "The geographic lists do not overlap." },
  location_unknown: { status: "unknown", sentence: "A permitted or accepted geographic list is missing." },
  availability_within_deadline: { status: "pass", sentence: "The earliest available start is on or before the latest acceptable start." },
  availability_after_deadline: { status: "fail", sentence: "The earliest available start is after the latest acceptable start." },
  availability_unknown: { status: "unknown", sentence: "A start-date boundary is missing." },
};
const summaries = {
  eligible: "All evaluated mandatory checks passed, or no mandatory checks were defined.",
  blocked: "One or more mandatory checks failed. All independent blockers and unresolved questions remain listed.",
  needs_clarification: "No mandatory check failed, but mandatory facts need clarification.",
};
function counts(matches: MatchResult[]) {
  return Object.fromEntries(["eligible", "blocked", "needs_clarification"].map((eligibility) => [eligibility, matches.filter((match) => match.eligibility === eligibility).length]));
}

describe("recorded fictional-data evaluation", () => {
  it("checks independent outcomes, bounded explanation support and full25-profile recomputation latency", () => {
    const { role, candidates } = loadDemoFixtures();
    const baseline = evaluateMatches(role, candidates);
    const remote = withOverride(role, createScenario(role), { kind: "work_mode", constraintId: "role-work-mode", value: ["office", "remote"] });
    const next = evaluateScenario(role, candidates, remote);
    const reset = evaluateScenario(role, candidates, createScenario(role));
    const mismatches = expectations.flatMap((expected) => {
      const actual = baseline.find((match) => match.candidateId === expected.candidateId)?.eligibility;
      return actual === expected.eligibility ? [] : [{ candidateId: expected.candidateId, expected: expected.eligibility, actual, reason: expected.reason }];
    });
    const issues: string[] = [];
    const check = (condition: boolean, description: string) => { if (!condition) issues.push(description); };
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    let checkTotal = 0; let evidenceTotal = 0; let questionTotal = 0; let fallbackTotal = 0;
    const observedReasons = new Set<string>();
    for (const [name, effectiveRole, matches] of [["baseline", role, baseline], ["remote", next.role, next.matches]] as const) {
      for (const match of matches) {
        const explanation = explainMatch(match);
        const sources = new Map([...effectiveRole.sources, ...candidates.find((candidate) => candidate.id === match.candidateId)!.sources].map((source) => [source.id, source.text]));
        const prefix = `${name}/${match.candidateId}`;
        check(explanation.summary === summaries[match.eligibility], `${prefix}: unsupported eligibility summary`);
        check(explanation.checks.length === match.checks.length, `${prefix}: lost checks`);
        const expectedQuestions = match.checks.filter((item) => item.status === "unknown" && item.clarificationQuestion).map((item) => ({ constraintId: item.constraintId, direction: item.direction, question: item.clarificationQuestion }));
        check(same(explanation.questions, expectedQuestions), `${prefix}: unsupported/missing questions`);
        questionTotal += explanation.questions.length;
        for (const [index, explained] of explanation.checks.entries()) {
          checkTotal++;
          const actual = match.checks[index];
          const { text, category, ...metadata } = explained;
          check(same(metadata, actual), `${prefix}/${actual.constraintId}: altered reason/direction/status/weight/evidence/question metadata`);
          const meaning = meanings[actual.reasonCode]; observedReasons.add(actual.reasonCode);
          if (!meaning) { fallbackTotal++; issues.push(`${prefix}/${actual.constraintId}: unaudited fallback reason ${actual.reasonCode}`); }
          else check(meaning.status === actual.status && text === meaning.sentence, `${prefix}/${actual.constraintId}: unsupported reason sentence or status`);
          const expectedCategory = actual.status === "unknown" ? "clarification" : actual.status === "pass" ? "satisfied" : actual.importance === "mandatory" ? "blocker" : "preference_miss";
          check(category === expectedCategory, `${prefix}/${actual.constraintId}: blocker/unknown category mismatch`);
          for (const evidence of explained.evidence) {
            evidenceTotal++;
            check(sources.get(evidence.sourceId)?.slice(evidence.start, evidence.end) === evidence.quote, `${prefix}/${actual.constraintId}: unsupported quote/span`);
          }
        }
        // Independent arithmetic validates all numeric score claims behind these labels.
        const preferences = match.checks.filter((item) => item.importance === "preferred");
        const weight = (items: typeof match.checks) => items.reduce((sum, item) => sum + item.weight, 0);
        const score = preferences.length ? 100 * weight(preferences.filter((item) => item.status === "pass")) / weight(preferences) : null;
        const coverage = match.checks.length ? 100 * weight(match.checks.filter((item) => item.status !== "unknown")) / weight(match.checks) : null;
        check(score === null ? match.preferenceScore === null : match.preferenceScore !== null && Math.abs(score - match.preferenceScore) < 1e-10, `${prefix}: unsupported preferred score`);
        check(coverage === null ? match.evidenceCoverage === null : match.evidenceCoverage !== null && Math.abs(coverage - match.evidenceCoverage) < 1e-10, `${prefix}: unsupported coverage`);
        check(explanation.preferenceLabel === (score === null ? "No preferences scored" : "Weighted preferred fit"), `${prefix}: incorrect score label`);
        check(explanation.coverageLabel === (coverage === null ? "No checks evaluated" : "Weighted known-outcome coverage"), `${prefix}: incorrect coverage label`);
        check(explanation.disclaimer === "Preferred fit is a rule-based comparison, not a hiring probability. Coverage measures known check outcomes, including manual facts and failures; it does not certify source completeness. Eligibility is not an employment recommendation or verification of qualifications.", `${prefix}: unsupported metric disclaimer`);
      }
    }
    check(same(reset.matches, baseline), "Reset did not reproduce baseline exactly");
    check(next.matches.find((match) => match.candidateId === "candidate-02")?.eligibility === "eligible", "Remote story: candidate02 did not become eligible");
    check(next.matches.find((match) => match.candidateId === "candidate-15")?.checks.some((item) => item.status === "fail" && item.importance === "mandatory" && item.reasonCode === "salary_disjoint") === true, "Remote story: independent candidate15 salary failure lost");
    const warmupIterations = 25; const measuredIterations = 100; let consumedResults = 0;
    for (let index = 0; index < warmupIterations; index++) consumedResults += evaluateScenario(role, candidates, remote).matches.length;
    const milliseconds: number[] = [];
    for (let index = 0; index < measuredIterations; index++) {
      const started = performance.now(); const result = evaluateScenario(role, candidates, remote); milliseconds.push(performance.now() - started);
      consumedResults += result.matches.length;
      check(same(result.matches, next.matches), `Benchmark iteration${index}: inconsistent recomputation`);
    }
    const sorted = [...milliseconds].sort((a, b) => a - b);
    const medianMs = (sorted[49] + sorted[50]) / 2; const p95Ms = sorted[Math.ceil(measuredIterations * .95) - 1]; const maxMs = sorted.at(-1)!;
    const report = {
      generatedAt: new Date().toISOString(),
      environment: { node: process.version, npm: process.env.npm_config_user_agent ?? "not recorded", os: `${platform()} ${release()}`, architecture: arch(), cpu: cpus()[0]?.model ?? "unknown", logicalCpuCount: cpus().length, totalMemoryGiB: totalmem() / 1024 ** 3 },
      fixtureAgreement: { matched: expectations.length - mismatches.length, total: expectations.length, mismatches, baseline: counts(baseline), remote: counts(next.matches), reset: counts(reset.matches), remoteTransitions: compareScenarios(baseline, next.matches) },
      explanationAudit: { explanations: baseline.length + next.matches.length, checks: checkTotal, evidenceSpans: evidenceTotal, questions: questionTotal, observedReasonCodes: [...observedReasons].sort(), unsupportedStatements: issues.length, issues, fallbackOccurrences: fallbackTotal, scope: "Actual baseline and remote fixture explanations only; metadata, reason/status sentences, categories, questions, source spans, metric arithmetic/labels and disclaimer. Not general semantic entailment or provider quality." },
      benchmark: { datasetSize: candidates.length, warmupIterations, measuredIterations, medianMs, p95Ms, maxMs, milliseconds, consumedResults, targetMs: 100, targetMet: medianMs < 100 && p95Ms < 100, rule: "median and nearest-rank p95 both <100ms; max and every sample retained", measured: "evaluateScenario: validated role cloning/override application plus all25 matches/ranking; fixture load, equality validation, artifact IO and logging outside timed region" },
    };
    if (process.env.CLERA_WRITE_EVALUATION === "1") { mkdirSync("artifacts/evaluation", { recursive: true }); writeFileSync("artifacts/evaluation/engine.json", JSON.stringify(report, null, 2) + "\n"); }
    expect(mismatches).toEqual([]); expect(issues).toEqual([]); expect(consumedResults).toBe((warmupIterations + measuredIterations) * 25); expect(report.benchmark.targetMet).toBe(true);
  });
});
