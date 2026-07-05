#!/usr/bin/env python3
"""
TeleDrive Desktop — aplikasi system tray untuk sinkronisasi otomatis.

Install:
    pip install requests watchdog pystray Pillow

Jalankan:
    python tray_app.py

Untuk build menjadi .exe (Windows) atau binary (Linux):
    pip install pyinstaller
    pyinstaller --onefile --windowed --name TeleDrive tray_app.py
"""

import json
import logging
import os
import platform
import queue
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from io import BytesIO
from pathlib import Path

# ── Cek dependencies ──────────────────────────────────────────────────────────
MISSING = []
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    MISSING.append("Pillow")
try:
    import pystray
except ImportError:
    MISSING.append("pystray")
try:
    import requests
except ImportError:
    MISSING.append("requests")
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    MISSING.append("watchdog")

if MISSING:
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk(); root.withdraw()
        messagebox.showerror("TeleDrive",
            f"Dependency belum terinstall:\n\n"
            f"pip install {' '.join(MISSING)}\n\n"
            "Jalankan perintah di atas, lalu buka ulang TeleDrive.")
        root.destroy()
    except Exception:
        print(f"Install dulu: pip install {' '.join(MISSING)}")
    sys.exit(1)

import tkinter as tk
from tkinter import ttk, messagebox, filedialog


# ── Config ────────────────────────────────────────────────────────────────────

def config_dir() -> Path:
    if platform.system() == "Windows":
        d = Path(os.environ.get("APPDATA", "~")).expanduser() / "TeleDrive"
    else:
        d = Path("~/.config/teledrive").expanduser()
    d.mkdir(parents=True, exist_ok=True)
    return d

CONFIG_FILE = config_dir() / "config.json"
QUEUE_FILE  = config_dir() / "queue.json"
LOG_FILE    = config_dir() / "teledrive.log"

DEFAULT_CONFIG = {
    "url":       "",
    "api_key":   "",
    "client_id": "",
    "folder":    str(Path("~/TeleDrive").expanduser()),
    "interval":  30,
    "autostart": True,
}

def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            data = json.loads(CONFIG_FILE.read_text())
            return {**DEFAULT_CONFIG, **data}
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)

def save_config(cfg: dict):
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2))


# ── Logging ───────────────────────────────────────────────────────────────────

def setup_logging():
    fmt = logging.Formatter("%(asctime)s  %(levelname)-7s  %(message)s",
                            datefmt="%H:%M:%S")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not root.handlers:
        fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
        fh.setFormatter(fmt)
        root.addHandler(fh)
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(fmt)
        root.addHandler(sh)

log = logging.getLogger("teledrive")


# ── Offline Queue ─────────────────────────────────────────────────────────────

class OfflineQueue:
    """File yang gagal/belum terupload karena offline, disimpan ke disk."""
    def __init__(self):
        self._lock  = threading.Lock()
        self._items: list[dict] = []
        self._load()

    def _load(self):
        if QUEUE_FILE.exists():
            try: self._items = json.loads(QUEUE_FILE.read_text())
            except: self._items = []

    def _save(self):
        QUEUE_FILE.write_text(json.dumps(self._items, indent=2))

    def push(self, path: str, name: str):
        with self._lock:
            if not any(i["path"] == path for i in self._items):
                self._items.append({"path": path, "name": name,
                                    "queued_at": datetime.now().isoformat()})
                self._save()

    def pop_all(self) -> list[dict]:
        with self._lock:
            items = list(self._items)
            self._items.clear()
            self._save()
            return items

    def size(self) -> int:
        with self._lock: return len(self._items)


# ── API ───────────────────────────────────────────────────────────────────────

class TeleDriveAPI:
    def __init__(self, cfg: dict):
        self.base    = cfg["url"].rstrip("/")
        self.headers = {"X-API-Key": cfg["api_key"]}
        self.cid     = cfg.get("client_id", "")

    def ping(self) -> bool:
        try:
            r = requests.get(f"{self.base}/api/files",
                             headers=self.headers, timeout=10)
            return r.ok
        except Exception: return False

    def list_files(self) -> list[dict]:
        r = requests.get(f"{self.base}/api/files",
                         headers=self.headers, timeout=30)
        r.raise_for_status(); return r.json()["files"]

    def upload(self, path: Path) -> dict:
        with open(path, "rb") as f:
            r = requests.post(f"{self.base}/api/upload",
                headers=self.headers,
                files={"file": (path.name, f)},
                data={"filename": path.name}, timeout=300)
        r.raise_for_status(); return r.json()["file"]

    def download(self, mid: int, dest: Path):
        r = requests.get(f"{self.base}/api/file/{mid}/download",
            headers=self.headers, stream=True, timeout=300)
        r.raise_for_status()
        tmp = dest.with_suffix(dest.suffix + ".tdtmp")
        try:
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(64*1024): f.write(chunk)
            tmp.rename(dest)
        except: tmp.unlink(missing_ok=True); raise

    def delete(self, mid: int):
        requests.post(f"{self.base}/api/file/{mid}/delete",
                      headers=self.headers, timeout=30).raise_for_status()

    def heartbeat(self):
        if self.cid:
            try:
                requests.post(f"{self.base}/api/clients/{self.cid}/heartbeat",
                              headers=self.headers, timeout=10)
            except Exception: pass


# ── Syncer ────────────────────────────────────────────────────────────────────

STATE_FILE_NAME = ".teledrive-state.json"

class Syncer:
    def __init__(self, cfg: dict, q: OfflineQueue, on_status):
        self.cfg       = cfg
        self.folder    = Path(cfg["folder"]).expanduser().resolve()
        self.api       = TeleDriveAPI(cfg)
        self.queue     = q
        self.on_status = on_status  # callback(text, is_error)
        self._state: dict[str, int] = {}
        self._busy: set[str] = set()
        self._lock  = threading.Lock()
        self._online = False
        self._load_state()

    def _state_path(self): return self.folder / STATE_FILE_NAME

    def _load_state(self):
        p = self._state_path()
        if p.exists():
            try: self._state = json.loads(p.read_text())
            except: self._state = {}

    def _save_state(self):
        self._state_path().write_text(json.dumps(self._state, indent=2))

    def is_online(self) -> bool: return self._online

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
        if name.endswith(".tdtmp") or name == STATE_FILE_NAME: return
        with self._lock:
            if name in self._busy: return
            self._busy.add(name)
        try:
            if not self._wait_stable(path) or not path.exists(): return
            if not self._online:
                self.queue.push(str(path), name)
                log.info(f"📥 Antrian (offline): {name}")
                self.on_status(f"Offline — {name} masuk antrian", False)
                return
            sz = path.stat().st_size
            log.info(f"⬆  Upload {name} ({_human(sz)})")
            self.on_status(f"Mengupload {name}...", False)
            result = self.api.upload(path)
            self._state[name] = result["messageId"]
            self._save_state()
            log.info(f"✅ Upload selesai: {name}")
            self.on_status(f"✅ {name} tersimpan", False)
        except Exception as e:
            log.error(f"❌ Gagal upload {name}: {e}")
            self.queue.push(str(path), name)
        finally:
            with self._lock: self._busy.discard(name)

    def delete_remote(self, name: str):
        if name.endswith(".tdtmp") or name == STATE_FILE_NAME: return
        mid = self._state.get(name)
        if mid is None: return
        try:
            self.api.delete(mid)
            del self._state[name]
            self._save_state()
            log.info(f"🗑  Terhapus di cloud: {name}")
            self.on_status(f"🗑 {name} dihapus dari cloud", False)
        except Exception as e:
            log.error(f"❌ Gagal hapus {name}: {e}")

    def rename_remote(self, old: str, new_path: Path):
        if old.endswith(".tdtmp") or old == STATE_FILE_NAME: return
        mid = self._state.pop(old, None)
        if mid is not None:
            try: self.api.delete(mid)
            except Exception: pass
            self._save_state()
        self.upload_file(new_path)

    def process_queue(self):
        items = self.queue.pop_all()
        if not items: return
        log.info(f"🔄 Memproses {len(items)} file dari antrian offline...")
        self.on_status(f"Memproses {len(items)} file antrian...", False)
        for item in items:
            path = Path(item["path"])
            if path.exists(): self.upload_file(path)

    def sync_remote(self):
        try:
            remote = self.api.list_files()
            self._online = True
        except Exception as e:
            self._online = False
            log.warning(f"⚠  Offline: {e}"); return

        remote_by_id = {f["messageId"]: f for f in remote}

        # Download file baru
        for rf in remote:
            name = rf["name"]
            with self._lock:
                if name in self._busy: continue
            dest = self.folder / name
            if dest.exists():
                try:
                    if dest.stat().st_size == rf["size"]:
                        self._state[name] = rf["messageId"]; continue
                except FileNotFoundError: pass
            with self._lock: self._busy.add(name)
            try:
                log.info(f"⬇  Download {name} ({_human(rf['size'])})")
                self.on_status(f"Mengunduh {name}...", False)
                self.api.download(rf["messageId"], dest)
                self._state[name] = rf["messageId"]
                self._save_state()
                log.info(f"✅ Download selesai: {name}")
                self.on_status(f"✅ {name} diunduh", False)
            except Exception as e: log.error(f"❌ Gagal download {name}: {e}")
            finally:
                with self._lock: self._busy.discard(name)

        # Hapus lokal yang sudah tidak ada di cloud
        for name, mid in list(self._state.items()):
            if mid not in remote_by_id:
                local = self.folder / name
                if local.exists():
                    try: local.unlink(); log.info(f"🗑  Hapus lokal: {name}")
                    except Exception as e: log.error(f"❌ Gagal hapus lokal {name}: {e}")
                del self._state[name]
                self._save_state()

        self.process_queue()
        self.api.heartbeat()

    def poll_loop(self, stop_event: threading.Event):
        while not stop_event.is_set():
            self.sync_remote()
            stop_event.wait(self.cfg["interval"])


class WatchHandler(FileSystemEventHandler):
    def __init__(self, syncer: Syncer):
        self.syncer = syncer

    def _bg(self, fn, *a):
        threading.Thread(target=fn, args=a, daemon=True).start()

    def on_created(self, e):
        if not e.is_directory: self._bg(self.syncer.upload_file, Path(e.src_path))

    def on_deleted(self, e):
        if not e.is_directory: self._bg(self.syncer.delete_remote, Path(e.src_path).name)

    def on_moved(self, e):
        if not e.is_directory:
            self._bg(self.syncer.rename_remote, Path(e.src_path).name, Path(e.dest_path))


def _human(b: int) -> str:
    for u in ["B","KB","MB","GB"]:
        if b < 1024: return f"{b:.0f} {u}" if u=="B" else f"{b:.1f} {u}"
        b /= 1024
    return f"{b:.1f} GB"


# ── Auto-start ────────────────────────────────────────────────────────────────

def set_autostart(enable: bool):
    exe = sys.executable if getattr(sys, 'frozen', False) else \
          f'"{sys.executable}" "{os.path.abspath(__file__)}"'
    if platform.system() == "Windows":
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run", 0,
                winreg.KEY_SET_VALUE)
            if enable:
                winreg.SetValueEx(key, "TeleDrive", 0, winreg.REG_SZ, exe)
            else:
                try: winreg.DeleteValue(key, "TeleDrive")
                except FileNotFoundError: pass
            winreg.CloseKey(key)
        except Exception as e: log.warning(f"Autostart Windows gagal: {e}")
    else:
        desktop_dir = Path("~/.config/autostart").expanduser()
        desktop_dir.mkdir(parents=True, exist_ok=True)
        desktop = desktop_dir / "teledrive.desktop"
        if enable:
            desktop.write_text(
                f"[Desktop Entry]\nType=Application\nName=TeleDrive\n"
                f"Exec={exe}\nHidden=false\nNoDisplay=false\n"
                f"X-GNOME-Autostart-enabled=true\n")
        else:
            desktop.unlink(missing_ok=True)


# ── Icon Generator ────────────────────────────────────────────────────────────

def make_icon(color: str) -> Image.Image:
    size = 64
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d    = ImageDraw.Draw(img)
    # Lingkaran background
    d.ellipse([4, 4, size-4, size-4], fill=color)
    # Ikon Telegram sederhana (pesawat kertas)
    d.polygon([(16,32),(48,16),(38,48),(30,36)], fill="white")
    return img

ICON_GREEN  = lambda: make_icon("#34D399")  # Online & syncing
ICON_RED    = lambda: make_icon("#F87171")  # Stopped
ICON_YELLOW = lambda: make_icon("#F59E0B")  # Offline / connecting


# ── Setup Wizard (GUI tkinter) ────────────────────────────────────────────────

class SetupWizard:
    def __init__(self, cfg: dict):
        self.cfg    = dict(cfg)
        self.result = None

        self.root = tk.Tk()
        self.root.title("TeleDrive — Setup")
        self.root.geometry("480x420")
        self.root.resizable(False, False)
        self.root.configure(bg="#0E1117")

        self._build()
        self.root.mainloop()

    def _label(self, parent, text, small=False):
        fg   = "#8A93A1" if small else "#C7CED6"
        size = 9 if small else 11
        tk.Label(parent, text=text, bg="#0E1117", fg=fg,
                 font=("Segoe UI", size)).pack(anchor="w", pady=(8,2))

    def _entry(self, parent, var, show=None):
        e = tk.Entry(parent, textvariable=var, bg="#151A23", fg="#F3F5F7",
                     insertbackground="white", relief="flat",
                     font=("Consolas", 10), show=show or "")
        e.pack(fill="x", ipady=6, pady=(0,4))
        return e

    def _build(self):
        frame = tk.Frame(self.root, bg="#0E1117", padx=24, pady=16)
        frame.pack(fill="both", expand=True)

        # Header
        tk.Label(frame, text="⚡ TeleDrive Desktop",
                 bg="#0E1117", fg="#2AABEE",
                 font=("Segoe UI", 16, "bold")).pack(pady=(0, 4))
        tk.Label(frame, text="Isi data di bawah — bisa dilihat di halaman Perangkat di web",
                 bg="#0E1117", fg="#8A93A1",
                 font=("Segoe UI", 9)).pack(pady=(0, 12))

        self.v_url    = tk.StringVar(value=self.cfg.get("url",""))
        self.v_key    = tk.StringVar(value=self.cfg.get("api_key",""))
        self.v_cid    = tk.StringVar(value=self.cfg.get("client_id",""))
        self.v_folder = tk.StringVar(value=self.cfg.get("folder",""))
        self.v_auto   = tk.BooleanVar(value=self.cfg.get("autostart", True))

        self._label(frame, "URL TeleDrive (cth: https://nama-app.vercel.app)")
        self._entry(frame, self.v_url)

        self._label(frame, "API Key Perangkat (dari halaman Perangkat)")
        self._entry(frame, self.v_key, show="•")

        self._label(frame, "Client ID (opsional — untuk status Online di web)")
        self._entry(frame, self.v_cid)

        self._label(frame, "Folder Sinkron di PC ini")
        row = tk.Frame(frame, bg="#0E1117")
        row.pack(fill="x")
        tk.Entry(row, textvariable=self.v_folder, bg="#151A23", fg="#F3F5F7",
                 insertbackground="white", relief="flat",
                 font=("Consolas", 10)).pack(side="left", fill="x",
                                              expand=True, ipady=6)
        tk.Button(row, text="📁", bg="#1F2733", fg="#C7CED6",
                  relief="flat", command=self._browse,
                  font=("Segoe UI", 10)).pack(side="left", padx=(4,0))

        tk.Checkbutton(frame, text="Jalankan otomatis saat komputer dinyalakan",
                       variable=self.v_auto, bg="#0E1117", fg="#C7CED6",
                       selectcolor="#1F2733", activebackground="#0E1117",
                       font=("Segoe UI", 9)).pack(anchor="w", pady=(12,4))

        self.status_var = tk.StringVar(value="")
        tk.Label(frame, textvariable=self.status_var, bg="#0E1117", fg="#F59E0B",
                 font=("Segoe UI", 9)).pack()

        btn_frame = tk.Frame(frame, bg="#0E1117")
        btn_frame.pack(fill="x", pady=(8,0))

        tk.Button(btn_frame, text="Test Koneksi", bg="#1F2733", fg="#C7CED6",
                  relief="flat", padx=12, pady=6, command=self._test,
                  font=("Segoe UI", 10)).pack(side="left")

        tk.Button(btn_frame, text="Simpan & Mulai", bg="#2AABEE", fg="white",
                  relief="flat", padx=12, pady=6, command=self._save,
                  font=("Segoe UI", 10, "bold")).pack(side="right")

    def _browse(self):
        d = filedialog.askdirectory(title="Pilih folder sinkron")
        if d: self.v_folder.set(d)

    def _test(self):
        self.status_var.set("Menguji koneksi...")
        self.root.update()
        try:
            url = self.v_url.get().rstrip("/")
            key = self.v_key.get()
            r   = requests.get(f"{url}/api/files",
                               headers={"X-API-Key": key}, timeout=10)
            if r.ok:
                n = len(r.json().get("files", []))
                self.status_var.set(f"✅ Berhasil! {n} file ditemukan.")
            else:
                self.status_var.set(f"❌ Gagal: HTTP {r.status_code}")
        except Exception as e:
            self.status_var.set(f"❌ Tidak bisa konek: {e}")

    def _save(self):
        if not self.v_url.get() or not self.v_key.get():
            self.status_var.set("⚠ URL dan API Key wajib diisi.")
            return
        self.result = {
            "url":       self.v_url.get().rstrip("/"),
            "api_key":   self.v_key.get(),
            "client_id": self.v_cid.get(),
            "folder":    self.v_folder.get() or str(Path("~/TeleDrive").expanduser()),
            "interval":  30,
            "autostart": self.v_auto.get(),
        }
        save_config(self.result)
        set_autostart(self.result["autostart"])
        self.root.destroy()


# ── Tray Application ──────────────────────────────────────────────────────────

class TrayApp:
    def __init__(self, cfg: dict):
        self.cfg        = cfg
        self.syncer     = None
        self.observer   = None
        self.stop_event = threading.Event()
        self._running   = False
        self._status    = "Siap"
        self.q_offline  = OfflineQueue()

        self.icon = pystray.Icon(
            "TeleDrive",
            ICON_RED(),
            "TeleDrive — Berhenti",
            menu=pystray.Menu(
                pystray.MenuItem("🟢 Mulai Sinkronisasi",  self._start,
                                 enabled=lambda i: not self._running),
                pystray.MenuItem("🔴 Hentikan Sinkronisasi", self._stop,
                                 enabled=lambda i: self._running),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("📁 Buka Folder",  self._open_folder),
                pystray.MenuItem("🌐 Buka Web",     self._open_web),
                pystray.MenuItem("📋 Lihat Log",    self._open_log),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("⚙️  Pengaturan",   self._settings),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("❌ Keluar",        self._quit),
            )
        )

    def _update_icon(self):
        if not self._running:
            self.icon.icon  = ICON_RED()
            self.icon.title = "TeleDrive — Berhenti"
        elif self.syncer and not self.syncer.is_online():
            self.icon.icon  = ICON_YELLOW()
            self.icon.title = f"TeleDrive — Offline ({self.q_offline.size()} antrian)"
        else:
            self.icon.icon  = ICON_GREEN()
            self.icon.title = f"TeleDrive — {self._status}"

    def _on_status(self, text: str, is_error: bool):
        self._status = text
        self._update_icon()

    def _start(self, icon=None, item=None):
        if self._running: return
        folder = Path(self.cfg["folder"]).expanduser().resolve()
        folder.mkdir(parents=True, exist_ok=True)

        self.stop_event.clear()
        self.syncer   = Syncer(self.cfg, self.q_offline, self._on_status)
        self._running = True
        self._update_icon()

        # Poll loop
        threading.Thread(target=self.syncer.poll_loop,
                         args=(self.stop_event,), daemon=True).start()

        # File watcher
        self.observer = Observer()
        self.observer.schedule(WatchHandler(self.syncer), str(folder), recursive=False)
        self.observer.start()

        log.info(f"🟢 Sinkronisasi dimulai — folder: {folder}")
        self._on_status("Sinkronisasi aktif", False)

    def _stop(self, icon=None, item=None):
        if not self._running: return
        self.stop_event.set()
        if self.observer:
            self.observer.stop()
            self.observer.join(timeout=3)
        self._running = False
        self._update_icon()
        log.info("🔴 Sinkronisasi dihentikan")

    def _open_folder(self, *_):
        folder = str(Path(self.cfg["folder"]).expanduser())
        if platform.system() == "Windows":
            os.startfile(folder)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", folder])
        else:
            subprocess.Popen(["xdg-open", folder])

    def _open_web(self, *_):
        webbrowser.open(self.cfg.get("url", ""))

    def _open_log(self, *_):
        if platform.system() == "Windows":
            os.startfile(str(LOG_FILE))
        else:
            subprocess.Popen(["xdg-open", str(LOG_FILE)])

    def _settings(self, *_):
        self._stop()
        wizard = SetupWizard(self.cfg)
        if wizard.result:
            self.cfg = wizard.result
            self._start()

    def _quit(self, *_):
        self._stop()
        self.icon.stop()

    def run(self):
        setup_logging()
        log.info("TeleDrive Desktop dimulai")
        self._start()  # auto-start sinkronisasi saat app dibuka
        self.icon.run()


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    cfg = load_config()

    # Jika belum dikonfigurasi, tampilkan wizard
    if not cfg["url"] or not cfg["api_key"]:
        wizard = SetupWizard(cfg)
        if not wizard.result:
            sys.exit(0)
        cfg = wizard.result

    app = TrayApp(cfg)
    app.run()


if __name__ == "__main__":
    main()
