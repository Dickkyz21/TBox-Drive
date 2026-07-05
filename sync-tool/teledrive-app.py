#!/usr/bin/env python3
"""
TeleDrive Desktop App
Aplikasi sinkronisasi otomatis TeleDrive untuk pengguna awam.

Install:
  pip install requests watchdog pystray Pillow

Jalankan (double-click atau):
  python3 teledrive-app.py
"""

import json
import logging
import os
import platform
import subprocess
import sys
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

try:
    import requests
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    import pystray
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    # Coba install otomatis
    missing = str(e).split("'")[1] if "'" in str(e) else str(e)
    print(f"Menginstall dependency yang kurang: {missing}")
    subprocess.run([sys.executable, "-m", "pip", "install",
                    "requests", "watchdog", "pystray", "Pillow"], check=True)
    import requests
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    import pystray
    from PIL import Image, ImageDraw

# ─── Konfigurasi ──────────────────────────────────────────────────────────────

CONFIG_DIR  = Path.home() / ".teledrive"
CONFIG_FILE = CONFIG_DIR / "config.json"
STATE_FILE  = CONFIG_DIR / "state.json"
LOG_FILE    = CONFIG_DIR / "sync.log"

DEFAULT_CONFIG = {
    "url":        "",
    "api_key":    "",
    "client_id":  "",
    "folder":     str(Path.home() / "TeleDrive"),
    "interval":   30,
    "autostart":  False,
}

def load_config() -> dict:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        try:
            cfg = json.loads(CONFIG_FILE.read_text())
            return {**DEFAULT_CONFIG, **cfg}
        except:
            pass
    return dict(DEFAULT_CONFIG)

def save_config(cfg: dict):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2))


# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger("teledrive")


# ─── Auto-start ───────────────────────────────────────────────────────────────

APP_NAME   = "TeleDrive"
APP_SCRIPT = str(Path(__file__).resolve())

def enable_autostart():
    system = platform.system()
    if system == "Windows":
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0, winreg.KEY_SET_VALUE
            )
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ,
                f'"{sys.executable}" "{APP_SCRIPT}"')
            winreg.CloseKey(key)
            return True
        except Exception as e:
            log.error(f"Gagal set autostart Windows: {e}"); return False

    elif system == "Linux":
        autostart_dir = Path.home() / ".config" / "autostart"
        autostart_dir.mkdir(parents=True, exist_ok=True)
        desktop = autostart_dir / "teledrive.desktop"
        desktop.write_text(f"""[Desktop Entry]
Type=Application
Name=TeleDrive Sync
Exec={sys.executable} {APP_SCRIPT}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
""")
        return True

    elif system == "Darwin":  # macOS
        plist_dir  = Path.home() / "Library" / "LaunchAgents"
        plist_dir.mkdir(parents=True, exist_ok=True)
        plist = plist_dir / "com.teledrive.sync.plist"
        plist.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.teledrive.sync</string>
  <key>ProgramArguments</key>
  <array><string>{sys.executable}</string><string>{APP_SCRIPT}</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>""")
        subprocess.run(["launchctl", "load", str(plist)], capture_output=True)
        return True
    return False

def disable_autostart():
    system = platform.system()
    if system == "Windows":
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0, winreg.KEY_SET_VALUE
            )
            try: winreg.DeleteValue(key, APP_NAME)
            except: pass
            winreg.CloseKey(key)
        except: pass
    elif system == "Linux":
        p = Path.home() / ".config" / "autostart" / "teledrive.desktop"
        p.unlink(missing_ok=True)
    elif system == "Darwin":
        plist = Path.home() / "Library" / "LaunchAgents" / "com.teledrive.sync.plist"
        if plist.exists():
            subprocess.run(["launchctl", "unload", str(plist)], capture_output=True)
            plist.unlink(missing_ok=True)


# ─── State tracker ────────────────────────────────────────────────────────────

class StateTracker:
    def __init__(self):
        self._data: dict[str, int] = {}
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if STATE_FILE.exists():
            try: self._data = json.loads(STATE_FILE.read_text())
            except: self._data = {}

    def _save(self):
        STATE_FILE.write_text(json.dumps(self._data, indent=2))

    def add(self, name: str, mid: int):
        with self._lock: self._data[name] = mid; self._save()

    def remove(self, name: str):
        with self._lock: self._data.pop(name, None); self._save()

    def get(self, name: str):
        with self._lock: return self._data.get(name)

    def all(self):
        with self._lock: return dict(self._data)


# ─── API ──────────────────────────────────────────────────────────────────────

class API:
    def __init__(self, url: str, key: str):
        self.url     = url.rstrip("/")
        self.headers = {"X-API-Key": key}

    def list_files(self):
        r = requests.get(f"{self.url}/api/files", headers=self.headers, timeout=20)
        r.raise_for_status(); return r.json()["files"]

    def upload(self, path: Path):
        with open(path, "rb") as f:
            r = requests.post(f"{self.url}/api/upload", headers=self.headers,
                files={"file": (path.name, f)}, data={"filename": path.name}, timeout=300)
        r.raise_for_status(); return r.json()["file"]

    def download(self, mid: int, dest: Path):
        r = requests.get(f"{self.url}/api/file/{mid}/download",
            headers=self.headers, stream=True, timeout=300)
        r.raise_for_status()
        tmp = dest.with_suffix(dest.suffix + ".tdtmp")
        try:
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(64*1024): f.write(chunk)
            tmp.rename(dest)
        except: tmp.unlink(missing_ok=True); raise

    def delete(self, mid: int):
        r = requests.post(f"{self.url}/api/file/{mid}/delete",
            headers=self.headers, timeout=20)
        r.raise_for_status()

    def heartbeat(self, client_id: str):
        if not client_id: return
        requests.post(f"{self.url}/api/clients/{client_id}/heartbeat",
            headers=self.headers, timeout=10)


# ─── Sync engine ──────────────────────────────────────────────────────────────

class SyncEngine:
    """Engine sinkronisasi — bisa di-start dan di-stop kapan saja."""

    def __init__(self, cfg: dict, on_status_change=None):
        self.cfg               = cfg
        self.on_status_change  = on_status_change or (lambda s, m: None)
        self._stop_event       = threading.Event()
        self._observer         = None
        self._threads          = []
        self._busy: set[str]   = set()
        self._lock             = threading.Lock()
        self.state             = StateTracker()
        self.last_sync         = None
        self.is_running        = False

    def _api(self):
        return API(self.cfg["url"], self.cfg["api_key"])

    def _set_status(self, status: str, msg: str = ""):
        self.on_status_change(status, msg)

    def _busy_check(self, name):
        with self._lock: return name in self._busy

    def _busy_set(self, name, v):
        with self._lock:
            if v: self._busy.add(name)
            else: self._busy.discard(name)

    def _wait_stable(self, path: Path) -> bool:
        prev = -1
        for _ in range(20):
            time.sleep(0.5)
            try: cur = path.stat().st_size
            except FileNotFoundError: return False
            if cur == prev: return True
            prev = cur
        return True

    def upload_file(self, path: Path):
        name = path.name
        if name.endswith(".tdtmp") or self._busy_check(name): return
        self._busy_set(name, True)
        try:
            if not self._wait_stable(path) or not path.exists(): return
            self._set_status("syncing", f"Upload: {name}")
            result = self._api().upload(path)
            self.state.add(name, result["messageId"])
            self.last_sync = time.strftime("%H:%M:%S")
            self._set_status("online", f"✅ Upload: {name}")
            log.info(f"✅ Upload: {name}")
        except Exception as e:
            self._set_status("online", f"❌ Gagal upload: {name}")
            log.error(f"Gagal upload {name}: {e}")
        finally: self._busy_set(name, False)

    def delete_remote(self, name: str):
        if name.endswith(".tdtmp"): return
        mid = self.state.get(name)
        if mid is None: return
        try:
            self._api().delete(mid)
            self.state.remove(name)
            log.info(f"🗑  Hapus di cloud: {name}")
        except Exception as e:
            log.error(f"Gagal hapus {name}: {e}")

    def rename_remote(self, old_name: str, new_path: Path):
        if old_name.endswith(".tdtmp") or new_path.name.endswith(".tdtmp"): return
        mid = self.state.get(old_name)
        if mid:
            try: self._api().delete(mid); self.state.remove(old_name)
            except Exception as e: log.error(f"Gagal hapus lama saat rename: {e}")
        self.upload_file(new_path)

    def _sync_from_remote(self):
        try:
            api    = self._api()
            remote = api.list_files()
            self._set_status("online")
        except Exception as e:
            self._set_status("offline", "Tidak ada koneksi internet")
            log.warning(f"Offline: {e}"); return

        remote_by_id = {f["messageId"]: f for f in remote}

        for rf in remote:
            if self._stop_event.is_set(): return
            name = rf["name"]
            if self._busy_check(name): continue
            dest = Path(self.cfg["folder"]) / name
            if dest.exists():
                try:
                    if dest.stat().st_size == rf["size"]:
                        self.state.add(name, rf["messageId"]); continue
                except FileNotFoundError: pass
            self._busy_set(name, True)
            try:
                self._set_status("syncing", f"Download: {name}")
                api.download(rf["messageId"], dest)
                self.state.add(name, rf["messageId"])
                self.last_sync = time.strftime("%H:%M:%S")
                log.info(f"⬇  Download: {name}")
            except Exception as e: log.error(f"Gagal download {name}: {e}")
            finally: self._busy_set(name, False)

        for name, mid in list(self.state.all().items()):
            if mid not in remote_by_id:
                local = Path(self.cfg["folder"]) / name
                if local.exists():
                    try: local.unlink(); log.info(f"🗑  Hapus lokal: {name}")
                    except Exception as e: log.error(f"Gagal hapus lokal {name}: {e}")
                self.state.remove(name)

        try: api.heartbeat(self.cfg.get("client_id", ""))
        except: pass

    def _poll_loop(self):
        while not self._stop_event.is_set():
            self._sync_from_remote()
            self._stop_event.wait(self.cfg.get("interval", 30))

    def start(self):
        if self.is_running: return
        folder = Path(self.cfg["folder"])
        folder.mkdir(parents=True, exist_ok=True)
        self._stop_event.clear()
        self.is_running = True
        self._set_status("syncing", "Memulai sync...")

        # Sync awal
        t = threading.Thread(target=self._sync_from_remote, daemon=True)
        t.start(); self._threads.append(t)

        # Poll loop
        t = threading.Thread(target=self._poll_loop, daemon=True)
        t.start(); self._threads.append(t)

        # Watchdog
        handler       = ChangeHandler(self)
        self._observer = Observer()
        self._observer.schedule(handler, str(folder), recursive=False)
        self._observer.start()
        log.info(f"🟢 Sync dimulai — folder: {folder}")

    def stop(self):
        if not self.is_running: return
        self._stop_event.set()
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=3)
        self.is_running = False
        self._set_status("stopped", "Sync dihentikan")
        log.info("🔴 Sync dihentikan")


class ChangeHandler(FileSystemEventHandler):
    def __init__(self, engine: SyncEngine):
        self.engine = engine

    def _run(self, fn, *args):
        threading.Thread(target=fn, args=args, daemon=True).start()

    def on_created(self, e):
        if not e.is_directory: self._run(self.engine.upload_file, Path(e.src_path))

    def on_deleted(self, e):
        if not e.is_directory: self._run(self.engine.delete_remote, Path(e.src_path).name)

    def on_moved(self, e):
        if not e.is_directory:
            self._run(self.engine.rename_remote, Path(e.src_path).name, Path(e.dest_path))


# ─── Ikon tray ────────────────────────────────────────────────────────────────

def make_icon(color: str) -> Image.Image:
    size = 64
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Lingkaran luar
    draw.ellipse([2, 2, size-2, size-2], fill=color)
    # Huruf T di tengah
    draw.rectangle([24, 14, 40, 20], fill="white")  # batang atas
    draw.rectangle([29, 14, 35, 50], fill="white")  # batang tengah
    return img

ICON_COLORS = {
    "online":  "#34D399",  # hijau
    "syncing": "#2AABEE",  # biru
    "offline": "#F59E0B",  # kuning
    "stopped": "#8A93A1",  # abu
    "error":   "#F87171",  # merah
}


# ─── Setup wizard ─────────────────────────────────────────────────────────────

class SetupWizard:
    """Dialog setup pertama kali / ubah pengaturan."""

    def __init__(self, cfg: dict, on_save=None):
        self.cfg     = dict(cfg)
        self.on_save = on_save
        self.root    = None

    def show(self):
        self.root = tk.Tk()
        self.root.title("TeleDrive — Pengaturan")
        self.root.resizable(False, False)
        self.root.configure(bg="#0E1117")

        # Tengahkan window
        self.root.update_idletasks()
        w, h = 480, 420
        x = (self.root.winfo_screenwidth()  - w) // 2
        y = (self.root.winfo_screenheight() - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")

        style = ttk.Style()
        style.theme_use("clam")

        pad = {"padx": 20, "pady": 6}

        # Judul
        tk.Label(self.root, text="⚙  Pengaturan TeleDrive",
                 bg="#0E1117", fg="#2AABEE",
                 font=("Segoe UI", 14, "bold")).pack(pady=(20, 4))
        tk.Label(self.root, text="Isi data berikut untuk menghubungkan ke cloud TeleDrive kamu.",
                 bg="#0E1117", fg="#8A93A1",
                 font=("Segoe UI", 9), wraplength=440).pack()

        frame = tk.Frame(self.root, bg="#0E1117")
        frame.pack(fill="both", expand=True, padx=20, pady=10)

        def lbl(text):
            tk.Label(frame, text=text, bg="#0E1117", fg="#C7CED6",
                     font=("Segoe UI", 9), anchor="w").pack(fill="x", pady=(8, 2))

        def entry_var(default=""):
            var = tk.StringVar(value=default)
            e = tk.Entry(frame, textvariable=var, bg="#151A23", fg="#F3F5F7",
                         insertbackground="white", relief="flat",
                         font=("Segoe UI", 10), bd=0, highlightthickness=1,
                         highlightbackground="#2B3544", highlightcolor="#2AABEE")
            e.pack(fill="x", ipady=6)
            return var

        lbl("URL TeleDrive (cth: https://nama-app.vercel.app)")
        self.var_url = entry_var(self.cfg.get("url", ""))

        lbl("Password (APP_PASSWORD yang diset di Vercel)")
        self.var_key = entry_var(self.cfg.get("api_key", ""))
        # Sembunyikan password
        for w in frame.winfo_children():
            if isinstance(w, tk.Entry) and w.get() == self.cfg.get("api_key", ""):
                w.config(show="•"); break

        lbl("Client ID (kosongkan jika belum tahu)")
        self.var_cid = entry_var(self.cfg.get("client_id", ""))

        lbl("Folder sinkron")
        folder_frame = tk.Frame(frame, bg="#0E1117")
        folder_frame.pack(fill="x")
        self.var_folder = tk.StringVar(value=self.cfg.get("folder", str(Path.home() / "TeleDrive")))
        tk.Entry(folder_frame, textvariable=self.var_folder,
                 bg="#151A23", fg="#F3F5F7", insertbackground="white",
                 relief="flat", font=("Segoe UI", 10), bd=0,
                 highlightthickness=1, highlightbackground="#2B3544",
                 highlightcolor="#2AABEE").pack(side="left", fill="x", expand=True, ipady=6)
        tk.Button(folder_frame, text="Pilih...", command=self._browse,
                  bg="#2B3544", fg="#F3F5F7", relief="flat",
                  font=("Segoe UI", 9), padx=8).pack(side="left", padx=(6, 0))

        self.var_auto = tk.BooleanVar(value=self.cfg.get("autostart", False))
        tk.Checkbutton(frame, text="Jalankan otomatis saat PC menyala",
                       variable=self.var_auto, bg="#0E1117", fg="#C7CED6",
                       selectcolor="#151A23", activebackground="#0E1117",
                       font=("Segoe UI", 9)).pack(anchor="w", pady=(12, 0))

        # Tombol simpan
        tk.Button(self.root, text="💾  Simpan & Mulai",
                  command=self._save, bg="#2AABEE", fg="white",
                  relief="flat", font=("Segoe UI", 11, "bold"),
                  padx=20, pady=10, cursor="hand2").pack(pady=16)

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.mainloop()

    def _browse(self):
        folder = filedialog.askdirectory(title="Pilih folder sinkron",
                                         initialdir=self.var_folder.get())
        if folder: self.var_folder.set(folder)

    def _save(self):
        url = self.var_url.get().strip()
        key = self.var_key.get().strip()
        if not url or not key:
            messagebox.showerror("Error", "URL dan Password wajib diisi!",
                                 parent=self.root); return
        self.cfg.update({
            "url":       url,
            "api_key":   key,
            "client_id": self.var_cid.get().strip(),
            "folder":    self.var_folder.get().strip(),
            "autostart": self.var_auto.get(),
        })
        save_config(self.cfg)
        # Atur autostart
        if self.cfg["autostart"]: enable_autostart()
        else: disable_autostart()

        if self.on_save: self.on_save(self.cfg)
        self.root.destroy()

    def _on_close(self):
        if not self.cfg.get("url"):
            if messagebox.askyesno("Keluar?",
                "Belum ada konfigurasi. Keluar dari aplikasi?", parent=self.root):
                self.root.destroy(); sys.exit(0)
        else:
            self.root.destroy()


# ─── Tray application ─────────────────────────────────────────────────────────

class TrayApp:
    def __init__(self):
        self.cfg    = load_config()
        self.engine = None
        self.icon   = None
        self.status = "stopped"
        self.status_msg = ""

    def _on_status_change(self, status: str, msg: str = ""):
        self.status     = status
        self.status_msg = msg
        color = ICON_COLORS.get(status, "#8A93A1")
        if self.icon:
            self.icon.icon = make_icon(color)
            last = f" | Terakhir sync: {self.engine.last_sync}" \
                   if self.engine and self.engine.last_sync else ""
            self.icon.title = f"TeleDrive — {status.capitalize()}{last}"

    def _start_sync(self):
        if not self.cfg.get("url") or not self.cfg.get("api_key"):
            self._open_settings(); return
        if self.engine and self.engine.is_running: return
        self.engine = SyncEngine(self.cfg, self._on_status_change)
        self.engine.start()
        self._rebuild_menu()

    def _stop_sync(self):
        if self.engine: self.engine.stop()
        self._rebuild_menu()

    def _toggle_sync(self, icon, item):
        if self.engine and self.engine.is_running: self._stop_sync()
        else: self._start_sync()

    def _open_folder(self, icon=None, item=None):
        folder = Path(self.cfg.get("folder", Path.home() / "TeleDrive"))
        folder.mkdir(parents=True, exist_ok=True)
        system = platform.system()
        if system == "Windows":   os.startfile(str(folder))
        elif system == "Darwin":  subprocess.run(["open", str(folder)])
        else:                     subprocess.run(["xdg-open", str(folder)])

    def _open_web(self, icon=None, item=None):
        url = self.cfg.get("url", "")
        if url:
            import webbrowser; webbrowser.open(url)

    def _open_settings(self, icon=None, item=None):
        was_running = self.engine and self.engine.is_running
        if was_running: self._stop_sync()

        def on_save(new_cfg):
            self.cfg = new_cfg
            if was_running: self._start_sync()

        t = threading.Thread(
            target=lambda: SetupWizard(self.cfg, on_save).show(),
            daemon=True)
        t.start()

    def _open_log(self, icon=None, item=None):
        system = platform.system()
        if system == "Windows":  os.startfile(str(LOG_FILE))
        elif system == "Darwin": subprocess.run(["open", str(LOG_FILE)])
        else:                    subprocess.run(["xdg-open", str(LOG_FILE)])

    def _quit(self, icon, item):
        if self.engine: self.engine.stop()
        icon.stop()

    def _rebuild_menu(self):
        if not self.icon: return
        running = self.engine and self.engine.is_running
        self.icon.menu = pystray.Menu(
            pystray.MenuItem(
                "⏸ Hentikan Sinkronisasi" if running else "▶ Mulai Sinkronisasi",
                self._toggle_sync, default=True
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("📁 Buka Folder TeleDrive", self._open_folder),
            pystray.MenuItem("🌐 Buka Web TeleDrive",    self._open_web),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("⚙  Pengaturan",            self._open_settings),
            pystray.MenuItem("📋 Lihat Log",              self._open_log),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("❌ Keluar",                  self._quit),
        )

    def run(self):
        # Tampilkan setup wizard jika belum dikonfigurasi
        if not self.cfg.get("url") or not self.cfg.get("api_key"):
            log.info("Konfigurasi belum ada, tampilkan wizard...")
            wizard_done = threading.Event()
            def on_save(new_cfg):
                self.cfg = new_cfg
                wizard_done.set()
            SetupWizard(self.cfg, on_save).show()
            if not self.cfg.get("url"): return  # user tutup tanpa save

        # Buat tray icon
        self.icon = pystray.Icon(
            "teledrive",
            make_icon(ICON_COLORS["stopped"]),
            "TeleDrive — Stopped",
        )
        self._rebuild_menu()

        # Auto-start sync saat app dibuka
        threading.Thread(target=self._start_sync, daemon=True).start()

        log.info("TeleDrive App berjalan di system tray")
        self.icon.run()


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = TrayApp()
    app.run()
