# Service operations

Read the registered installation path and service label from ignored `.private/install.json`.
Before updating a running service, check active jobs and create a private backup. Preserve current
runtime data and do not reset or replay ambiguous external actions. Verify the smallest affected
health behavior after a supervised service change.

`npm run install-service` is a low-level maintenance command; the documented local installer
workflow adds the required job and backup protection.
