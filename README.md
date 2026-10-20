# Clera Match Explorer

An independent recruiting prototype that explains mutual candidate-role fit and lets recruiters explore how requirement changes affect a shortlist.

## Current status

T01–T04 are implemented: design documents, a runnable Next.js application shell, validated fictional fixtures, and individual constraint evaluators in both matching directions. The homepage remains the initial shell; eligibility aggregation, ranking, scenario controls, fixture UI, and AI extraction are not implemented yet.

This is an independent portfolio project, not an official Clera product or integration. Initial development uses fictional profiles; no access to Clera's candidate data is assumed.

## Start here

- `description.md`: product brief, high-level architecture, low-level design, constraints, and demo flow.
- `task.md`: ordered development tasks, dependencies, acceptance criteria, and completion status.
- `src/lib/domain/schemas.ts`: runtime domain validation.
- `src/lib/domain/types.ts`: TypeScript types inferred from the schemas.
- `docs/evaluation/fixture-cases.md`: hand-authored expected outcomes for the fictional dataset.
- `docs/decisions/001-constraint-evaluation.md`: evaluator behavior and current domain limits.

## Stack

Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4 through PostCSS, Zod 4, ESLint 9, Vitest 5 and Playwright. Optional role extraction uses the OpenAI Responses API. Exact dependency versions are recorded in `package.json` and `package-lock.json`.

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
OPENAI_API_KEY=your-server-api-key
OPENAI_MODEL=your-account-model-supporting-responses-structured-outputs
```

No default model is assumed. Choose an available model that supports strict JSON-schema Structured Outputs, then restart the server. Never prefix these variables with `NEXT_PUBLIC_`, commit `.env.local`, or put keys into browser settings. Without either variable, valid extraction requests return503; the seeded demo stays usable.

`POST /api/extract-role` accepts `application/json` with only `{ "text": "your original description" }`. It returns `{ draftRole, warnings }`, or safe `{ error: { code, message } }`. Drafts are proposed data, never automatically applied/persisted. T09 adds the review/confirmation UI; currently this is an HTTP/library capability only. The caller must retain pasted text after failure and review every draft before confirmation.

Matching and scenarios run locally in the browser. Requesting extraction sends pasted text to the app server and OpenAI. The adapter requests `store:false`; this is not a promise about provider retention policy. This app does not log raw descriptions or provider errors. Only send descriptions you intend to share with that provider. Before enabling paid extraction on a public deployment, add authentication, rate limiting and spend controls at the deployment edge; this prototype endpoint does not provide those controls.

Limits:20,000 UTF-16 characters,128KiB JSON body,512KiB provider body,30 proposed claims. The request deadline is20seconds, with10seconds per provider attempt and at most one retry for network/429/5xx errors; Retry-After seconds are capped to250ms and remaining budget. No retries for refusals, timeouts, invalid output or authentication failures. Errors:400 malformed/blank/extra fields,413 oversized,415 unsupported content type,503 missing configuration,504 timeout,502 provider/refusal/invalid output; caller cancellation uses499. Responses are no-store, unsupported methods405.

Exact source spans are checked in code, and conservative language rules reject unsupported/negated/ambiguous values. Supported normalization is deliberately limited; unknown facts remain null with warnings. Human review is required: structural/span validation does not prove arbitrary semantic truth. See [extraction decisions](docs/decisions/005-grounded-extraction.md), the official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) and [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

`typecheck` generates Next.js route types before running TypeScript, so it also works before the first build. `npm test` runs the shell smoke test, domain validation, fixture loading, individual comparisons, and constraint-evaluation integration tests. Use `npm run test:watch` for watch mode.

Dependency note: ESLint 9 is pinned because the React, accessibility, and import plugins bundled by `eslint-config-next` do not yet declare ESLint 10 compatibility. npm reports its deprecation and five high-severity development dependency audit entries through the Next.js lint plugin's `fast-glob` → `micromatch` → `braces` chain. The audit currently offers a Next.js lint-config downgrade rather than a compatible patch; this has not been force-applied. `npm audit --omit=dev` reports no production dependency vulnerabilities at setup time. Recheck these tool dependencies when updating the stack.

To serve the production build, stop the development server, run `npm run build`, then `npm start`. Both servers use port 3000 by default. To use another port, append `-- --port 3001` to the server command.

## Runtime structure

- `src/app/layout.tsx`: root document, metadata, and keyboard skip link.
- `src/app/page.tsx`: initial homepage and development status.
- `src/app/globals.css`: Tailwind entry point and global styles; system fonts avoid build-time font downloads.
- `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`: application, type, and styling configuration.
- `eslint.config.mjs`, `vitest.config.ts`: lint and unit-test configuration.

Runtime setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation), [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs), and [Vitest guide](https://vitest.dev/guide/).

## Domain data and fixtures

`loadDemoFixtures()` from `src/lib/domain/fixtures.ts` loads and validates the local JSON demo data. It returns a fresh parsed copy each time. `parseFixtureDataset(unknown)` validates externally supplied fixture bundles and throws a Zod error with field paths for malformed data. Neither function computes matches or contacts a provider.

Validation checks discriminated constraint values, stable unique IDs, directions, positive active weights, real ISO dates, salary ranges, provenance, and exact UTF-16 source spans. Unknown facts use `value: null` with no evidence; a known empty list remains distinct. Manual overrides cannot claim source evidence. Fixture salaries use annual base USD; unspecified bounds remain distinct from explicit open bounds.

The demo JSON and case documentation contain 25 hand-authored expected outcomes for future engine tests: 8 eligible, 9 blocked, and 8 needing clarification. These are expectations rather than computed counts. Exact quote validation establishes source integrity; it does not automatically prove that a structured value follows semantically from a quote. See the [Zod schema API](https://zod.dev/api) for the validation library.

## Individual matching checks

`evaluateConstraints(role, candidate)` from `src/lib/matching/evaluate.ts` returns ordered employer and candidate checks for validated records. Each check contains pass/fail/unknown, a reason code, source-span references, and a clarification question when unknown. Disabled checks are omitted. The functions do not access a model, network, storage, or current time, and do not mutate their inputs.

Skills, annual salary intervals, work modes, canonical locations, and employer start deadlines are supported. Hybrid-only compatibility and facts the current role model cannot establish remain unknown. Work-mode compatibility never bypasses separate geographic checks. See `docs/decisions/001-constraint-evaluation.md` for exact aliases, candidate-direction rules, and the offered-start-date limitation. Eligibility, scoring, ranking, and explanation templates are T05 work.
