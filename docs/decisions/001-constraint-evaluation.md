# Individual constraint evaluation (T04)

## Public entry points

`src/lib/matching/evaluators.ts` exports pure skill, salary, work-mode, location, and availability comparisons. Each returns `status`, a stable `reasonCode`, and a clarification question for unknown results. Partial salary inputs let the salary comparison represent missing currency or compensation basis explicitly.

`src/lib/matching/evaluate.ts` exports `evaluateConstraint(constraint, role, candidate)` and `evaluateConstraints(role, candidate)`. Inputs must have passed domain validation; these functions do not reparse records on every check. Disabled constraints are omitted. Checks retain constraint ID, direction, importance, weight, and source evidence references. Source ID plus UTF-16 start/end offsets identify each evidence span; duplicate references are removed and returned evidence objects are copied.

`evaluateConstraints` returns employer checks followed by candidate checks, preserving input order. It does not aggregate eligibility, calculate scores, sort candidates, generate prose explanations, or apply scenarios. Those belong to subsequent tasks.

## Comparison rules

- Skills use lowercase exact IDs and a small alias map: `ts` → `typescript`, `js` → `javascript`, `node`/`node.js` → `nodejs`, and `reactjs`/`react.js` → `react`. There is no substring or related-skill inference. Missing skills, including an explicitly empty list, are unknown; explicit declinations fail. Conflicting statements after alias normalization require clarification.
- Salary overlap is inclusive. Missing facts, missing units, incompatible currencies/bases, malformed ranges, and unspecified endpoints are unknown. A null endpoint becomes unbounded only with its explicit flag. There is no currency conversion or salary-basis conversion.
- Work modes compare offered and accepted alternatives. Explicit empty sets and disjoint sets fail. Unsupported policies and hybrid-only overlap require clarification. Hybrid attendance schedules are not represented in the current model; a shared remote or office alternative can establish mode compatibility independently.
- Locations compare exact canonical IDs. An explicit empty set or disjoint alternatives at the same scope fail. Country IDs use two lowercase letters; city IDs use country-prefixed names such as `us-san-francisco`. Mixed city/country scopes without an exact match are unknown. Country membership and commute distances are not inferred.
- Availability compares validated ISO dates: earliest available start on or before the employer deadline passes. Missing dates are unknown. The current clock is never consulted.

Work mode and location are independent checks. A passing office check cannot erase a failed location check. Remote compatibility cannot bypass geographic restrictions. Every enabled location constraint continues to apply, including in remote scenarios; the model does not currently distinguish office-only locations from separate remote geographic restrictions.

## Candidate direction

Candidate salary, mode, and location preferences compare against the corresponding enabled role constraint. Missing offerings are unknown. Multiple role offerings of the same kind are ambiguous rather than arbitrarily selecting the first or merging them.

A candidate skill preference can confirm a skill explicitly listed in the role's enabled skill requirements. Absence is unknown; this does not establish actual technology usage beyond the supplied requirement.

A candidate `latest_start` preference needs an offered role start date. The role model contains only its latest acceptable candidate start, which does not establish an offered start. These checks return `role_start_date_unknown`. No demo candidate uses this preference. A future domain extension should model the offered date or start window explicitly before inferring compatibility.

## Verification

Tests cover comparison boundaries and unknowns, all 25 fictional profiles' selected individual checks, candidate-direction conflicts, geographic checks with remote/office mode compatibility, evidence resolution and deduplication, disabled constraints, deterministic output, and unchanged inputs. Fixture eligibility expectations remain reserved for T05, when aggregation is implemented.
