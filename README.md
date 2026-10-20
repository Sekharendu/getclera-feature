# Clera Match Explorer

An independent recruiting prototype that explains mutual candidate-role fit and lets recruiters explore how requirement changes affect a shortlist.

## Current status

T01 and T02 are implemented: the repository includes design documents, initial domain interfaces, and a runnable Next.js application shell. The homepage describes the planned workflow; candidate fixtures, matching, scenario controls, and AI extraction are not implemented yet.

This is an independent portfolio project, not an official Clera product or integration. Initial development uses fictional profiles; no access to Clera's candidate data is assumed.

## Start here

- `description.md`: product brief, high-level architecture, low-level design, constraints, and demo flow.
- `task.md`: ordered development tasks, dependencies, acceptance criteria, and completion status.
- `src/lib/domain/types.ts`: starting domain contracts.

## Stack

Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4 through PostCSS, ESLint 9, and Vitest 5. Exact dependency versions are recorded in `package.json` and `package-lock.json`. The AI provider will be selected in T08.

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

`typecheck` generates Next.js route types before running TypeScript, so it also works before the first build. `npm test` runs the shell rendering smoke test; matching tests will be added as the engine is implemented. Use `npm run test:watch` for watch mode.

Dependency note: ESLint 9 is pinned because the React, accessibility, and import plugins bundled by `eslint-config-next` do not yet declare ESLint 10 compatibility. npm reports its deprecation and five high-severity development dependency audit entries through the Next.js lint plugin's `fast-glob` → `micromatch` → `braces` chain. The audit currently offers a Next.js lint-config downgrade rather than a compatible patch; this has not been force-applied. `npm audit --omit=dev` reports no production dependency vulnerabilities at setup time. Recheck these tool dependencies when updating the stack.

To serve the production build, stop the development server, run `npm run build`, then `npm start`. Both servers use port 3000 by default. To use another port, append `-- --port 3001` to the server command.

## Runtime structure

- `src/app/layout.tsx`: root document, metadata, and keyboard skip link.
- `src/app/page.tsx`: initial homepage and development status.
- `src/app/globals.css`: Tailwind entry point and global styles; system fonts avoid build-time font downloads.
- `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`: application, type, and styling configuration.
- `eslint.config.mjs`, `vitest.config.ts`: lint and unit-test configuration.

Runtime setup follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation), [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs), and [Vitest guide](https://vitest.dev/guide/).
