# Clera Match Explorer

An independent recruiting prototype that explains mutual candidate-role fit and lets recruiters explore how requirement changes affect a shortlist.

## Current status

The desktop demo includes25 fictional profiles, mutual requirement checks, eligibility/ranking, immutable scenarios, exact source evidence, safe local persistence and optional extraction with explicit review/confirmation. Baseline results are8eligible,9blocked and8needing clarification. Adding remote alongside office makes candidate02 eligible while candidate15 remains salary-blocked.

This is an independent portfolio project, not an official Clera product or integration. No real candidate data is used. Follow the [75-second demo](docs/demo-script.md) or inspect the [observed evaluation](docs/evaluation/report.md) and [desktop accessibility notes](docs/evaluation/desktop-accessibility.md). Live provider quality has not been evaluated without credentials.

## Start here

- `description.md`: product brief, high-level architecture, low-level design, constraints, and demo flow.
- `task.md`: ordered development tasks, dependencies, acceptance criteria, and completion status.
- `src/lib/domain/schemas.ts`: runtime domain validation.
- `src/lib/domain/types.ts`: TypeScript types inferred from the schemas.
- `docs/evaluation/fixture-cases.md`: hand-authored expected outcomes for the fictional dataset.
- `docs/decisions/001-constraint-evaluation.md`: evaluator behavior and current domain limits.

## Stack

Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4 through PostCSS, Zod 4, ESLint 9, Vitest 5 and Playwright. Optional role extraction uses Google's native Gemini generateContent API. Exact dependency versions are recorded in `package.json` and `package-lock.json`.

## Local setup

Use Node.js 24 LTS and npm. The supported Node ranges are declared in `package.json`; the test runner requires at least Node 22.12 on the Node 22 release line.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The complete fictional matching/scenario demo needs no API key or `.env` file.

## Optional job-description extraction

Copy `.env.example` to `.env.local` and set both server-only variables:

```dotenv
GEMINI_API_KEY=your-server-gemini-api-key
GEMINI_MODEL=your-available-gemini-model-id
```

No default model is assumed. Choose an available Gemini model supporting structured JSON output, then restart the server. Use only the plain model ID beginning `gemini-`, not a URL or `models/` prefix. Never prefix these variables with `NEXT_PUBLIC_`, commit `.env.local`, or put keys into browser settings. Missing/invalid Gemini configuration returns503; the seeded demo stays usable. Historical OPENAI variables are ignored: Gemini replaces the previous provider rather than adding a selector.

Use the dashboard's job-description area to request extraction. Failed requests retain your pasted text and current role/scenario. Successful drafts stay isolated from matching and browser storage until you explicitly choose Confirm role. Review warnings and exact source quotes, correct the title or any typed requirement, and apply every pending field edit before confirming. Value corrections become manual facts without source evidence; importance/enabled corrections are editorial changes. Discard leaves the confirmed baseline untouched.

Confirmation creates the next revision of your active role and clears scenario overrides atomically. The confirmed role, including its original source description, is then saved locally with the empty scenario. Reset scenario returns to that new baseline; Load fictional sample restores the original fixtures. Unconfirmed pasted text, drafts and review metadata remain session-local. Cancel, input edits, sample loading and clearing local data invalidate outstanding requests so late responses cannot reintroduce an old draft.

`POST /api/extract-role` accepts `application/json` with only `{ "text": "your original description" }`. It returns `{ draftRole, warnings }`, or safe `{ error: { code, message } }`. Drafts are proposed data and require human confirmation. Browser tests intercept success/error responses and exercise the actual no-key503 path; live model quality remains unverified without credentials.

Matching and scenarios run locally in the browser. Requesting extraction sends pasted text to the app server and Google Gemini. Provider data use/retention follows your Google service/account terms; this app makes no retention guarantee and does not log raw descriptions/provider errors. Only send descriptions you intend to share with that provider. Before enabling paid extraction on a public deployment, add authentication, rate limiting and spend controls at the deployment edge; this prototype endpoint does not provide those controls.

Limits:20,000 UTF-16 characters,128KiB JSON body,512KiB provider body,30 proposed claims. The request deadline is20seconds, with10seconds per provider attempt and at most one retry for network/429/5xx errors; Retry-After seconds are capped to250ms and remaining budget. No retries for refusals, timeouts, invalid output or authentication failures. Errors:400 malformed/blank/extra fields,413 oversized,415 unsupported content type,503 missing configuration,504 timeout,502 provider/refusal/invalid output; caller cancellation uses499. Responses are no-store, unsupported methods405.

Exact source spans are checked in code, and conservative language rules reject unsupported/negated/ambiguous values. Supported normalization is deliberately limited; unknown facts remain null with warnings. Human review is required: structural/span validation does not prove arbitrary semantic truth. See [current Gemini extraction](docs/decisions/007-gemini-extraction.md), Google's [native structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) and [generateContent reference](https://ai.google.dev/api/generate-content). The provider schema omits unsupported string-length keywords while strict local validation retains every limit; a successful schema response is not a factual guarantee. Live Gemini calls/quality have not been evaluated without credentials.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run evaluate
npm run test:e2e -- --project=desktop
```

`typecheck` generates Next.js route types before running TypeScript. Unit/integration tests cover domain/source validation, matching/scenarios, persistence, extraction transport/grounding and review/confirmation. `evaluate` writes ignored JSON artifacts with25 independent expected outcomes, bounded explanation audit, mock extraction handling and25-profile recomputation timing; it never rewrites the tracked report. Use `npm run test:watch` for watch mode.

Build before Playwright; its production server uses isolated port3107 with provider configuration disabled. The installed Windows Chrome is used when present; otherwise install the managed browser with `npx playwright install chromium`. `PLAYWRIGHT_EXECUTABLE_PATH` can select another compatible browser. Current delivery targets desktop; existing responsive code/mobile tests remain available but are not the required gate.

Dependency note (initial setup observation, not a current audit): ESLint9 was pinned for bundled plugin compatibility; setup reported development-tool audit entries. No force downgrade was applied. Re-run `npm audit` when updating dependencies rather than treating that dated observation as a current security assessment.

To serve the production build, stop the development server, run `npm run build`, then `npm start`. Both servers use port 3000 by default. To use another port, append `-- --port 3001` to the server command.

## Runtime structure

- `src/app/layout.tsx`: root document, metadata, and keyboard skip link.
- `src/app/page.tsx`: server entry passing validated fictional fixtures to the client dashboard.
- `src/components/dashboard/`: role/scenario controls, ranked cards, exact-evidence detail dialog and isolated extraction review.
- `src/lib/matching/`: pure three-state checks, mandatory aggregation, weighted preferred fit/known-outcome coverage and deterministic explanations.
- `src/lib/scenarios/`: immutable overrides, reset/comparison and evaluated optional trade-offs.
- `src/lib/storage/`: version1 role/scenario envelope; safe corrupt/stale/unavailable recovery.
- `src/lib/extraction/`: browser-safe contracts/review helpers, conservative grounding and injectable bounded provider/HTTP factories; server-only environment boundary.
- `src/app/api/extract-role/route.ts`: Node POST endpoint; drafts never automatically change the baseline.
- `tests/`, `scripts/evaluate.mjs`: unit/integration, desktop browser checks and reproducible evaluation.
- `src/app/globals.css`: Tailwind entry point and global styles; system fonts avoid build-time font downloads.
- `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`: application, type, and styling configuration.
- `eslint.config.mjs`, `vitest.config.ts`: lint and unit-test configuration.

Runtime setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation), [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs), and [Vitest guide](https://vitest.dev/guide/).

## Domain data and fixtures

`loadDemoFixtures()` from `src/lib/domain/fixtures.ts` loads and validates the local JSON demo data. It returns a fresh parsed copy each time. `parseFixtureDataset(unknown)` validates externally supplied fixture bundles and throws a Zod error with field paths for malformed data. Neither function computes matches or contacts a provider.

Validation checks discriminated constraint values, stable unique IDs, directions, positive active weights, real ISO dates, salary ranges, provenance, and exact UTF-16 source spans. Unknown facts use `value: null` with no evidence; a known empty list remains distinct. Manual overrides cannot claim source evidence. Fixture salaries use annual base USD; unspecified bounds remain distinct from explicit open bounds.

The demo JSON and case documentation contain25 hand-authored expected outcomes, independently compared with computed matching:25/25 agreement in the recorded evaluation. Exact quote validation establishes source integrity; it does not automatically prove arbitrary semantic entailment. Scores are rule-based comparisons, not hiring probabilities. See [fixture expectations](docs/evaluation/fixture-cases.md) and [domain schemas](src/lib/domain/schemas.ts).

## Individual matching checks

`evaluateConstraints(role, candidate)` from `src/lib/matching/evaluate.ts` returns ordered employer and candidate checks for validated records. Each check contains pass/fail/unknown, a reason code, source-span references, and a clarification question when unknown. Disabled checks are omitted. The functions do not access a model, network, storage, or current time, and do not mutate their inputs.

Skills, annual salary intervals, work modes, canonical locations, and employer start deadlines are supported. Hybrid-only compatibility and facts the current role model cannot establish remain unknown. Work-mode compatibility never bypasses geography. Mandatory failures block before unknowns; preferred misses never block. Ranking uses eligibility, preferred fit, known-outcome coverage, then candidate ID. Review [evaluation rules](docs/decisions/001-constraint-evaluation.md), [aggregation](docs/decisions/002-match-aggregation.md), [scenarios](docs/decisions/003-scenarios.md), [local state](docs/decisions/004-dashboard-and-local-state.md) and [explicit confirmation](docs/decisions/006-extraction-review.md).
