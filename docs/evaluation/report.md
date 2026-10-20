# Observed evaluation — fictional desktop demo

Recorded2026-10-20T19:56:30.800Z (21October in Asia/Kolkata) using `npm run evaluate`
at the T11 baseline `e27b4b6c51de143db13f6a02faafed3483487406` plus T12's Gemini
replacement. The previous T10 observation remains recorded in docs/progress/T10.md.
This measures consistency on invented data, not hiring performance or live model
accuracy. Artifacts are local and gitignored: `artifacts/evaluation/report.json`
contains observations/environment/raw timings/case names; `tests.json` is the
Vitest report and `engine.json` the bounded engine audit. Re-running replaces these
artifacts, not this deliberately recorded document.

## Eligibility and explanations

All25 outcomes agree with separate hand-authored `demo-expectations.json`:
**25/25 agreement,0 mismatches**. Expectations are never matching inputs.

| Evaluation | Eligible | Blocked | Needs clarification |
| --- | ---: | ---: | ---: |
| Confirmed baseline | 8 | 9 | 8 |
| Add remote alongside office | 9 | 8 | 8 |
| Reset to baseline | 8 | 9 | 8 |

The observed newly eligible candidate is candidate02. Candidate15 still has
independent mandatory salary failures after work-mode relaxation. The independent
fixture cases also distinguish failure-before-unknown (16/25), candidate-direction
conflicts and nonblocking preferred misses (22–24). Existing matching/scenario
tests cover these separately; the report reuses those tests rather than generating
expected answers from the engine.

The audit inspected **50 generated explanations,502 check explanations,1079
evidence-reference occurrences and40 check clarification questions**, across
baseline and remote results.17 actual reason codes occurred;0 unaudited fallback
occurrences and **0 unsupported audit findings** were observed. Evidence counts
include repeated references, not1079 unique quotes. Every actual check's
status/direction/importance/reason/weight/evidence/question was compared with
evaluation output; sentences/statuses were checked against a separately authored
acceptance meaning table. Exact source slices, category/summary, retained questions,
independent metric arithmetic and metric labels/disclaimer were also checked.

This is a bounded deterministic audit on these inputs. It does not prove every
future explanation, arbitrary natural-language truth, or evaluator correctness
outside tested cases. Scores are rule-based fit comparisons, never hiring
probabilities; coverage measures known outcomes, including failures/manual facts.

## Extraction contract errors, with explicit denominators

The same evaluation command executes existing mock/pure extraction suites and
records every named result.**99/99 test cases passed;0 incorrect-handling test
failures;0 live Gemini requests.** Some cases contain multiple inputs/assertions,
so this denominator is test cases, not claims, HTTP requests or live accuracy.

| Existing suite | Executed cases | Passed | Handling failures |
| --- | ---: | ---: | ---: |
| Grounding | 40 | 40 | 0 |
| Native Gemini adapter with fake fetch | 45 | 45 | 0 |
| HTTP handler with injected extraction | 14 | 14 | 0 |

Grounding cases include valid typed drafts and exact UTF-16 spans, plus deliberately
unsupported/repeated/missing/negated/excluded/signed/decimal/unit inputs that must
become unknown or raise a safe validation error. Gemini cases include native STOP
output/thought handling/multipart policy, blocked prompts/safety/refusals,
truncated/malformed/multiple candidates/tools, full emitted-schema subset and
runtime bounds, strict model URL/header validation, auth errors, retry caps, cancellation,
body/transport timeouts and bounded invalid bodies. Handler cases cover safe
400/413/415/499/502/503/504 behavior and preserved original text. Intentional
rejections/provider errors are expected outcomes: zero handling failures does
**not** mean zero extraction errors or perfect extraction quality.

No credentials were used and live Gemini quality/access/latency is **NOT RUN**.
Desktop browser checks additionally exercise actual no-key503, mocked UI failure
preservation and explicit review/confirmation. They are not counted in99 above.

## Local recomputation timing

Environment: Node24.21.0, npm11.19.0, Windows10.0.26200 x64; Intel Core
i5-1135G7 at2.40GHz,8 logical CPUs,15.77GiB memory. The evaluation CLI uses
one Vitest worker. Ordinary background machine load is not controlled.

After25 untimed warm-ups,100 measured full `evaluateScenario` calls on25 profiles
produced:

| Median | Nearest-rank p95 | Maximum | Target rule |
| ---: | ---: | ---: | --- |
| 1.706ms | 3.478ms | 4.762ms | Median and p95 both below100ms: PASS |

`performance.now()` times role cloning/validation/override application, all checks,
aggregation and ranking. Fixture loading, output-equality checks, artifact IO and
logging are outside each timed region. Outputs were consumed and compared with
the expected scenario; every raw sample is retained. This is Node library timing,
not browser event latency, network performance or a guarantee on other hardware.

## Integration coverage and limits

Existing tests cover exact sources, stale scenario role/revision, immutable reset,
review session invalidation, atomic confirmation and persistence recovery.
Version1 is the only supported storage envelope: malformed/unsupported versions
fall back safely; a stale scenario retains a valid saved role and resets overrides.
No historical migration is invented. Desktop Playwright reuses the complete sample
→ exact blocker → remote change/count → independent blocker → reload/reset flow,
keyboard dialog behavior, confirmed-baseline persistence and no-key extraction
paths. Independent task review records the full current lint/typecheck/test/build
and browser command results in `docs/progress/T10.md`.

Current delivery scope is desktop web only per user instruction. Existing responsive
code/mobile tests remain, with no new mobile evaluation gate. Architecture limits:
fictional candidates; annual-base same-currency comparison; exact skill aliases;
canonical geography without inferred containment/commutes; unresolved hybrid
schedules/start facts remain unknown; conservative supported extraction language
still requires human review. No public paid-endpoint authentication/rate limiting,
production hosting, production candidate data, outreach or actual Clera integration
is provided.
