# Publishing operations

Sites deployment is optional and uses ignored `.openai/hosting.json`. Keep an existing local
project ID and audience; do not create a replacement site. Source must be mirrored to the user's
configured GitHub repository first through `.githooks`; publication stops if that source push
fails.

Run `npm run setup` only when `dist/config.js` needs regeneration from private deployment
configuration. It may contain public endpoint/display settings only. Save the source SHA and
inspect final deployment status without overwriting unrelated checkout changes.
