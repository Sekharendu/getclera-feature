# Development tasks

## Objective

Ship an inspectable, interactive prototype that demonstrates mutual matching and shows exactly how recruiter-controlled requirement changes alter a shortlist.

Status legend: `[x]` complete; `[ ]` pending. Complete tasks only when their acceptance criteria are met. Development order follows dependencies. Initial estimates assume one developer familiar with TypeScript; they are estimates, not deadlines.

## Phase 1: Foundation

### T01 — Create repository structure and design documents
- [x] Create `clera-match-explorer` in the requested parent folder.
- [x] Add README, this backlog, full project description, environment template, and ignore rules.
- [x] Define folders for the app, domain, matching, extraction, fixtures, and tests.
- [x] Add initial TypeScript domain interfaces.
- Acceptance: documented architecture and file ownership; scaffold files readable; no secrets or existing files overwritten.
- Estimate: 30–60 minutes. Dependencies: none.

### T02 — Initialize and verify the application runtime
- [x] Initialize Next.js with TypeScript, App Router, Tailwind, and npm lockfile in the existing scaffold.
- [x] Configure lint, typecheck, unit tests, and production build scripts.
- [x] Add a minimal root layout, homepage, global styles, and metadata.
- [x] Confirm development server and production build work.
- Acceptance: documented install/start commands work from a clean checkout; lint, typecheck, test runner, and build execute successfully.
- Verification: `npm ci`, lint, typecheck, Vitest (one shell rendering smoke test), and production build passed on Node 24.21.0/npm 11.19.0. Development and production servers returned HTTP 200 with the expected homepage and metadata; production CSS included Tailwind utilities and global styles. See README for the development dependency audit limitation.
- Estimate: 1 hour. Dependencies: T01.

### T03 — Finalize domain validation and fixtures
- [x] Turn initial interfaces into validated schemas with stable constraint IDs.
- [x] Create one demo role and 25 fictional profiles covering eligible, blocked, and unknown cases.
- [x] Include verified source spans, candidate preferences, salaries in one currency, and explicit skills.
- [x] Add a fixture loader that rejects malformed records or broken evidence references.
- Acceptance: every fixture validates; edge-case scenarios have documented expected outcomes; sample data is clearly fictional.
- Verification: lint, typecheck, 48 tests across three files, and production build passed. The fixture loader validates all records and exact UTF-16 evidence spans. `docs/evaluation/fixture-cases.md` and `src/data/demo-expectations.json` record 25 hand-authored outcomes for T04–T05; matching is not implemented or evaluated yet.
- Estimate: 1–2 hours. Dependencies: T02.

## Phase 2: Matching engine

### T04 — Implement individual constraint evaluators
- [x] Add salary interval overlap, work policy, location, skills, and availability checks.
- [x] Evaluate both employer requirements and candidate preferences.
- [x] Return pass/fail/unknown with structured reasons and evidence IDs.
- [x] Distinguish absent information from explicit incompatibility; implement exact skill aliases only.
- Acceptance: boundary tests cover equality, explicit rejection, missing facts, missing units, and unsupported work policies.
- Verification: lint, typecheck, all 152 tests across five files, and production build passed. Evidence references retain source IDs and UTF-16 spans. Tests cover selected checks for all 25 profiles, both directions, salary/date equality, independent blockers, unknown facts/units, aliases, hybrid ambiguity, and remote geography. Current model limits are documented in `docs/decisions/001-constraint-evaluation.md`; eligibility aggregation remains T05.
- Estimate: 2 hours. Dependencies: T03.

### T05 — Implement eligibility, ranking, and explanations
- [x] Aggregate mandatory failures before unknowns before eligibility.
- [x] Calculate weighted preferred fit and evidence coverage separately.
- [x] Sort by eligibility, then preference score, coverage, and stable candidate ID.
- [x] Add deterministic explanation templates and clarification questions.
- Acceptance: repeated inputs produce identical outputs; scores are never presented as hiring probabilities; missing facts remain visible.
- Verification: independent review, lint, typecheck, all 172 tests across eight files, and production build passed. All 25 hand-authored eligibility expectations agree; checks cover ranking precedence, unknown visibility, exact evidence spans, immutable inputs, null metrics, extreme finite weights, explanation templates, and workflow configuration. See `docs/progress/T05.md` for evidence and limits.
- Estimate: 1–2 hours. Dependencies: T04.

### T06 — Implement scenario recomputation and comparison
- [x] Add immutable overrides keyed by constraint ID.
- [x] Compare baseline/scenario eligibility, scores, and changed checks.
- [x] Support reset and detect edited constraints.
- [x] Suggest optional changes only after evaluating them against the loaded sample.
- Acceptance: removing one blocker never hides another; reset reproduces baseline; published counts match computed results.
- Verification: independent review, lint, typecheck, all 200 tests across ten files, and production build passed. Scenario checks cover immutable provenance, stale/invalid overrides, reset, comparison transitions/metrics, independently evaluated suggestion counts, and preserved candidate-direction blockers. See `docs/progress/T06.md`.
- Estimate: 1–2 hours. Dependencies: T05.

## Phase 3: Interactive product

### T07 — Build the dashboard and candidate detail experience
- [ ] Build role editor, scenario controls, candidate cards, filters, and baseline/scenario summary.
- [ ] Add detail drawer with separate employer and candidate checks.
- [ ] Add exact source highlighting and unanswered-question prompts.
- [ ] Implement empty, loading, and validation states; keyboard controls; responsive layouts.
- [ ] Persist confirmed role and scenario locally using a versioned storage envelope and reset option.
- Acceptance: entire seeded demo works without an AI key; controls update results immediately; narrow screens remain usable.
- Estimate: 3–4 hours. Dependencies: T06.

## Phase 4: AI-assisted input

### T08 — Build grounded job-description extraction
- [ ] Choose provider and server-only configuration; document actual environment variables.
- [ ] Add request/output validation and input length limits.
- [ ] Extract requirements with exact evidence quotes; resolve and verify source spans in code.
- [ ] Treat the pasted description as data; do not execute instructions within it.
- [ ] Return warnings for ambiguous quotes, inferred importance, unsupported fields, or missing salary units.
- [ ] Add timeout handling, safe errors, and a bounded retry policy.
- Acceptance: unsupported claims are rejected/flagged; no secret reaches client code; failed extraction preserves user text; seeded demo remains available.
- Estimate: 2–3 hours. Dependencies: T03 and T07.

### T09 — Add extraction review and confirmation
- [ ] Let recruiter correct extracted facts and requirement importance before matching.
- [ ] Track manual edits separately from quoted facts; never fabricate evidence for an override.
- [ ] Commit confirmed requirements as a new role revision and invalidate stale scenarios.
- Acceptance: extraction cannot silently alter a live baseline; corrections and their origin are visible.
- Estimate: 1–2 hours. Dependencies: T08.

## Phase 5: Evaluation and delivery

### T10 — Evaluate matching and integration behavior
- [ ] Run at least 15 expected-outcome cases, including mutual-fit conflicts and multiple simultaneous blockers.
- [ ] Test source validation, stale scenario handling, reset, and persistence migrations.
- [ ] Add an end-to-end smoke flow: load sample, inspect blocker, change constraint, verify count, reset.
- [ ] Measure local recomputation with 25 profiles; target under 100 ms in a recorded test environment.
- [ ] Report expected eligibility agreement, unsupported explanation count, extraction errors, and limitations.
- Acceptance: required checks pass; zero unsupported statements in deterministic explanations; failures are documented rather than hidden.
- Estimate: 2 hours. Dependencies: T07 and T09.

### T11 — Polish and package the portfolio demo
- [ ] Add concise product copy, sample-data labels, and independent-project notice.
- [ ] Verify keyboard navigation, readable contrast, and mobile layout.
- [ ] Update README with actual setup commands and architecture choices.
- [ ] Prepare a 60–90 second demo script and a short evaluation report.
- [ ] Run final lint, typecheck, tests, and production build.
- Acceptance: another developer can run the project; a reviewer can understand the value in one minute.
- Estimate: 1–2 hours. Dependencies: T10.

## Deferred work

Real Clera MCP integration, authentication, production hosting, database persistence, resume ingestion, automated outreach, multiple currencies, commute calculations, and production candidate data. Each requires its own scoped follow-up. No messages or introductions are sent by this prototype.

## Suggested milestones

1. Runnable shell: T02–T03.
2. Fully working fictional-data demo: T04–T07.
3. Pasted job-description flow: T08–T09.
4. Reviewable portfolio artifact: T10–T11.

Expected implementation effort after scaffolding: roughly 18–25 focused hours, depending on experience and polish. The earlier 1–2 day estimate applies to a lean demo; the full checklist includes stronger validation and delivery work.
