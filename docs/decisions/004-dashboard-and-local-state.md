# Recruiter dashboard, local state, and browser verification

The server homepage passes validated fictional fixtures to a client dashboard.
Client state stores only confirmed role, scenario, UI selection/filter/drafts and
restore status. Matching, summaries, ordering, scenario comparisons and optional
trade-offs are derived from T05/T06 APIs. No provider key or network service is
needed for the sample. Employer and candidate checks stay independent.

All existing requirement kinds have typed scenario controls. Value fields are
drafts until Apply requirement validates them. Errors keep the draft and last
valid result; importance/enabled controls recompute immediately. Open salary
endpoints are explicit, dates require valid YYYY-MM-DD, and geographic alternatives
are canonical comma-separated IDs. Reset clears all overrides and drafts. Applying
an edit preserves the control instance and keyboard focus; reset/sample/suggestion
actions deliberately refresh drafts from the chosen effective role. This task
edits scenarios only; confirming a new role baseline belongs to the later
extraction review flow.

The native modal dialog is named, focuses Close on opening, contains keyboard
navigation, closes with Escape, and returns focus to its opener. Detail separates
both directions and retains blockers, unknown questions and removed checks.
Evidence is resolved by source ID and exact UTF-16 offsets. React text nodes and
marks render the source slice safely, never HTML injection. Invalid spans show an
unavailable notice; changed values show manual provenance without fabricated
source quotes. Coverage is a known-outcome percentage, not source certification.

`src/lib/storage/persistence.ts` injects a lazy StoragePort getter so denied browser
access, read failures, quota errors and clearing failures can be caught. The single
key is `clera-match-explorer.state.v1`. Its schemaVersion1 envelope contains only
validated role and scenario. No candidates, matches, drafts, selections, filter
values or credentials are persisted. Missing/malformed/unsupported-version/invalid
role state falls back visibly to fictional fixtures. A valid saved role with stale
or invalid scenario retains the role and resets overrides; these outcomes have
distinct restore status codes. There is no older version to migrate.

Initial server and client renders agree. Restoration happens after hydration;
scenario writes occur only in user handlers, so initial sample state cannot
overwrite saved state. Load fictional sample resets the entire workspace and
saves the sample identity. Reset scenario retains baseline and saves empty
overrides. Clear local data removes this app's key and restores sample UI without
writing again until the next edit. Unrelated storage keys remain intact. Browser
storage is local to this origin/device; failures leave the demo usable with a
notice that changes may not survive reload.

Run `npm run build` then `npm run test:e2e`. Playwright starts a production server
at 127.0.0.1:3107 and checks desktop1440px and mobile390px Chromium layouts. An
installed Windows Chrome is used when available; otherwise the Playwright-managed
Chromium is used (`npx playwright install chromium` on a fresh machine). Set
`PLAYWRIGHT_EXECUTABLE_PATH` to use another compatible browser such as Edge.
Browser tests cover the remote scenario story, source quote, modal keyboard
behavior, invalid typed drafts, filtering, persistence/reset/clear and corrupt or
unavailable writes. Unit tests cover additional stale/invalid role and denied
storage reads. This is documented targeted coverage, not exhaustive accessibility
or cross-browser certification. Screenshots are saved under gitignored
`artifacts/t07/`; trace failures under gitignored `test-results/`. Vitest excludes
the Playwright suite. T10 will extend end-to-end/performance evaluation.
