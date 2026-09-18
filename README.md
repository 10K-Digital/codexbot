# Codexbot

A self-hosted workspace for a team of agents running through Codex on your Mac, using **your own ChatGPT sign-in**. Includes agent conversations, channels, skills, schedules, approvals, attachments, interactive cards, a shared persistent Chrome browser, and a mobile PWA.

Codexbot is an independent community project, not an official OpenAI, Cursor or xAI product. MIT licensed. It does not include anyone's personal agents, skills, memory, account data or credentials.

## Requirements

- macOS, Node.js 22 or later, npm, Git and Google Chrome.
- Codex available locally and signed in with **ChatGPT**, with account access to Codex. The executor rejects API-key authentication. Usage counts against your account's limits.
- The Mac must remain on and logged in for background work. Some local tools also need the desktop unlocked.
- Optional: Tailscale on the Mac and phone for private HTTPS access. No paid inference API is required by this application; provider plans and limits still apply.

Plugins and connections are those actually available to the local Codex runtime. A connection in ChatGPT alone does not guarantee that this runtime can use it. Authentication, permissions and approvals still apply.

## Quick setup — copy into ChatGPT/Codex Desktop

Use a desktop task that has local terminal/filesystem tools. A web-only ChatGPT conversation cannot install software on your Mac.

```text
Install Codexbot from https://github.com/10K-Digital/codexbot into ~/dev/codexbot.
Read README.md and AGENTS.md first. Check macOS, Git, Node.js >=22, npm,
Google Chrome and the Codex executable. Use my own ChatGPT sign-in; never
request an API key or copy another person's account, agents or credentials.
If the repository already exists, inspect its changes and update safely.
Run npm ci, npm run setup and npm test. Initialize only missing data, with
the default General Manager; preserve every existing agent, memory, skill,
conversation, attachment and browser profile. Run npm run install-service
and verify http://127.0.0.1:4320/health, then open /connect in my browser.
Check that the Codex account is authenticated before sending a test task.
If login is required, let me complete it securely in Codex.
Help me optionally configure private mobile HTTPS through my own Tailscale
account. Verify my Mac's address and my identity instead of guessing them.
Do not enable public Funnel. Do not publish the app or expose credentials.
Show me how to install it on my phone's home screen and enable notifications.
Report the installation/data directory, service label and verification results.
```

## Manual installation

```sh
git clone https://github.com/10K-Digital/codexbot.git ~/dev/codexbot
cd ~/dev/codexbot
npm ci
npm run setup
npm test
npm run install-service
open http://127.0.0.1:4320/connect
```

The installer creates a user LaunchAgent (`one.codexbot.service`) with `RunAtLoad` and `KeepAlive`. It copies code to `~/Library/Application Support/Codexbot`. Logging into macOS starts it; a crash triggers a restart. It does not run before macOS login. Follow the local connection page to pair the browser; keep pairing links private.

Fresh installs have **one General Manager**, no imported skills and no schedules. Create additional agents, channels and skills in the app. The installer generates local Buzz harnesses in the installed `.runtime/buzz-harnesses/` directory.

For development, `npm start` runs in the checkout after setup. Do not run it on the same port as the installed service. `CODEXBOT_PORT` (or legacy `EQUIPE_PORT`) changes the port. `EQUIPE_CODEX` sets the Codex executable path if auto-discovery cannot find it. Sign in through that Codex installation with ChatGPT.

## Mobile access, installation and notifications

Use the private HTTPS address of **your** Tailscale Mac. Install Tailscale on both devices and sign in to the same owner account. Configure Tailscale Serve to forward HTTPS to `http://127.0.0.1:4320` (Serve, **not public Funnel**). Check `tailscale serve --help` for your installed version.

In the installed `.runtime/remote.json`, set verified values:

```json
{"origin":"https://your-mac.your-tailnet.ts.net","login":"your-tailscale-login@example.com"}
```

Restart the service. The server accepts only the configured host and exact owner identity from the local Serve proxy. It always listens on loopback. Never expose port 4320 directly to the public internet. TLS identity forwarding must be working; don't disable the identity check to fix access.

On a phone, an internal guide appears after five seconds, with **Don't show again**. It remains available in **Settings → Home screen installation instructions**.

- **iPhone/iPad:** open in Safari, Share → Add to Home Screen. Open the installed icon before enabling notifications. Web Push requires iOS/iPadOS 16.4 or later.
- **Android:** Chrome menu → Install app / Add to Home screen, or use the app's install button when offered.
- Enable notifications explicitly in the guide. Notifications cover unread responses and pending approvals. Browser/OS support, permission and a running Mac are required; no notification permission is requested automatically.

The preference is per browser/device. The guide is skipped automatically when the app is installed and notifications are already allowed.

## Optional private Sites frontend

The direct Tailscale address is sufficient. Sites hosting is optional and requires the user's own available Sites tools/account.

Configure the **installed** `.private/config.json` (not versioned):

```json
{
  "siteOrigin": "https://your-private-site.example.com",
  "remoteOrigin": "https://your-mac.your-tailnet.ts.net",
  "displayName": "Your name"
}
```

Keep the same non-secret presentation configuration in the source checkout's `.private/config.json` if building a separate frontend. `npm run setup` generates ignored `dist/config.js`. This file contains only the endpoint and display name; **never put tokens in it**. Site project IDs belong in ignored `.openai/hosting.json`. New users create their own site; no project/account is bundled. A separate hosted frontend still requires Tailscale connectivity from the viewing device.

To keep your source repository in sync with Sites, add a `github` remote pointing to **your own repository** and run `git config core.hooksPath .githooks`. The pre-push hook mirrors the exact commit before a Sites main push; a failure blocks publication. It is a local workflow safeguard, not a platform-wide Sites integration. Other publishing tools must follow the same workflow.

## Data, backups and updates

All private data stays in the installation, outside published assets:

| Directory | Contents |
| --- | --- |
| `.private/` | Agent catalog, skills and owner configuration |
| `.runtime/` | Conversations, jobs, memory/workspaces, uploads, approval state, tokens, push subscriptions and Chrome profile |
| `.runtime/browser-profile/` | Persistent browser sessions; never commit or share |

Back up these directories **privately** before maintenance. Account authentication remains managed by Codex; don't copy or publish its credentials. `.gitignore` excludes private state, generated integrations, deployment configuration and common secret formats. It cannot protect data intentionally pasted into tracked source files; review staged changes.

Update source with a fast-forward only, run `npm ci`, `npm test`, then `npm run install-service`. Stop or finish active tasks first. The installer preserves existing private state and does not import private data from the source checkout. `.private/install.json` records the installation path and service label, including custom/legacy installations; keep it for updates. `CODEXBOT_HOME` and `CODEXBOT_SERVICE_LABEL` can explicitly select an installation.

For the default service:

```sh
launchctl kill SIGTERM gui/$(id -u)/one.codexbot.service
# Stop until it is loaded again:
launchctl bootout gui/$(id -u)/one.codexbot.service
# Start again:
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/one.codexbot.service.plist
```

A restart does not silently replay interrupted tasks. Review possible external side effects before retrying.

## Agent tools and browser

Agents can delegate with `team_send_message`, read team replies, request approvals and edit skills when instructed. The persistent Chrome browser supports pop-up tabs, switching/closing tabs and manual handoff. Two fingers scroll on touch screens. This is a shared browser on the Mac, not a separate VM per agent.

`team_show_card` creates cards with text, inputs, textareas, multiple-choice fields, tables, bar/line charts, diagrams, buttons and sandboxed static HTML. Submitted values are validated and returned to the originating conversation. Cards do not grant external-action approval.

## A2A and Buzz

Authenticated A2A catalog: `/a2a`; agent cards: `/a2a/{agentId}/.well-known/agent-card.json`; JSON-RPC: `/a2a/{agentId}`. Legacy 0.3 endpoints use `/a2a/legacy/{agentId}`. Supports task send/read/list/cancel/stream; no A2A push callbacks.

Create scoped credentials using `a2a-clients.mjs`, with `EQUIPE_HOME` pointing to your installation if it is nondefault:

```sh
node a2a-clients.mjs create 'My client' --agents general-manager --output /private/path/client-token
```

Use `Authorization: Bearer TOKEN` and `A2A-Version: 1.0`. Keep the token private. `list` and `revoke ID` manage clients. The Buzz ACP adapter uses its own local token; configure your own Relay and identity. No Relay credentials or identities are included.

## Development and limitations

`npm test` runs the automated suite. `node scripts/check-source.mjs` checks staged/tracked source for private paths and common credential patterns; the optional Git hooks run it before commits. Manual review is still required. Test a clean installation separately from an existing user profile. Codex App Server evolves; compatibility with future versions is not guaranteed. The app is currently macOS-specific. Interface: Portuguese, English and Spanish. Existing schedule expressions use the `America/Sao_Paulo` timezone; review schedules before enabling them in another timezone.

The repository license covers Codexbot, not third-party services or subscriptions. Check upstream terms and account capabilities when installing.

## Voice messages without a paid speech API

Use the microphone icon beside the attachment icon to record up to three minutes, or choose an audio file (up to 12 MB). Review the transcript before adding it to the message draft. Nothing is sent to an agent until you press Send.

Transcription runs locally on the Mac with faster-whisper (multilingual `base`, CPU/int8). No speech API key or additional subscription is needed. Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run `npm run setup:voice` **inside the active installation directory** (by default `~/Library/Application Support/Codexbot` after `npm run install-service`). This downloads the Python runtime, speech dependencies and model once. Restarting the service is not required. For development, run it in the checkout instead.

The phone must allow microphone access and use HTTPS. Safari/iOS and Chrome choose their supported recording format automatically. Recordings are temporarily stored under `.runtime/voice` and removed when transcription finishes or fails; transcripts remain only in your browser draft until sent. Model and Python files live in `.private` and never enter Git. These files are preserved by application updates. CPU speed and audio quality affect transcription time and accuracy.

### Live voice with the ChatGPT subscription (experimental)

The same microphone dialog offers **Start voice conversation**. This uses the installed Codex app-server's **WebRTC realtime v3** transport and the existing ChatGPT login; no API key is supplied. Audio goes directly between the browser and the voice service. The Mac starts the authenticated session and runs agent tasks, using the selected agent's instructions, skills, tools and approval workflow. Final speech transcripts are saved in that agent's conversation.

This path was verified with a real audio round trip; the older WebSocket transport required API-key authentication, while WebRTC without v3 failed protocol negotiation. Availability can still depend on the installed Codex version, account rollout and subscription limits. This is not a promise of unlimited voice or a stable public integration contract. Keep the desktop app updated and use local transcription if realtime is unavailable. Voice and agent inference consume the account's existing allowances; see [official voice pricing](https://learn.chatgpt.com/docs/pricing).

Use Mute or End call in the conversation bar. Calls stop when the page is hidden or left, after 20 minutes, or after 45 seconds without a client heartbeat. An agent already working must finish before starting voice. The normal approval cards remain available while talking. Audio playback may require tapping Play audio on mobile browsers. A physical smartphone microphone still needs a device-specific permission/playback check.


## Mascot and motion

The official transparent icon combines the green interwoven mascot with a playful wink. `dist/mascot.svg` is its simplified animated loading version: the outer loops rotate and breathe independently of the stationary face. Agent avatars have individual gradient fills and a smaller thinking animation. Animations respect reduced-motion preferences. Existing installed PWA icons may refresh only when the home-screen shortcut is reinstalled.

### Feedback-driven improvements

Each completed reply has copy, thumbs-up and thumbs-down icons. Ratings are saved immediately; written feedback is optional and editable by rating the reply again. Feedback and instruction history stay in `.runtime/feedback.json`, excluded from Git.

General Manager receives the native **Codexbot Feedback Review** skill. A local scheduler checks for new feedback every Monday at 09:00 in `America/Sao_Paulo` (or after the Mac next becomes available). Empty reviews invoke no AI. Reviews process up to 40 feedback items at a time; remaining items can be reviewed manually or at the next weekly run.

Open **Settings → Feedback and improvements** or the General Manager's **Routines** tab to review suggestions, approve/reject each addition, run a review, pause the weekly schedule, or enable automatic incorporation of pending and future suggestions. Automatic incorporation is off by default. Existing instructions are preserved, and concurrent edits require manual review. A failed review retains feedback for the next scheduled or manual attempt.
