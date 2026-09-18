#!/bin/bash
# Codexbot installer for macOS. Read before running; never run as root.
# Keeping execution inside main prevents a truncated download from executing its body.
set -euo pipefail

say() { printf '\n%s\n' "$*"; }
fail() { printf '\nCodexbot: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'HELP'
Usage: bash install.sh [--source PATH] [--check] [--no-open] [--with-local-voice]
Installs Codexbot for the current macOS user, preserving existing private data.
--source PATH       Source checkout (default: saved location or ~/dev/codexbot).
--check             Read-only prerequisite report; no downloads or service changes.
--no-open           Do not open the local connection page after installation.
--with-local-voice  Also install optional local speech transcription (uv + model).
Homebrew may request macOS approval. ChatGPT sign-in remains interactive.
No tunnel, public endpoint or API-key authentication is configured.
HELP
}
node_ok() { command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; }
git_ok() { command -v git >/dev/null 2>&1 && git --version >/dev/null 2>&1; }
find_codex() {
  if [ -n "${EQUIPE_CODEX:-}" ]; then command -v "$EQUIPE_CODEX" 2>/dev/null || fail "EQUIPE_CODEX does not point to an executable."; return; fi
  if [ -x /Applications/ChatGPT.app/Contents/Resources/codex ]; then printf '%s\n' /Applications/ChatGPT.app/Contents/Resources/codex; return; fi
  command -v codex 2>/dev/null || true
}
main() {
  local source_dir='' check=0 no_open=0 local_voice=0 option
  while [ "$#" -gt 0 ]; do
    option="$1"; shift
    case "$option" in
      --source) [ "$#" -gt 0 ] || fail '--source needs a path'; source_dir="$1"; shift ;;
      --check) check=1 ;;
      --no-open) no_open=1 ;;
      --with-local-voice) local_voice=1 ;;
      --help|-h) usage; return ;;
      *) fail "Unknown option: $option" ;;
    esac
  done
  [ "$(uname -s)" = Darwin ] || fail 'macOS is required.'
  [ "$(id -u)" -ne 0 ] || fail 'Run as your normal macOS user, not sudo/root.'
  local brew_bin='' codex_bin registry="$HOME/.config/codexbot/source"
  export PATH="$HOME/.local/share/codexbot/tools/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
  codex_bin="$(find_codex)"
  if [ "$check" -eq 1 ]; then
    say 'Read-only prerequisite check'
    node_ok && say 'Node.js >=22 and npm: OK' || say 'Node.js >=22 and npm: missing'
    git_ok && say 'Git: OK' || say 'Git: missing'
    [ -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' ] && say 'Chrome: OK' || say 'Chrome: missing'
    [ -n "$codex_bin" ] && say 'Codex: found (authentication checked during install)' || say 'Codex: missing'
    return
  fi
  umask 077
  if [ -z "$source_dir" ] && [ -f "$registry" ]; then IFS= read -r source_dir < "$registry" || true; fi
  source_dir="${source_dir:-$HOME/dev/codexbot}"
  case "$source_dir" in /*) ;; *) source_dir="$PWD/$source_dir" ;; esac
  say "Installing Codexbot. Source: $source_dir"
  installer_tmp="$(mktemp -d "${TMPDIR:-/tmp}/codexbot-install.XXXXXX")"
  trap 'rm -rf -- "$installer_tmp"' EXIT
  if ! node_ok || ! git_ok || [ ! -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' ] || { [ "$local_voice" -eq 1 ] && ! command -v uv >/dev/null 2>&1; }; then
    brew_bin="$(command -v brew || true)"
    if [ -z "$brew_bin" ]; then
      [ -r /dev/tty ] || fail 'Open Terminal to approve Homebrew installation, then run again.'
      say 'Installing Homebrew from its official installer. Follow its terminal prompts.'
      curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$installer_tmp/homebrew.sh"
      /bin/bash "$installer_tmp/homebrew.sh" < /dev/tty
      brew_bin="$(command -v brew || true)"
      [ -n "$brew_bin" ] || fail 'Homebrew setup did not finish. Complete its instructions and run again.'
    fi
    if ! node_ok; then
      "$brew_bin" install node@22
      export PATH="$("$brew_bin" --prefix node@22)/bin:$PATH"
    fi
    if ! git_ok; then "$brew_bin" install git; fi
    if [ ! -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' ]; then "$brew_bin" install --cask google-chrome < /dev/tty; fi
    if [ "$local_voice" -eq 1 ] && ! command -v uv >/dev/null 2>&1; then "$brew_bin" install uv; fi
  fi
  node_ok || fail 'Node.js >=22 and npm are required.'
  git_ok || fail 'Git is required. Finish the Apple Command Line Tools setup and run again.'
  if [ -z "$codex_bin" ]; then
    say 'Installing the official Codex CLI into your user tools directory.'
    npm install --prefix "$HOME/.local/share/codexbot/tools" --no-audit --no-fund @openai/codex
    codex_bin="$HOME/.local/share/codexbot/tools/node_modules/.bin/codex"
  fi
  [ -x "$codex_bin" ] || fail 'The configured Codex executable is not available.'
  export EQUIPE_CODEX="$codex_bin"
  # Never print login-status output: alternate authentication modes may contain key metadata.
  local login_status
  login_status="$(env -u OPENAI_API_KEY -u CODEX_API_KEY "$codex_bin" login status 2>&1 || true)"
  if printf '%s' "$login_status" | /usr/bin/grep -qi 'API key'; then fail 'Codex currently uses API-key authentication. Sign in with ChatGPT manually, then rerun. This installer did not replace your credentials.'; fi
  if ! printf '%s' "$login_status" | /usr/bin/grep -qi 'logged in using chatgpt'; then
    [ -r /dev/tty ] || fail 'ChatGPT login is required. Run this command from an interactive Terminal.'
    say 'Sign in with your own ChatGPT account in the browser. No API key is needed.'
    env -u OPENAI_API_KEY -u CODEX_API_KEY "$codex_bin" login < /dev/tty
    login_status="$(env -u OPENAI_API_KEY -u CODEX_API_KEY "$codex_bin" login status 2>&1 || true)"
    printf '%s' "$login_status" | /usr/bin/grep -qi 'logged in using chatgpt' || fail 'ChatGPT authentication could not be confirmed. Existing credentials were not deleted.'
  fi
  unset login_status
  if [ -e "$source_dir" ]; then
    [ -d "$source_dir/.git" ] || fail 'The source path already exists and is not a normal Git checkout. Use --source with the correct checkout or a new directory.'
    local origin branch
    origin="$(git -C "$source_dir" remote get-url origin)"
    case "$origin" in https://github.com/10K-Digital/codexbot.git|https://github.com/10K-Digital/codexbot|git@github.com:10K-Digital/codexbot.git) ;; *) fail 'Existing checkout points to another repository; nothing was overwritten.' ;; esac
    [ -z "$(git -C "$source_dir" status --porcelain)" ] || fail 'Existing checkout has local changes. Commit/review them before updating; nothing was discarded.'
    branch="$(git -C "$source_dir" branch --show-current)"
    [ "$branch" = main ] || fail 'Existing checkout is not on main. Select a clean main checkout with --source.'
    git -C "$source_dir" fetch origin main
    # Reject local-only commits and divergence instead of installing unreviewed local code.
    git -C "$source_dir" merge-base --is-ancestor HEAD origin/main || fail 'Local main diverges from upstream. Review it manually.'
    git -C "$source_dir" merge --ff-only origin/main
  else
    mkdir -p "$(dirname "$source_dir")"
    git clone --branch main --single-branch https://github.com/10K-Digital/codexbot.git "$source_dir"
  fi
  cd "$source_dir"
  npm ci
  npm run setup
  npm test
  local args=(--bootstrap)
  [ "$no_open" -eq 0 ] || args+=(--no-open)
  [ "$local_voice" -eq 0 ] || args+=(--with-local-voice)
  node scripts/install-local.mjs "${args[@]}"
  mkdir -p "$(dirname "$registry")"
  printf '%s\n' "$source_dir" > "$registry"
  chmod 600 "$registry"
  say 'Done. Remote access is optional; see docs/remote-access.md. No public tunnel was enabled.'
}
main "$@"
