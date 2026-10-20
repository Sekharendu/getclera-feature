# Project development workflow

This repository uses three core specialists: planner, developer, and combined
tester/reviewer. A fourth specialist, committer, handles verified Git delivery.
The main Codex thread coordinates them and gives the user progress reports.
Definitions live in `.codex/agents/` and apply to this project only.

## Starting a run

Example request:

> Start the project agent workflow at the next pending task. Continue through
> T11. Plan, implement, test and review, loop through planned fixes when needed,
> then commit and push each passing task before planning the next one.

An explicit single-task request limits the workflow to that task. A setup-only
request creates configuration without starting development or pushing changes.
This is an instruction-driven workflow run by Codex, not an unattended background
service. Available tools, credentials, session limits, and user steering still apply.
When resuming, inspect the task record and Git state rather than assuming the
previous run completed. Agent names describe roles; when named custom agents are
unavailable in the current client, delegate with the corresponding TOML instructions.

## Cycle and handoffs

1. **Planner:** inspect dependencies and existing code, record the initial Git
   state, and write a concrete acceptance and implementation plan.
2. **Developer:** implement the plan and relevant feature tests, run focused
   checks, document changes, and freeze edits for verification.
3. **Tester/reviewer:** independently inspect and exercise the stable changes.
   Run lint, typecheck, the full unit/integration suite, and production build
   sequentially. Add task-specific browser, failure-path, and performance checks
   where applicable. Required checks that cannot run keep the task pending.
4. **Failure:** record reproducible findings. Planner writes a fix plan;
   developer implements it; tester/reviewer rechecks. Repeat until PASS or a
   concrete blocker requires user input. Do not repeatedly retry an unchanged
   failure or conceal an environmental problem.
5. **PASS:** tester/reviewer records verified acceptance criteria and updates
   task.md. Record the approved files and task-file fingerprints. Application,
   test, or configuration changes after PASS require renewed verification.
6. **Committer:** verify the approved snapshot, commit only the reviewed scope,
   push to the existing GitHub origin/current branch, and verify the remote SHA.
7. **Coordinator:** report changes, failures and fixes, checks, remaining limits,
   task position, and commit/link. Only after a verified push, plan the next task
   within the user's requested scope.

Keep dependent phases sequential. Do not have the developer edit files while
they are being reviewed, tested, or committed. Use at most three active
subagents alongside the coordinator, subject to the client's available capacity;
activate the committer after verification and release idle roles if necessary.

## Task record

Planner creates `docs/progress/Txx.md` for the assigned backlog task. Each role
updates its own evidence before returning its handoff:

```markdown
# Txx - Task title

## State
Planned | Implementing | Verifying | Fix required | Verified / delivery pending

## Starting point
Starting HEAD, branch, remote, pre-existing tracked/untracked changes, dependencies.

## Plan and acceptance criteria
Scope, implementation steps, affected files, interfaces, edge cases, exact checks.

## Changes
Files changed, resulting behavior, design decisions.

## Review and fix history
Finding ID, severity, reproduction, cause, fix plan, implementation, recheck result.

## Verification
Commands, exit codes, acceptance evidence, browser/performance observations,
NOT RUN checks and reasons, unresolved limitations, PASS or FAIL.

## Approved snapshot
Reviewed HEAD, explicit deliverable file list, SHA-256 hashes for task files
(including untracked files; exclude this record to avoid a recursive hash).

## Delivery handoff
Intended remote and branch; verified task awaiting commit/push.
The coordinator reports the actual commit SHA and confirmed remote state in chat.
On resume, verify delivery using Git rather than inferring it from this record.
```

The task record is included in the task commit. Keep it at verified/delivery
pending before committing: writing the same commit's SHA into itself would
require another commit. Use the remote branch and commit history as delivery
evidence. Report a failed push explicitly, preserve the local commit, and retry
delivery only after resolving the cause; do not proceed to the next task.

## Ownership and existing work

Planner edits plans; developer edits application code and feature tests;
tester/reviewer may add independent tests, verification records, and verified
backlog updates; committer owns Git staging, commit, and push operations.
The coordinator serializes shared-document edits and resolves scope conflicts.
Preserve pre-existing work and never stage unrelated changes wholesale. Necessary
uncommitted dependencies must be explicitly reviewed and included as an agreed
deliverable, or delivered separately before the new task's commit. Do not publish
a task that depends on omitted local-only files.

The configured remote when this workflow was created was
`https://github.com/Sekharendu/getclera-feature.git`. Always inspect current Git
configuration before delivery. Never force-push or silently switch the destination.

## Project-specific verification

Use task.md acceptance criteria and description.md as the specification. Preserve
deterministic matching, both matching directions, unknown-versus-failure semantics,
exact source spans, immutable baselines, and the fictional-data demo without an AI
key. Add UI, persistence, extraction, and end-to-end checks as those features land.
Read the relevant `node_modules/next/dist/docs/` guides before writing Next.js code.
“Thoroughly tested” means documented checks appropriate to the change; it does not
mean that every possible input, browser, or defect has been exhausted.
