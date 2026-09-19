# Codexbot

**Website & interactive demo:** [codexbot.live](https://codexbot.live)

A self-hosted workspace for a team of agents running through Codex on your Mac, using **your own ChatGPT sign-in**. Includes agent conversations, channels, skills, schedules, approvals, attachments, interactive cards, a shared persistent Chrome browser, and a mobile PWA.

Codexbot is an independent community project, not an official OpenAI, Cursor or xAI product. MIT licensed. It does not include anyone's personal agents, skills, memory, account data or credentials.

## Requirements

- macOS, Node.js 22 or later, npm, Git and Google Chrome.
- Codex available locally and signed in with **ChatGPT**, with account access to Codex. The executor rejects API-key authentication. Usage counts against your account's limits.
- The Mac must remain on and logged in for background work. Some local tools also need the desktop unlocked.
- Optional: Tailscale on the Mac and phone for private HTTPS access. No paid inference API is required by this application; provider plans and limits still apply.

Plugins and connections are those actually available to the local Codex runtime. A connection in ChatGPT alone does not guarantee that this runtime can use it. Authentication, permissions and approvals still apply.

## Install with one command

Open **Terminal on your Mac** and paste:

```sh
curl -fsSL https://raw.githubusercontent.com/10K-Digital/codexbot/main/install.sh | bash
```

The installer sets up missing prerequisites, guides your ChatGPT sign-in, downloads Codexbot, runs setup and tests, installs the login service and opens the local connection page. Homebrew/macOS approvals and signing in may still need your interaction. Run as your normal user, **without sudo**. Requires a macOS version supported by the dependencies and a ChatGPT account with Codex access; account limits apply.

Run the same command to update an installation created by it. Updates refuse active tasks or a dirty/diverged source checkout, back up the existing installation privately, and preserve your agents, history, skills and browser profile. Remote access is a separate optional step; this command does not expose your Mac publicly.

See the **[installation guide](docs/installation.md)** for an inspect-first download, custom paths, troubleshooting, backups and optional local transcription. Prefer an assistant? Use the prompt below.

## Quick setup — copy into ChatGPT/Codex Desktop

Use a desktop task that has local terminal/filesystem tools. A web-only ChatGPT conversation cannot install software on your Mac.

```text
Install Codexbot from https://github.com/10K-Digital/codexbot on my Mac.
Read README.md, AGENTS.md and docs/installation.md first. Inspect install.sh
before executing it, then use that installer from an interactive terminal.
If a checkout or installation already exists, use its source path and recorded
.private/install.json; never guess another installation or discard local edits.
Use my own ChatGPT sign-in; never request an API key or copy anyone else's data.
Let me complete Homebrew/macOS prompts and ChatGPT login myself if required.
The installer must run npm ci, setup and tests, reject active jobs, back up any
existing installation privately and preserve agents, memory, skills, messages,
attachments, schedules, subscriptions and browser profiles. Do not bypass its
safety checks or automatically replay interrupted tasks.
Verify the local /health endpoint and open /connect, without exposing tokens.
Then help configure optional private HTTPS using docs/remote-access.md and my
own Tailscale account. Verify the Mac address and owner identity; do not enable
public Funnel or expose credentials. Show how to add the PWA to my phone's
home screen and enable notifications. Report installation path, service label,
backup location and verification results.
```

## Manual installation

```sh
git clone https://github.com/10K-Digital/codexbot.git ~/dev/codexbot
cd ~/dev/codexbot
npm ci
npm run setup
npm test
node scripts/install-local.mjs --bootstrap
```

The installer creates a user LaunchAgent (`one.codexbot.service`) with `RunAtLoad` and `KeepAlive`. It copies code to `~/Library/Application Support/Codexbot`. Logging into macOS starts it; a crash triggers a restart. It does not run before macOS login. Follow the local connection page to pair the browser; keep pairing links private.

Fresh installs have **one General Manager**, no imported skills and no schedules. Create additional agents, channels and skills in the app. The installer generates local Buzz harnesses in the installed `.runtime/buzz-harnesses/` directory.

For development, `npm start` runs in the checkout after setup. Do not run it on the same port as the installed service. `CODEXBOT_PORT` (or legacy `EQUIPE_PORT`) changes the port. `EQUIPE_CODEX` sets the Codex executable path if auto-discovery cannot find it. Sign in through that Codex installation with ChatGPT.

## How the Mac bridge works and remote access

Your phone is the control surface; the Mac runs the bridge, agents, tools and persistent workspace. Model inference uses your ChatGPT account in the cloud. See the dedicated guides (Português):

- [The Mac bridge: architecture, message flow and trust boundaries](docs/mac-bridge.md)
- [Secure remote access: Tailscale Serve, SSH and authenticated public gateways](docs/remote-access.md)

Tailscale Serve is the supported private path. Public tunnels need an identity gateway; cookie-based login also requires the frontend adaptation documented in the guide. A public URL alone does not authenticate visitors.

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

Use the one-line installer again, or `bash install.sh --source /absolute/path/to/your/checkout`. It updates source by fast-forward only, runs setup and tests, verifies jobs, and makes a private backup before replacing the service. Finish or stop active tasks first. See [installation and recovery](docs/installation.md). The lower-level `npm run install-service` is for manually supervised installs and does not perform the wrapper’s job checks and backup. The installer preserves existing private state and does not import private data from the source checkout. `.private/install.json` records the installation path and service label, including custom/legacy installations; keep it for updates. `CODEXBOT_HOME` and `CODEXBOT_SERVICE_LABEL` can explicitly select an installation.

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

The waveform button next to the microphone starts or ends a live voice conversation directly. The microphone opens recording and local transcription. This uses the installed Codex app-server's **WebRTC realtime v3** transport and the existing ChatGPT login; no API key is supplied. Audio goes directly between the browser and the voice service. The Mac starts the authenticated session and runs agent tasks, using the selected agent's instructions, skills, tools and approval workflow. Final speech transcripts are saved in that agent's conversation.

This path was verified with a real audio round trip; the older WebSocket transport required API-key authentication, while WebRTC without v3 failed protocol negotiation. Availability can still depend on the installed Codex version, account rollout and subscription limits. This is not a promise of unlimited voice or a stable public integration contract. Keep the desktop app updated and use local transcription if realtime is unavailable. Voice and agent inference consume the account's existing allowances; see [official voice pricing](https://learn.chatgpt.com/docs/pricing).

Use Mute or End call in the conversation bar. Calls stop when the page is hidden or left, after 20 minutes, or after 45 seconds without a client heartbeat. An agent already working must finish before starting voice. The normal approval cards remain available while talking. Audio playback may require tapping Play audio on mobile browsers. A physical smartphone microphone still needs a device-specific permission/playback check.


## Mascot and motion

The official transparent icon combines the green interwoven mascot with a playful wink. `dist/mascot.svg` is its simplified animated loading version: the outer loops rotate and breathe independently of the stationary face. Agent avatars have individual gradient fills and a smaller thinking animation. Animations respect reduced-motion preferences. Existing installed PWA icons may refresh only when the home-screen shortcut is reinstalled.

### Feedback-driven improvements

Each completed reply has copy, thumbs-up and thumbs-down icons. Ratings are saved immediately; written feedback is optional and editable by rating the reply again. Feedback and instruction history stay in `.runtime/feedback.json`, excluded from Git.

General Manager receives the native **Codexbot Feedback Review** skill. A local scheduler checks for new feedback every Monday at 09:00 in `America/Sao_Paulo` (or after the Mac next becomes available). Empty reviews invoke no AI. Reviews process up to 40 feedback items at a time; remaining items can be reviewed manually or at the next weekly run.

Open **Settings → Feedback and improvements** or the General Manager's **Routines** tab to review suggestions, approve/reject each addition, run a review, pause the weekly schedule, or enable automatic incorporation of pending and future suggestions. Automatic incorporation is off by default. Existing instructions are preserved, and concurrent edits require manual review. A failed review retains feedback for the next scheduled or manual attempt.

### Message threads and bounded context

Use the reply icon on a message to open an independent thread. Replies to that same message reopen its thread; nested threads start from their own selected message. Threads work in agent conversations and channels, retain their own drafts, and appear in the sidebar with unread/approval indicators. The back link returns to the parent conversation. Older messages remain available through **Load earlier messages**.

Each text task starts a fresh ephemeral Codex session. The application sends at most 12 recent messages within a 12,000-character history budget, plus up to 3,000 characters from the thread's origin message and bounded attachment metadata. Agent instructions, the current request, and current attachments are separate from this history budget. Old tool traces and duplicate channel history are not replayed. A task's ongoing tool execution can still consume additional context.

The `team_search_history` tool performs local keyword search and cursor pagination within the current conversation only, returning at most 6,000 characters of snippets per call. It does not call an AI or an embedding service. Thread workspaces are separated by conversation; history is preserved on disk rather than summarized destructively. Feedback review tasks load their reserved batch instead of replaying the General Manager chat. Character budgets are deterministic bounds, not exact tokenizer counts.

### Adaptive model routing and retries

Text tasks (including agent delegations and scheduled jobs) use a local, deterministic complexity classifier, with no model call for routing. Short, simple requests start with Luna low; ordinary requests use Luna medium; analytical work uses Luna high; challenging debugging/refactoring uses Luna max. Large, multi-step architecture work can start with Sol high; specialist problems can start with Astra high. These are heuristics, not a guarantee of task complexity. Attachments also raise the initial effort. The bridge reads `model/list` from the signed-in Codex account and only uses advertised model/effort combinations. Realtime voice keeps its separately negotiated voice engine.

Failed tasks can escalate to a stronger effort/model, with **three total attempts** and a short backoff. The agent can explicitly report an unsuccessful outcome through `team_report_outcome`; completed transport status alone is not proof that the user's goal succeeded. Successful tasks are not evaluated by a second model. Cancelled tasks, missing permissions, quota/connection failures, uncertain start acknowledgements, and tasks with potentially executed side effects are not automatically replayed. Attempts and stop reasons appear in Activity. Previous failed attempt output stays on disk but is excluded from the normal chat and future immediate context.

Private `.runtime/task-failures.json` stores bounded request/error excerpts, model, effort, attempt, recovery and failure category. Terminal failures and recovered errors are incorporated into the weekly feedback review without duplicating existing records. Each review batch is limited to 20,000 characters of evidence, with remaining items left for later reviews. The native skill distinguishes instruction problems from infrastructure/access problems and still requires approval unless automatic incorporation is enabled. Feedback-review failures are logged but do not recursively create more feedback-review work. Logs and feedback remain gitignored; they are never shipped with the public source.

The implementation uses the Codex App Server's per-turn `model` and `effort` settings: [official protocol documentation](https://developers.openai.com/pt-BR/docs/app-server).
