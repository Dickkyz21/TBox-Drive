import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

function withServerUrl(source: string, origin: string) {
  return source.replace(
    'DEFAULT_SERVER_URL = os.environ.get("TELEDRIVE_SERVER_URL", "").strip()',
    `DEFAULT_SERVER_URL = os.environ.get("TELEDRIVE_SERVER_URL", "${origin}").strip()`
  );
}

function attachment(body: string, filename: string, contentType: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function linuxSupportScript(origin: string) {
  return `#!/usr/bin/env bash
set -u

APP_DIR="$HOME/.local/share/teledrive"
APP_FILE="$APP_DIR/teledrive-desktop-client.py"
APP_URL="${origin}/api/desktop-client?platform=python"

info() {
  if command -v zenity >/dev/null 2>&1; then
    zenity --info --title="TeleDrive Driver Pendukung" --width=520 --text="$1"
  elif command -v kdialog >/dev/null 2>&1; then
    kdialog --msgbox "$1"
  elif command -v xmessage >/dev/null 2>&1; then
    xmessage -center "$1"
  else
    printf '%s\\n' "$1"
  fi
}

ask() {
  if command -v zenity >/dev/null 2>&1; then
    zenity --question --title="TeleDrive Driver Pendukung" --width=560 --text="$1"
  elif command -v kdialog >/dev/null 2>&1; then
    kdialog --yesno "$1"
  elif command -v xmessage >/dev/null 2>&1; then
    xmessage -center -buttons Yes:0,No:1 "$1"
  else
    printf '%s [y/N] ' "$1"
    read -r answer
    [ "$answer" = "y" ] || [ "$answer" = "Y" ]
  fi
}

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    pkexec env DEBIAN_FRONTEND=noninteractive apt-get update
    pkexec env DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-tk python3-venv curl
  elif command -v dnf >/dev/null 2>&1; then
    pkexec dnf install -y python3 python3-tkinter python3-virtualenv curl
  elif command -v pacman >/dev/null 2>&1; then
    pkexec pacman -Sy --needed python tk curl
  elif command -v zypper >/dev/null 2>&1; then
    pkexec zypper install -y python3 python3-tk python3-venv curl
  else
    info "Package manager tidak dikenali. Install manual: python3, tkinter/python3-tk, python3-venv, curl."
    return 1
  fi
}

download_client() {
  mkdir -p "$APP_DIR"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$APP_URL" -o "$APP_FILE"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$APP_URL" -O "$APP_FILE"
  else
    info "curl/wget belum tersedia. Jalankan installer driver pendukung terlebih dahulu."
    return 1
  fi
  chmod +x "$APP_FILE"
}

missing=""
command -v python3 >/dev/null 2>&1 || missing="$missing\\n- python3"
python3 - <<'PY' >/dev/null 2>&1 || missing="$missing\\n- tkinter / python3-tk"
import tkinter
PY
python3 -m venv --help >/dev/null 2>&1 || missing="$missing\\n- python3-venv"

if [ -n "$missing" ]; then
  if ask "TeleDrive butuh driver pendukung berikut:$missing\\n\\nUnduh dan install sekarang?"; then
    install_packages || exit 1
  else
    exit 0
  fi
fi

download_client || exit 1
info "Driver pendukung siap. TeleDrive Desktop tersimpan di:\\n$APP_FILE\\n\\nPython path: $(command -v python3)"
python3 "$APP_FILE" &
`;
}

function linuxDesktopLauncher(origin: string) {
  return `[Desktop Entry]
Type=Application
Name=TeleDrive Desktop
Comment=Jalankan TeleDrive Desktop Client tanpa terminal
Exec=sh -c 'APP_DIR="$HOME/.local/share/teledrive"; APP_FILE="$APP_DIR/teledrive-desktop-client.py"; mkdir -p "$APP_DIR"; if ! command -v python3 >/dev/null 2>&1 || ! python3 -c "import tkinter" >/dev/null 2>&1; then if command -v curl >/dev/null 2>&1; then curl -fsSL "${origin}/api/desktop-client?platform=linux-support" -o "$APP_DIR/teledrive-linux-support.sh"; elif command -v wget >/dev/null 2>&1; then wget -q "${origin}/api/desktop-client?platform=linux-support" -O "$APP_DIR/teledrive-linux-support.sh"; fi; chmod +x "$APP_DIR/teledrive-linux-support.sh"; "$APP_DIR/teledrive-linux-support.sh"; exit 0; fi; if [ ! -f "$APP_FILE" ]; then if command -v curl >/dev/null 2>&1; then curl -fsSL "${origin}/api/desktop-client?platform=python" -o "$APP_FILE"; elif command -v wget >/dev/null 2>&1; then wget -q "${origin}/api/desktop-client?platform=python" -O "$APP_FILE"; fi; chmod +x "$APP_FILE"; fi; python3 "$APP_FILE"'
Terminal=false
Categories=Utility;Network;
StartupNotify=true
`;
}

export async function GET(req: NextRequest) {
  const sourcePath = path.join(process.cwd(), 'sync-tool', 'desktop_client.py');
  const source = await readFile(sourcePath, 'utf-8');
  const origin = req.nextUrl.origin;
  const platform = req.nextUrl.searchParams.get('platform');
  const userAgent = req.headers.get('user-agent') ?? '';

  if (platform === 'linux-launcher') {
    return attachment(
      linuxDesktopLauncher(origin),
      'teledrive-desktop-linux.desktop',
      'application/x-desktop; charset=utf-8'
    );
  }

  if (platform === 'linux-support') {
    return attachment(
      linuxSupportScript(origin),
      'teledrive-linux-driver-support.sh',
      'text/x-shellscript; charset=utf-8'
    );
  }

  const filename = /windows/i.test(userAgent)
    ? 'teledrive-desktop-client.pyw'
    : 'teledrive-desktop-client.py';
  const patched = withServerUrl(source, origin);

  return attachment(patched, filename, 'text/x-python; charset=utf-8');
}
