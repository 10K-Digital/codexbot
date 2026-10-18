# Codexbot

Use a fresh worktree for every task and prefer the in-app browser for UI checks. Shared execution
details are in `~/.codex/astra-policy.md`: start Astra at low effort, use at most two meaningful
independent subjobs, use no automatic max/ultra escalation or fixed short-interval polling, and
limit one subproblem to five rounds.

## Privacy and safety gates

- Never commit `.private/`, `.runtime/`, `.env*`, browser profiles, memory, uploads, generated
  harnesses, deployment IDs, account URLs, or credentials. Do not copy private installation data
  between installations.
- A fresh install uses the generic General Manager from `configuration.mjs`. Existing catalogues,
  histories, agents, memory, skills, subscriptions, and browser profiles must be preserved.
- The ignored `.private/install.json` and `.private/config.json` identify the actual installation
  and service. Never guess another installation location. Before a running-service update, check
  active jobs and make a private backup.
- Read the operation reference that matches the work: `docs/agent-operations/install.md`,
  `docs/agent-operations/service.md`, or `docs/agent-operations/publish.md`.
- Require independent review for logic, integration, auth, payment, migration, or concurrency
  changes. Mechanical edits receive local checks and root review. Inspect the full diff and run
  `git diff --check` before handoff.
