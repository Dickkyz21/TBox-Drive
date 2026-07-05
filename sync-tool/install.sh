#!/bin/bash
# TeleDrive Desktop App — Installer
# Jalankan sekali: bash install.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TeleDrive Desktop App — Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cek Python
if ! command -v python3 &>/dev/null; then
    echo "❌ Python3 tidak ditemukan. Install dulu:"
    echo "   sudo apt install python3 python3-pip    # Ubuntu/Debian"
    echo "   sudo dnf install python3 python3-pip    # Fedora"
    exit 1
fi
echo "✅ Python3 ditemukan: $(python3 --version)"

# Install dependencies
echo ""
echo "📦 Menginstall dependencies..."
pip3 install --quiet requests watchdog pystray Pillow
echo "✅ Dependencies terinstall"

# Buat shortcut desktop (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    DESKTOP_FILE="$HOME/Desktop/TeleDrive.desktop"
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Type=Application
Name=TeleDrive
Comment=Sinkronisasi file otomatis dengan Telegram
Exec=python3 $SCRIPT_DIR/teledrive-app.py
Icon=network-workgroup
Terminal=false
Categories=Network;FileTransfer;
EOF
    chmod +x "$DESKTOP_FILE"
    echo "✅ Shortcut dibuat di Desktop"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Instalasi selesai!"
echo ""
echo "Jalankan aplikasi:"
echo "  python3 teledrive-app.py"
echo ""
echo "Atau klik shortcut 'TeleDrive' di Desktop."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
