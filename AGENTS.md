<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project agent workflow

For development requests, follow `docs/agent-workflow.md`. Use the project-scoped
agents in `.codex/agents/`: `planner`, `developer`, `tester-reviewer`, and `committer`.
The first three are the core team; the committer runs only after verification.
The main thread coordinates handoffs and reports progress to the user.

Work on one backlog task at a time in dependency order. The cycle is:
planner -> developer -> tester-reviewer -> committer -> next task.
On failed review or testing, return to planner -> developer -> tester-reviewer.
Do not advance to the next task until the current task passes and its commit is
confirmed on the configured GitHub remote. A request to configure or explain this
workflow does not itself start backlog implementation or publish existing changes.

Keep a task record under `docs/progress/` with the plan, changes, failures, fix
attempts, verification evidence, unresolved limitations, and delivery state.
Never claim exhaustive testing or a successful push without evidence.
Preserve pre-existing work, serialize edits and Git operations, and read the
installed Next.js guides before writing application code as required above.
