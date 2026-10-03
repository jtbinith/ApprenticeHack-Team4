#!/usr/bin/env bash
# Launch Canopy in dev mode (used by the desktop launcher).
# Desktop launchers don't load your shell profile, so load nvm here — otherwise
# the system Node (often too old for Electron Forge) is used and the app fails silently.
cd "$(dirname "$0")/.." || exit 1

LOG="${XDG_CACHE_HOME:-$HOME/.cache}/canopy-launch.log"
mkdir -p "$(dirname "$LOG")"
exec >"$LOG" 2>&1

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "Using node $(node -v) from $(command -v node)"
if [ "$(uname)" = "Linux" ]; then
  exec npm run start:linux
else
  exec npm start
fi
