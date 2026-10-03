#!/usr/bin/env bash
# Launch Canopy in dev mode (used by the desktop launcher).
cd "$(dirname "$0")/.." || exit 1
if [ "$(uname)" = "Linux" ]; then
  exec npm run start:linux
else
  exec npm start
fi
