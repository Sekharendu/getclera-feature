# Immutable scenarios and evaluated suggestions

`src/lib/scenarios/scenarios.ts` provides T07's pure scenario API:

- `createScenario(role, id?)` and `resetScenario(role, id?)`: empty patches tied to
  the supplied role ID and revision. Reset against a newly confirmed role creates
  a fresh revision identity; it does not silently accept a stale saved scenario.
- `applyScenario(role, unknownScenario)`: validate and return a detached effective
  role. Throws for invalid shapes, stale/mismatched identities, unknown employer
  constraint IDs, wrong kinds, or invalid effective roles. Enabling a disabled
  zero-weight requirement is explicitly rejected. No partial baseline writes occur.
- `withOverride(role, scenario, patch)`: merge a patch by ID with existing fields,
  validate the complete result and return a fresh scenario. Candidate preferences
  cannot be patched. Override order is lexical after merging.
- `editedConstraintIds(baseline, effective)`: semantic value/importance/enabled
  differences, sorted by ID. Work-mode/location lists are sets of alternatives;
  list reordering and salary object property ordering do not count as edits.
- `evaluateScenario(baseline, candidates, scenario)`: `{ role, matches, editedIds }`.
  Matches use T05's ordering and preserve candidate-direction checks.
- `compareScenarios(before, after)`: existing schema-compatible transition lists
  and changed check IDs, sorted deterministically. Transition means entering an
  eligibility category. Added, removed, and changed checks count, including all
  metadata/evidence/questions; check/result array order does not count. Duplicate
  result/check IDs or different candidate sets throw instead of silently dropping
  records.
- `compareScenarioDetails(before, after)`: `{ comparison, deltas }`, where deltas
  contain candidate ID and eligibility/score/coverage before and after whenever
  these metrics change. Check-only differences still appear in `comparison`.

Value edits create manual facts with empty evidence. Unchanged/no-op values and
importance/enabled-only changes preserve original provenance. Entire output roles
are cloned and runtime-parsed, including nested source documents and facts. Role
revision stays unchanged until a separate confirmation flow. Recomputing an empty
scenario reproduces original values, provenance, scores and checks.

`src/lib/scenarios/suggestions.ts` exports `evaluateSuggestions(role, candidates,
scenario, proposals?, limit=10)`. It evaluates at most 50 explicitly proposed
single patches; limit must be an integer from 0 through 50. Without proposals it
offers bounded mandatory-to-preferred alternatives for enabled employer
requirements. They are optional trade-offs, never recommendations to weaken
requirements. Each option merges into the current scenario and recomputes all
matches independently. Different options are not cumulatively applied. Invalid
proposals inside the evaluated prefix throw; proposals beyond the limit are not
examined. Zero-gain options are retained honestly.

Each suggestion includes the exact patch and scenario, readable trade-off,
computed eligibility counts, current-to-proposed comparison/deltas, and remaining
blocker/unknown check IDs for every candidate. Only the loaded sample is evaluated.
Candidate mandatory preferences remain active even when an employer requirement
becomes preferred; relaxing an employer salary check alone cannot resolve an
independent candidate salary failure. Callers must not interpret counts as hiring
recommendations or assume gains from combining individual suggestions.

No clock, network, model, browser or mutable global state is used. Input roles and
candidates must be domain-validated; unknown scenario payloads are validated here.
