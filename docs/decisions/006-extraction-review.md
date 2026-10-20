# Isolated extraction review and explicit role confirmation

`src/lib/extraction/review.ts` creates a detached review from validated success and
active role identity. The review retains original draft/warnings, editable draft,
session generation, active role ID/revision and separate editorial metadata.
`editReview` validates title or typed constraint patches. Value no-ops preserve
extracted provenance; changed values become manual with empty evidence. Typing an
old value back does not regain a quote. Only explicit `revertReviewConstraint`
restores the original fact and editorial settings. Importance/enabled edits retain
value quotes and have independent review-only markers; title changes are manual.

`confirmReview(currentRole, review, session)` rejects stale identity/revision or
session, reparses the full draft and returns `{ role, scenario }`. Active role ID
is retained, revision increments from current revision (not provider draft1), and
scenario overrides reset. Null unknown requirements remain present. Confirmation
does not imply known qualification; an empty draft has an explicit UI warning.

Dashboard stores active role/scenario as one state object so no render evaluates
a new baseline against a stale scenario. Confirmation swaps that pair, clears
selected detail and scenario field drafts, and saves exactly once. No extraction
draft or input edits trigger saving. Confirmed role sources include original
description text and therefore persist locally after explicit confirmation. Reset
scenario returns to the confirmed role; sample/clear explicitly restore fixtures.

The extraction component owns controlled input, request status and detached draft.
It sends unchanged text after the privacy disclosure; response validation includes
exact source-to-submission identity. Error messages are fixed safe UI strings,
not raw upstream payloads. Every request has AbortController and monotonically
increasing generation. Cancel, input changes, discard and unmount invalidate old
generations; sample/clear remount the component. Generation checks after fetch and
JSON parsing also protect against transports that ignore cancellation. Existing
baseline/scenario may continue to be inspected during extraction.

Typed field drafts remain separate from applied review state. Any unapplied value
or title draft disables confirmation, including when another importance/enabled
control is changed. Unknown salary defaults do not assume USD. All correction
controls have labels; notices are live regions with distinct local-save and
extraction names. The original description/proposed facts and warnings remain
inspectable. Existing role details still separate both matching directions.

Fine-grained editorial metadata is session-only; no domain/storage migration is
introduced. After confirmation/reload labels conservatively say importance/title
are recruiter-confirmed and quotes support values only, without claiming a
quoted origin for editorial choices. Changed manual facts retain their domain
origin and missing-evidence labels through persistence.

Tests cover pure validation/provenance/immutability/revision contracts, actual
unconfigured503 preservation, intercepted success/error/network cases, and races
with abort intentionally ignored. No live or paid OpenAI calls are needed. This
tests application review behavior, not provider extraction quality or complete
natural-language entailment; every proposed claim still needs human review.
