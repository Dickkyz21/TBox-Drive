#!/usr/bin/env python3
"""
TeleDrive Desktop Client Lite

Desktop sync client untuk Windows/Linux dengan dependency runtime minimal.
Jika dibundle menjadi .exe/AppImage, user tidak perlu install Python package apa pun.

Fitur:
- Isi API key perangkat, pilih folder lokal, klik Connect.
- Upload file lokal ke TeleDrive.
- Download file cloud ke folder lokal.
- Heartbeat agar status perangkat Online.
- Polling ringan, tanpa watchdog/requests.
"""

from __future__ import annotations

import json
import mimetypes
import os
import platform
import queue
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
import tkinter as tk

APP_NAME = "TeleDrive Desktop"
STATE_FILE = ".teledrive-state.json"
DEFAULT_INTERVAL = 30
DEFAULT_SERVER_URL = os.environ.get("TELEDRIVE_SERVER_URL", "").strip()


def app_dir() -> Path:
    if platform.system() == "Windows":
        root = Path(os.environ.get("APPDATA", str(Path.home())))
        path = root / "TeleDrive"
    else:
        path = Path.home() / ".config" / "teledrive"
    path.mkdir(parents=True, exist_ok=True)
    return path


CONFIG_FILE = app_dir() / "desktop-client.json"
LOG_FILE = app_dir() / "desktop-client.log"


def log(message: str) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {message}\n"
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(line)


def human_size(size: int) -> str:
    value = float(size)
    for unit in ["B", "KB", "MB", "GB"]:
        if value < 1024:
            return f"{value:.0f} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"


def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    else:
        data = {}
    return {
        "server_url": data.get("server_url") or DEFAULT_SERVER_URL,
        "api_key": data.get("api_key", ""),
        "folder": data.get("folder") or str(Path.home() / "TeleDrive"),
        "device_id": data.get("device_id", ""),
        "device_name": data.get("device_name", ""),
        "interval": int(data.get("interval", DEFAULT_INTERVAL)),
        "autostart": bool(data.get("autostart", True)),
    }


def save_config(config: dict) -> None:
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


def set_autostart(enabled: bool) -> None:
    executable = sys.executable if getattr(sys, "frozen", False) else f'"{sys.executable}" "{Path(__file__).resolve()}"'
    system = platform.system()

    if system == "Windows":
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0,
                winreg.KEY_SET_VALUE,
            )
            if enabled:
                winreg.SetValueEx(key, "TeleDrive", 0, winreg.REG_SZ, executable)
            else:
                try:
                    winreg.DeleteValue(key, "TeleDrive")
                except FileNotFoundError:
                    pass
            winreg.CloseKey(key)
        except Exception as exc:
            log(f"Autostart Windows gagal: {exc}")
        return

    if system == "Linux":
        target = Path.home() / ".config" / "autostart"
        target.mkdir(parents=True, exist_ok=True)
        desktop = target / "teledrive.desktop"
        if enabled:
            desktop.write_text(
                "[Desktop Entry]\n"
                "Type=Application\n"
                "Name=TeleDrive\n"
                f"Exec={executable}\n"
                "Hidden=false\n"
                "NoDisplay=false\n"
                "X-GNOME-Autostart-enabled=true\n",
                encoding="utf-8",
            )
        else:
            desktop.unlink(missing_ok=True)


class ApiError(Exception):
    pass


class TeleDriveApi:
    def __init__(self, server_url: str, api_key: str):
        self.server_url = server_url.rstrip("/")
        self.api_key = api_key

    def _request(
        self,
        method: str,
        path: str,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
        timeout: int = 60,
    ):
        request_headers = {"X-API-Key": self.api_key}
        if headers:
            request_headers.update(headers)
        req = urllib.request.Request(
            f"{self.server_url}{path}",
            data=body,
            headers=request_headers,
            method=method,
        )
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as exc:
            try:
                payload = exc.read().decode("utf-8", errors="replace")
                data = json.loads(payload)
                message = data.get("error") or payload
            except Exception:
                message = exc.reason or f"HTTP {exc.code}"
            raise ApiError(message) from exc
        except urllib.error.URLError as exc:
            raise ApiError(str(exc.reason)) from exc

    def connect(self) -> dict:
        with self._request("GET", "/api/clients/connect", timeout=20) as res:
            return json.loads(res.read().decode("utf-8"))["device"]

    def list_files(self) -> list[dict]:
        with self._request("GET", "/api/files", timeout=60) as res:
            return json.loads(res.read().decode("utf-8"))["files"]

    def heartbeat(self, device_id: str) -> None:
        if not device_id:
            return
        self._request("POST", f"/api/clients/{device_id}/heartbeat", timeout=15).close()

    def delete(self, message_id: int) -> None:
        self._request("POST", f"/api/file/{message_id}/delete", timeout=30).close()

    def download(self, message_id: int, destination: Path) -> None:
        with self._request("GET", f"/api/file/{message_id}/download", timeout=300) as res:
            tmp = destination.with_suffix(destination.suffix + ".tdtmp")
            try:
                with tmp.open("wb") as handle:
                    while True:
                        chunk = res.read(128 * 1024)
                        if not chunk:
                            break
                        handle.write(chunk)
                tmp.replace(destination)
            except Exception:
                tmp.unlink(missing_ok=True)
                raise

    def upload(self, path: Path) -> dict:
        boundary = f"----TeleDrive{uuid.uuid4().hex}"
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        prefix = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="filename"\r\n\r\n'
            f"{path.name}\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode("utf-8")
        suffix = f"\r\n--{boundary}--\r\n".encode("utf-8")
        body = prefix + path.read_bytes() + suffix
        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        with self._request("POST", "/api/upload", body=body, headers=headers, timeout=300) as res:
            return json.loads(res.read().decode("utf-8"))["file"]


class State:
    def __init__(self, folder: Path):
        self.path = folder / STATE_FILE
        self.data: dict[str, int] = {}
        self.load()

    def load(self) -> None:
        if self.path.exists():
            try:
                self.data = json.loads(self.path.read_text(encoding="utf-8"))
            except Exception:
                self.data = {}

    def save(self) -> None:
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def set(self, name: str, message_id: int) -> None:
        self.data[name] = message_id
        self.save()

    def remove(self, name: str) -> None:
        if name in self.data:
            del self.data[name]
            self.save()


@dataclass
class LocalFile:
    name: str
    size: int
    mtime: float


class SyncWorker(threading.Thread):
    def __init__(self, config: dict, events: queue.Queue):
        super().__init__(daemon=True)
        self.config = config
        self.events = events
        self.stop_event = threading.Event()
        self.folder = Path(config["folder"]).expanduser().resolve()
        self.api = TeleDriveApi(config["server_url"], config["api_key"])
        self.state = State(self.folder)
        self.snapshot: dict[str, LocalFile] = {}

    def emit(self, status: str, message: str) -> None:
        self.events.put({"status": status, "message": message})
        log(f"{status}: {message}")

    def scan_local(self) -> dict[str, LocalFile]:
        result: dict[str, LocalFile] = {}
        self.folder.mkdir(parents=True, exist_ok=True)
        for path in self.folder.iterdir():
            if not path.is_file() or path.name == STATE_FILE or path.name.endswith(".tdtmp"):
                continue
            stat = path.stat()
            result[path.name] = LocalFile(path.name, stat.st_size, stat.st_mtime)
        return result

    def wait_stable(self, path: Path) -> bool:
        previous = -1
        for _ in range(10):
            if self.stop_event.wait(0.5):
                return False
            if not path.exists():
                return False
            current = path.stat().st_size
            if current == previous:
                return True
            previous = current
        return path.exists()

    def sync_remote(self) -> None:
        remote = self.api.list_files()
        remote_by_id = {item["messageId"]: item for item in remote}

        for item in remote:
            name = item["name"]
            target = self.folder / name
            if target.exists() and target.stat().st_size == item["size"]:
                self.state.set(name, item["messageId"])
                continue
            self.emit("syncing", f"Download {name}")
            self.api.download(item["messageId"], target)
            self.state.set(name, item["messageId"])

        for name, message_id in list(self.state.data.items()):
            if message_id not in remote_by_id:
                local = self.folder / name
                if local.exists():
                    local.unlink()
                self.state.remove(name)

    def upload_changed(self, current: dict[str, LocalFile]) -> None:
        previous_names = set(self.snapshot)
        current_names = set(current)

        for removed in previous_names - current_names:
            message_id = self.state.data.get(removed)
            if message_id:
                self.emit("syncing", f"Hapus cloud {removed}")
                self.api.delete(message_id)
                self.state.remove(removed)

        for name, local in current.items():
            old = self.snapshot.get(name)
            if old and old.size == local.size and old.mtime == local.mtime:
                continue
            path = self.folder / name
            if not self.wait_stable(path):
                continue
            self.emit("syncing", f"Upload {name} ({human_size(local.size)})")
            uploaded = self.api.upload(path)
            self.state.set(name, uploaded["messageId"])

    def run(self) -> None:
        try:
            self.folder.mkdir(parents=True, exist_ok=True)
            device = self.api.connect()
            self.config["device_id"] = device["id"]
            self.config["device_name"] = device["name"]
            save_config(self.config)
            self.emit("online", f"Connected: {device['name']}")
            self.sync_remote()
            self.snapshot = self.scan_local()

            while not self.stop_event.wait(self.config.get("interval", DEFAULT_INTERVAL)):
                self.api.heartbeat(self.config.get("device_id", ""))
                current = self.scan_local()
                self.upload_changed(current)
                self.sync_remote()
                self.snapshot = self.scan_local()
                self.emit("online", "Synced")
        except Exception as exc:
            self.emit("error", str(exc))

    def stop(self) -> None:
        self.stop_event.set()


class DesktopApp:
    def __init__(self):
        self.config = load_config()
        self.events: queue.Queue = queue.Queue()
        self.worker: SyncWorker | None = None

        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("560x430")
        self.root.minsize(520, 400)
        self.root.configure(bg="#0E1117")
        self.root.protocol("WM_DELETE_WINDOW", self.hide_window)

        self.server_var = tk.StringVar(value=self.config["server_url"])
        self.key_var = tk.StringVar(value=self.config["api_key"])
        self.folder_var = tk.StringVar(value=self.config["folder"])
        self.autostart_var = tk.BooleanVar(value=self.config["autostart"])
        self.status_var = tk.StringVar(value="Disconnected")
        self.detail_var = tk.StringVar(value="Isi API key, pilih folder, lalu klik Connect.")

        self.build_ui()
        self.root.after(400, self.process_events)

    def build_ui(self) -> None:
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass

        frame = tk.Frame(self.root, bg="#0E1117", padx=24, pady=20)
        frame.pack(fill="both", expand=True)

        tk.Label(frame, text="TeleDrive Desktop", bg="#0E1117", fg="#F3F5F7",
                 font=("Segoe UI", 18, "bold")).pack(anchor="w")
        tk.Label(frame, text="Connect PC user ke TeleDrive tanpa install komponen tambahan.",
                 bg="#0E1117", fg="#8A93A1", font=("Segoe UI", 9)).pack(anchor="w", pady=(2, 18))

        self.add_field(frame, "Server URL (otomatis terisi dari download/installer)", self.server_var, show=None)
        self.add_field(frame, "API Key Perangkat", self.key_var, show="*")

        tk.Label(frame, text="Folder lokal", bg="#0E1117", fg="#C7CED6",
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(10, 4))
        row = tk.Frame(frame, bg="#0E1117")
        row.pack(fill="x")
        tk.Entry(row, textvariable=self.folder_var, bg="#151A23", fg="#F3F5F7",
                 insertbackground="white", relief="flat", font=("Consolas", 10)).pack(
            side="left", fill="x", expand=True, ipady=7)
        tk.Button(row, text="Pilih Folder", command=self.pick_folder, bg="#1F2733",
                  fg="#F3F5F7", relief="flat", padx=12, pady=6).pack(side="left", padx=(8, 0))

        tk.Checkbutton(frame, text="Jalankan otomatis saat komputer dinyalakan",
                       variable=self.autostart_var, bg="#0E1117", fg="#C7CED6",
                       selectcolor="#151A23", activebackground="#0E1117",
                       font=("Segoe UI", 9)).pack(anchor="w", pady=(14, 12))

        status_box = tk.Frame(frame, bg="#151A23", padx=14, pady=12)
        status_box.pack(fill="x", pady=(0, 14))
        tk.Label(status_box, textvariable=self.status_var, bg="#151A23", fg="#2AABEE",
                 font=("Segoe UI", 11, "bold")).pack(anchor="w")
        tk.Label(status_box, textvariable=self.detail_var, bg="#151A23", fg="#8A93A1",
                 font=("Segoe UI", 9), wraplength=480, justify="left").pack(anchor="w", pady=(3, 0))

        buttons = tk.Frame(frame, bg="#0E1117")
        buttons.pack(fill="x")
        self.connect_btn = tk.Button(buttons, text="Connect", command=self.connect,
                                     bg="#2AABEE", fg="white", relief="flat",
                                     font=("Segoe UI", 10, "bold"), padx=18, pady=8)
        self.connect_btn.pack(side="left")
        tk.Button(buttons, text="Disconnect", command=self.disconnect, bg="#1F2733",
                  fg="#F3F5F7", relief="flat", padx=14, pady=8).pack(side="left", padx=(8, 0))
        tk.Button(buttons, text="Buka Folder", command=self.open_folder, bg="#1F2733",
                  fg="#F3F5F7", relief="flat", padx=14, pady=8).pack(side="right")

    def add_field(self, parent, label: str, variable: tk.StringVar, show: str | None = None) -> None:
        tk.Label(parent, text=label, bg="#0E1117", fg="#C7CED6",
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(10, 4))
        tk.Entry(parent, textvariable=variable, bg="#151A23", fg="#F3F5F7",
                 insertbackground="white", relief="flat", font=("Consolas", 10),
                 show=show or "").pack(fill="x", ipady=7)

    def pick_folder(self) -> None:
        folder = filedialog.askdirectory(title="Pilih folder lokal TeleDrive")
        if folder:
            self.folder_var.set(folder)

    def current_config(self) -> dict:
        return {
            **self.config,
            "server_url": self.server_var.get().strip().rstrip("/"),
            "api_key": self.key_var.get().strip(),
            "folder": self.folder_var.get().strip(),
            "autostart": self.autostart_var.get(),
        }

    def connect(self) -> None:
        config = self.current_config()
        if not config["server_url"] or not config["api_key"] or not config["folder"]:
            messagebox.showerror(APP_NAME, "Server URL, API key, dan folder wajib diisi.")
            return

        self.disconnect()
        self.config = config
        save_config(config)
        set_autostart(config["autostart"])
        self.status_var.set("Connecting")
        self.detail_var.set("Menghubungkan ke TeleDrive...")
        self.worker = SyncWorker(config, self.events)
        self.worker.start()

    def disconnect(self) -> None:
        if self.worker:
            self.worker.stop()
            self.worker = None
        self.status_var.set("Disconnected")

    def process_events(self) -> None:
        while True:
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                break
            status = event["status"]
            self.status_var.set(status.capitalize())
            self.detail_var.set(event["message"])
        self.root.after(500, self.process_events)

    def open_folder(self) -> None:
        folder = Path(self.folder_var.get()).expanduser()
        folder.mkdir(parents=True, exist_ok=True)
        if platform.system() == "Windows":
            os.startfile(str(folder))
        elif platform.system() == "Linux":
            subprocess.Popen(["xdg-open", str(folder)])
        else:
            subprocess.Popen(["open", str(folder)])

    def hide_window(self) -> None:
        self.root.iconify()

    def run(self) -> None:
        if self.config["server_url"] and self.config["api_key"]:
            self.root.after(800, self.connect)
        self.root.mainloop()


if __name__ == "__main__":
    DesktopApp().run()
