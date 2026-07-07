#!/usr/bin/env bash
set -euo pipefail

if [ -z "${TELEDRIVE_SERVER_URL:-}" ]; then
  echo "TELEDRIVE_SERVER_URL belum diset. Contoh:"
  echo 'TELEDRIVE_SERVER_URL="https://nama-app.vercel.app" ./sync-tool/package-desktop.sh'
  exit 1
fi

python3 -m pip install --upgrade pyinstaller
pyinstaller \
  --onefile \
  --windowed \
  --name teledrive \
  --clean \
  sync-tool/desktop_client.py

echo "Build selesai: dist/teledrive"
