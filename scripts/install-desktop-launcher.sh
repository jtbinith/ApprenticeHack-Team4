#!/usr/bin/env bash
# Linux only: add Canopy to the app menu and Desktop, pointing at this checkout.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
chmod +x "$ROOT/scripts/run-canopy.sh"
ENTRY="[Desktop Entry]
Type=Application
Name=Canopy
Comment=Apprentice journaling, OTJ hours and KSB evidence
Exec=$ROOT/scripts/run-canopy.sh
Icon=$ROOT/assets/icon.png
Terminal=false
Categories=Education;Office;
StartupNotify=true
StartupWMClass=Canopy"
mkdir -p "$HOME/.local/share/applications"
printf '%s\n' "$ENTRY" > "$HOME/.local/share/applications/canopy.desktop"
if [ -d "$HOME/Desktop" ]; then
  printf '%s\n' "$ENTRY" > "$HOME/Desktop/canopy.desktop"
  chmod +x "$HOME/Desktop/canopy.desktop"
  gio set "$HOME/Desktop/canopy.desktop" metadata::trusted true 2>/dev/null || true
  echo "Installed Canopy launcher → app menu and ~/Desktop"
else
  echo "Installed Canopy launcher → app menu"
fi
