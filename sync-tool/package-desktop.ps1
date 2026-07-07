$ErrorActionPreference = "Stop"

if (-not $env:TELEDRIVE_SERVER_URL) {
  Write-Host "TELEDRIVE_SERVER_URL belum diset. Contoh:"
  Write-Host '$env:TELEDRIVE_SERVER_URL="https://nama-app.vercel.app"'
  exit 1
}

python -m pip install --upgrade pyinstaller
pyinstaller `
  --onefile `
  --windowed `
  --name TeleDrive `
  --clean `
  sync-tool\desktop_client.py

Write-Host "Build selesai: dist\TeleDrive.exe"
