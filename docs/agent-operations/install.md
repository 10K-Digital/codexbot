# Installation operations

Use `npm ci` only when dependencies are required for the requested work or verification. Run
`npm run setup` only when configuration or generated public deployment settings require it; setup
is additive and must preserve existing data. Run the smallest relevant test, normally `npm test`.

For installation or upgrade, follow `docs/installation.md` and use the existing installation
descriptor. Do not use a temporary worktree as an installation target. A service-changing install
requires an active-job check and a private backup first.
