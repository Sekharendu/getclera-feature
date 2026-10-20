# Match aggregation and explanations

`src/lib/matching/match.ts` accepts domain-validated role/candidate records.
`evaluateMatch` retains every enabled T04 check in both directions;
`evaluateMatches` returns their ranked results. `aggregateEligibility`,
`preferenceScore`, `evidenceCoverage`, and `rankMatches` are also public pure helpers.

Any mandatory failure blocks; otherwise any mandatory unknown needs clarification;
otherwise the result is eligible. Preferred misses never block. No checks is
vacuously eligible but does not establish fit; explanations prompt for requirements.

Preferred fit is 100 times passed preferred weight divided by all preferred weight.
Known-outcome coverage is 100 times pass-or-fail weight divided by all check weight.
Unknowns remain in denominators. Known manual outcomes count even without source
evidence. Coverage therefore measures known outcomes, not verified sourcing.
Empty denominators yield null, distinct from zero. Weight sums are scaled by their
maximum to avoid overflow with finite positive weights. Extremely small ratios may
underflow to zero at JavaScript floating-point precision; no artificial rounding
is performed for display. Disabled zero-weight requirements never produce checks.

Order is eligibility (eligible, needs clarification, blocked), descending preferred
fit, descending coverage, then candidate ID using explicit lexical comparison.
Null sorts after every numeric value. Ranking copies the input array. No matching
input is mutated; results contain fresh evidence objects from the T04 evaluator.

`explainMatch` returns deterministic summary, per-check text/category with original
identifiers, direction, reason codes, weight, evidence and questions; a separate
question list preserves unknown questions even when another check blocks. It also
returns metric labels and a disclaimer. Templates describe check outcomes only;
they do not infer names, values or quotes. Unknown future reason codes fall back to
neutral status text. All independent blockers remain visible. Preferred fit is a
rule-based comparison, never a hiring probability; eligibility is neither an
employment recommendation nor certification of qualifications.

UI rounding, scenarios, persistence and extraction are subsequent backlog tasks.
