import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const directory = "artifacts/evaluation";
mkdirSync(directory, { recursive: true });
for (const file of ["engine.json", "tests.json", "report.json"]) rmSync(`${directory}/${file}`, { force: true });
const files = ["tests/evaluation/project-evaluation.test.ts", "tests/unit/extraction-grounding.test.ts", "tests/unit/extraction-provider.test.ts", "tests/unit/extraction-handler.test.ts"];
const execution = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...files, "--maxWorkers=1", "--reporter=json", `--outputFile=${directory}/tests.json`], { stdio: "inherit", env: { ...process.env, CLERA_WRITE_EVALUATION: "1" } });
try {
  const tests = JSON.parse(readFileSync(`${directory}/tests.json`, "utf8"));
  const engine = JSON.parse(readFileSync(`${directory}/engine.json`, "utf8"));
  const extractionSuites = tests.testResults.filter((suite) => suite.name.replaceAll("\\", "/").includes("/tests/unit/extraction-"));
  const suites = extractionSuites.map((suite) => ({ file: suite.name.replaceAll("\\", "/").split("/tests/")[1], total: suite.assertionResults.filter((test) => ["passed", "failed"].includes(test.status)).length, passed: suite.assertionResults.filter((test) => test.status === "passed").length, failed: suite.assertionResults.filter((test) => test.status === "failed").length, notExecuted: suite.assertionResults.filter((test) => !["passed", "failed"].includes(test.status)).length, cases: suite.assertionResults.map((test) => ({ name: test.fullName, status: test.status, failureMessages: test.failureMessages })) }));
  const extraction = { provider: "Google Gemini native generateContent (mock transport only)", denominator: "Executed Vitest pure/mock test cases (some contain multiple inputs/assertions), not live provider requests, extracted claims, or accuracy samples", total: suites.reduce((sum, suite) => sum + suite.total, 0), passed: suites.reduce((sum, suite) => sum + suite.passed, 0), handlingFailures: suites.reduce((sum, suite) => sum + suite.failed, 0), liveProviderRequests: 0, note: "Valid drafts and intentional rejection/error scenarios are both tested. Zero handling failures does not mean zero extraction errors; no live Gemini accuracy measured.", suites };
  const report = { ...engine, extraction, evaluationExitCode: execution.status ?? 1 };
  if (suites.length !== 3 || suites.some((suite) => suite.notExecuted > 0)) throw new Error("All three extraction suites must execute with no skipped/pending cases");
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(`Fixture agreement ${report.fixtureAgreement.matched}/${report.fixtureAgreement.total}; bounded explanation issues ${report.explanationAudit.unsupportedStatements}/${report.explanationAudit.checks} checks.`);
  console.log(`Extraction pure/mock handling ${extraction.passed}/${extraction.total} cases; failures ${extraction.handlingFailures}; live requests0.`);
  console.log(`25-profile recomputation median ${report.benchmark.medianMs.toFixed(3)}ms, p95 ${report.benchmark.p95Ms.toFixed(3)}ms, max ${report.benchmark.maxMs.toFixed(3)}ms; target ${report.benchmark.targetMet ? "PASS" : "FAIL"}.`);
  console.log(`Observed JSON: ${directory}/report.json. Tracked report is updated deliberately, not by tests.`);
} catch (error) { console.error("Evaluation artifacts could not be assembled:", error.message); process.exitCode = 1; }
if (execution.status !== 0) process.exitCode = execution.status ?? 1;
