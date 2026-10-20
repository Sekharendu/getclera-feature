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

Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4 through PostCSS, Zod 4, ESLint 9, and Vitest 5. Exact dependency versions are recorded in `package.json` and `package-lock.json`. The AI provider will be selected in T08.

## Local setup

Use Node.js 24 LTS and npm. The supported Node ranges are declared in `package.json`; the test runner requires at least Node 22.12 on the Node 22 release line.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No API key or `.env` file is required for the application shell. `.env.example` remains a placeholder for T08.

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
