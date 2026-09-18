# Codexbot

Create a fresh worktree for each new task. Prefer the in-app browser for UI checks.

## Privacy and user data

- Never commit `.private/`, `.runtime/`, `.env*`, browser profiles, memory, uploads, generated Buzz harnesses, deployment IDs, account-specific URLs or credentials.
- Fresh installs start with the generic General Manager from `configuration.mjs`. Never replace an existing catalog or copy a developer's private data into another installation.
- Run `npm ci`, `npm run setup`, and `npm test`. Setup is additive and must preserve existing data.
- Preserve the existing `equipe-*` browser storage keys and `EQUIPE_*` environment aliases for backwards compatibility.
- User-specific installation directory and service label are in ignored `.private/install.json`; configuration is in `.private/config.json`. Use these for updates, never guess another installation's location.
- Before updating a running service, check for active jobs and create a private backup. Never reset histories, agents, memory, skills, subscriptions or browser profiles.

## Publishing

- Optional Sites deployments use ignored `.openai/hosting.json`. Never create a replacement site when a local project ID exists. Preserve the configured audience.
- Set up a `github` remote for this user's repository and `git config core.hooksPath .githooks` to require source mirroring before a Sites push. Do not silently mirror to another person's repository.
- Commit source changes and push to Sites. The hook pushes the exact source commit to GitHub first and blocks publication if that push fails.
- Generate `dist/config.js` using `npm run setup` from private deployment configuration; it contains only public-facing endpoint/display settings, never tokens. Package the committed static assets plus that generated deployment configuration with the Sites hosting helper.
- Save/deploy the pushed source SHA, inspect final status, and fast-forward the user's canonical checkout. Never overwrite unrelated changes.
