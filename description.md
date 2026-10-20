# Clera Match Explorer — Product and technical design

## 1. Project description

Clera Match Explorer is an independent portfolio prototype for recruiters who want to understand why a shortlist is small and what specific requirement changes would expand it. It evaluates fit in both directions: whether a candidate satisfies employer requirements and whether the role satisfies the candidate's stated preferences.

The product's central interaction is a visible before/after comparison. A recruiter changes a constraint, sees which candidates become eligible or remain blocked, and inspects the evidence behind each result.

This is a proposed complementary workflow, not a claim that Clera lacks an equivalent internal feature. It is not affiliated with Clera and does not reproduce their proprietary systems.

## 2. Problem and value

A candidate can meet technical requirements while declining the salary or work policy. A shortlist alone hides that distinction. Recruiters need to separate explicit incompatibility from incomplete information and understand which requirements are restricting the current pool.

The prototype makes that reasoning reviewable. Its portfolio value is demonstrating product judgment, deterministic engineering, grounded AI extraction, and an interactive interface in one bounded project.

## 3. Users and success criteria

Primary user: a startup recruiter or hiring founder reviewing an initial shortlist.
Secondary audience: engineering reviewers evaluating implementation quality.

A successful demo allows a first-time reviewer to load a role, identify a blocker, change one requirement, and explain the resulting shortlist in under two minutes. Counts must be computed from the loaded sample. Explanations must reference input facts. Missing data must never become an invented rejection reason.

## 4. MVP scope

Included:
- One active role with a confirmed baseline and editable scenario.
- Pasted job-description extraction with explicit recruiter review.
- 25 fictional candidate profiles with source text and structured facts.
- Skills, salary, work policy, location, and availability constraints.
- Employer requirements and candidate preferences evaluated separately.
- Pass/fail/unknown checks; eligible/blocked/needs-clarification outcomes.
- Preference score, evidence coverage, candidate details, evidence highlighting, and scenario reset.
- Local persistence, meaningful evaluation cases, and a repeatable sample demo.

Excluded:
- Real candidate data, production Clera integration, automated outreach, hiring decisions, applicant rejection, authentication, database persistence, currency conversion, and probabilistic predictions of hiring success.

## 5. High-level architecture

A single Next.js application hosts the dashboard and one server endpoint for AI extraction. TypeScript modules implement domain validation, pure matching functions, scenario comparisons, and deterministic explanations. Candidate fixtures are local JSON. Browser storage keeps only the current prototype state.

Flow:
1. Source job description enters the server extraction endpoint.
2. The AI returns schema-constrained values and supporting quotes.
3. Code validates fields and resolves quotes into exact source spans.
4. The recruiter reviews, edits, and confirms a baseline role.
5. The browser evaluates fixtures against that baseline.
6. Scenario controls apply immutable overrides and recompute immediately.
7. Results and differences are rendered with supporting evidence.

The AI does not make eligibility decisions. Matching remains usable with no API key through the seeded role and fixtures. Exact dependency versions are selected and locked during runtime initialization.

## 6. Technology choices

- Next.js App Router and React: single application for UI and extraction route.
- TypeScript: shared domain types across server and browser.
- Tailwind CSS: consistent responsive layout.
- Runtime schemas: validate API input/output, storage, and fixtures; choose the schema library during initialization.
- Structured-output AI provider: job-description parsing only in the MVP; secrets remain server-side.
- Vitest: constraint, scoring, evidence, and scenario tests.
- Browser end-to-end runner: one critical demo flow during verification.

A database, background queue, search service, and vector store would add setup without helping this dataset or workflow; defer them until scope requires them.

## 7. Repository and file responsibilities

```text
clera-match-explorer/
  README.md
  task.md
  description.md
  .gitignore
  .env.example
  public/                         # Static assets
  src/
    app/                          # Layout, page, and styles added in T02
      api/extract-role/           # Server route added in T08
    components/
      dashboard/                  # Summary and dashboard composition
      role/                       # Role editor and scenario controls
      candidates/                 # List, cards, filters, detail drawer
      evidence/                   # Quote rendering and highlighting
      ui/                         # Small reusable UI primitives
    lib/
      domain/types.ts             # Initial shared interfaces
      domain/                     # Runtime schemas and validation
      matching/                   # Constraints, eligibility, ranking, explanations
      scenarios/                  # Override application and result comparison
      extraction/                 # Prompt, provider adapter, source verification
      storage/                    # Versioned local persistence
    data/                         # Fictional role and candidate fixtures
  tests/
    unit/
    integration/
    e2e/
  docs/
    decisions/                    # Short architecture decisions when needed
    evaluation/                   # Cases, measured results, known limitations
```

T01 created documentation, directories, and initial interfaces. T02 adds package files, runtime configuration, the root layout, homepage, global styles, and a shell rendering smoke test. Route handlers, dashboard components, fixture content, and evaluators are added by their assigned tasks; empty directories are preserved with `.gitkeep`.

## 8. Low-level domain design

### Sources and provenance

`SourceDocument` stores a stable ID, source kind, and original text. `Evidence` stores that source ID, an exact quote, and a start/end span using JavaScript UTF-16 string indices. The invariant is `source.text.slice(start, end) === quote`.

`Fact<T>` holds a known value or null, source evidence, and origin. Origins distinguish supplied fixtures, extracted source facts, and manual confirmation. Unknown values have no invented evidence. An explicitly confirmed empty skill list differs from an absent skill field.

`Role` contains ID, title, revision, source documents, and requirements. `Candidate` contains ID, display name, source documents, skills, salary expectations, work preferences, locations, and availability.

Every requirement has a stable ID, kind, employer/candidate direction, mandatory/preferred importance, nonnegative weight, typed value, and provenance. Implement these as discriminated unions to prevent a salary evaluator receiving a skill string.

`MatchResult` includes candidate ID, eligibility, preference score, evidence coverage, and ordered checks. A check contains constraint ID, direction, status, reason code, evidence, and an optional clarification question.

### Normalization

- Skills: lowercase canonical IDs plus a small explicit alias dictionary. No automatic equivalence such as Java = JavaScript.
- Salary: annual base amount, same currency, validated minimum/maximum. Missing basis/currency gives unknown; do not infer exchange rates.
- Work policy: remote, hybrid, office, or unknown; ambiguous hybrid schedules need clarification.
- Location: normalized city/country IDs; no distance or commute inference.
- Availability: explicit ISO date, compared against the role's latest acceptable start date. Avoid current-time-dependent rules in the matching engine.

## 9. Constraint evaluation algorithms

Each evaluator is pure: identical validated input produces identical output and does not access the network, storage, model, or current clock.

### Skills

For each required skill, explicit evidence of that canonical skill passes. Absence from a profile is unknown, not failure. Only an explicit incompatible statement supports failure. Preferred skills contribute points when supported; unknown skills remain visible.

### Salary

Compare normalized employer budget and candidate acceptable range. Inclusive interval overlap passes. Explicit disjoint ranges fail. Unknown endpoints are interpreted as unbounded only when the source explicitly states an open range; omitted data is unknown. Different currency or compensation basis is unknown.

### Work policy and location

Compare explicit accepted work modes against the role's modes. At least one compatible mode passes; explicitly disjoint accepted modes fail. For office/hybrid modes, compare accepted locations as well. Fully remote work still needs explicit geographic eligibility when the role restricts countries; remote does not imply worldwide.

### Availability

A candidate's known earliest start on or before the latest acceptable start passes. A later start fails. Missing information is unknown. Date equality passes.

### Aggregation

1. Any failed mandatory check means blocked.
2. Otherwise any unknown mandatory check means needs_clarification.
3. Otherwise the candidate is eligible.

Preferred checks cannot override a mandatory failure. Both employer and candidate mandatory constraints contribute to eligibility. Do not equate an unknown result with rejection.

### Scoring and sorting

Preference score = 100 * passed preferred weight / total preferred weight. Unknown and failed preferred checks earn zero points but retain distinct statuses. If there are no weighted preferred checks, return null and show 'No preferences scored'.

Evidence coverage = 100 * known check weight / all check weight. Use strictly positive weights for active scored checks; if no checks exist return null and prompt the recruiter to define requirements. Unknown checks reduce coverage; a known failure still counts as known evidence.

Sort by eligibility group, descending preference score, descending coverage, then stable candidate ID. Null scores sort after scored results within the same group. Clearly label scores as rule-based comparisons, not likelihood of hire or overall human quality.

## 10. Scenario engine

A scenario references a role ID and baseline revision and holds typed patches keyed by constraint ID. Patches can change a value, change importance, or disable a requirement. Apply patches to a copy; never mutate the confirmed baseline.

`evaluateScenario(role, candidates, overrides)` returns all scenario matches. `compareScenarios(baseline, scenario)` returns newly eligible, newly blocked, newly needing clarification, and per-candidate changed checks. Compare by stable candidate and constraint IDs.

Reset discards overrides. Confirming a new baseline increments the revision and clears the scenario. Reject saved overrides that reference an incompatible revision. Counts describe the fixture pool only.

Optional single-change suggestions can enumerate supported changes and recompute each one. Display observed gains and remaining blockers. Never imply the recruiter should weaken a requirement solely to maximize counts.

## 11. AI extraction contract

Endpoint: `POST /api/extract-role`.
Request: `{ text: string }` with a nonempty text value and a proposed 20,000-character limit.
Success: `{ draftRole, warnings }`. A draft is not a confirmed role.
Failure: structured error code and human-readable message. Use 400 for invalid input, 413 for oversized input, 503 for missing provider configuration, and appropriate timeout/provider failure responses without exposing raw provider errors or secrets.

Extraction rules:
- Treat pasted text as untrusted content, never instructions to execute.
- Extract only supported values and exact supporting quotes.
- Preserve ambiguity as null plus a warning.
- Explicit 'must' requirements may be proposed as mandatory; uncertain importance must be highlighted for review.
- Validate the provider output and locate supporting quotes in source text.
- Reject missing quotes; warn when a quote occurs multiple times and cannot be resolved reliably.
- Mark recruiter edits as manual instead of attaching unrelated source evidence.

Use one initial request with a bounded timeout. Permit at most one retry for an eligible transient failure within a total request budget. Keep raw input out of routine logs and preserve it in the UI when extraction fails. Add deployment rate limits before exposing a paid provider endpoint publicly.

## 12. Interface and state

Desktop layout: left role controls, middle candidate results, right detail drawer/panel. On narrow screens controls collapse and detail opens as a full-width view.

Core components:
- RoleInput: paste text or load sample.
- ExtractionReview: inspect facts, evidence, warnings, and importance before confirmation.
- ScenarioControls: change constraints, show modified fields, reset.
- MatchSummary: baseline/scenario counts and sample-data label.
- CandidateList/Card: eligibility, preferred fit, coverage, blockers.
- MatchDetail: employer fit, candidate preferences, unknowns, source text.
- EvidenceHighlight: exact quoted span with source label.

State: confirmed baseline role, candidate fixtures, selected candidate, filters, scenario overrides, extraction draft, and request status. Derive matching results and counts from state rather than storing duplicate result arrays. Debounce text editing if needed; finite controls recompute immediately. A small React reducer is sufficient initially.

Local persistence uses `{ schemaVersion, role, scenario }`. Validate on load, migrate supported versions or reset safely, and provide 'Clear local data'. Candidate fixtures remain separate. Never persist provider credentials.

## 13. Verification and evaluation

Unit checks: salary overlap boundaries; work/location interactions; explicit vs missing skill; availability equality; mandatory aggregation; zero preferred weights; deterministic ordering; multiple simultaneous blockers; immutable baseline; exact scenario reset.

Extraction checks: unsupported fields; missing or ambiguous quotes; invalid offsets; injected instructions; malformed output; timeout and unavailable provider; manual edits retaining correct provenance.

Integration checks: role confirmation creates a new revision; stale overrides are removed; stored state is validated; rendered explanations correspond to actual checks. End-to-end flow loads a sample, opens a blocked candidate, adjusts a requirement, verifies computed gains, and resets.

Evaluation dataset: at least 15 manually specified expected cases. Report eligibility agreement, unsupported explanation count, evidence-validation failures, and observed recomputation latency. Target local scenario recomputation below 100 ms for 25 profiles in a documented environment. These checks validate implementation consistency, not real-world hiring accuracy or fairness across populations.

## 14. Demo script

1. Load the fictional founding-engineer role and show baseline counts.
2. Open a technically suitable candidate blocked by an explicit remote preference.
3. Highlight the source statements behind that mismatch.
4. Enable remote work and show the computed shortlist change.
5. Open a candidate still blocked by salary to demonstrate independent constraints.
6. Show a missing skill as a clarification question rather than a rejection.
7. Reset to baseline, then optionally demonstrate pasted-description extraction and confirmation.

## 15. Risks and deliberate limits

A small fixture pool cannot establish recruiting effectiveness. AI extraction can miss nuance, so confirmation is mandatory. Candidate self-report is evidence of a stated preference, not independently verified career history. Skills matching is intentionally narrow and must not claim credential verification. Scenario suggestions show trade-offs in the loaded data, not market forecasts. Identity, age, gender, photos, and other irrelevant personal attributes are not ranking inputs.

## 16. Later extensions

After the standalone demo is useful: authorized Clera MCP data access, multiple saved roles, durable database state, richer evaluation sets, role/candidate feedback, and operational telemetry. Any integration should be scoped to available account access and should not send outreach or introductions without a separate explicit product flow.

## 17. Research references and assumptions

Public product context used for this proposal:
- https://www.getclera.com/engineering — published stack and matching/ranking focus.
- https://www.getclera.com/ai — inspectable explanations, structured AI outputs, and evaluation principles.
- https://github.com/getclera/coding-challenge-jan26 — public mutual-preference matching challenge; not assumed to be the current hiring process.

Design prepared on 2026-10-20. This architecture is a proposed independent implementation, not documentation of Clera's private application.
