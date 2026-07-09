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
import ctypes
from dataclasses import dataclass
from pathlib import Path
from ctypes import wintypes
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


class WindowsTrayIcon:
    WM_TRAYICON = 0x800 + 20
    WM_DESTROY = 0x0002
    WM_LBUTTONUP = 0x0202
    WM_LBUTTONDBLCLK = 0x0203
    WM_RBUTTONUP = 0x0205
    NIM_ADD = 0x00000000
    NIM_DELETE = 0x00000002
    NIF_MESSAGE = 0x00000001
    NIF_ICON = 0x00000002
    NIF_TIP = 0x00000004
    ID_SHOW = 1001
    ID_CONNECT = 1002
    ID_EXIT = 1003

    class POINT(ctypes.Structure):
        _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

    class NOTIFYICONDATA(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD),
            ("hWnd", wintypes.HWND),
            ("uID", wintypes.UINT),
            ("uFlags", wintypes.UINT),
            ("uCallbackMessage", wintypes.UINT),
            ("hIcon", wintypes.HICON),
            ("szTip", wintypes.WCHAR * 128),
            ("dwState", wintypes.DWORD),
            ("dwStateMask", wintypes.DWORD),
            ("szInfo", wintypes.WCHAR * 256),
            ("uTimeoutOrVersion", wintypes.UINT),
            ("szInfoTitle", wintypes.WCHAR * 64),
            ("dwInfoFlags", wintypes.DWORD),
        ]

    def __init__(self, app: "DesktopApp"):
        self.app = app
        self.root = app.root
        self.user32 = ctypes.windll.user32
        self.shell32 = ctypes.windll.shell32
        self.hwnd = wintypes.HWND(self.root.winfo_id())
        self.icon_id = 1
        self._proc_ref = None
        self._old_proc = None
        self._setup_api()
        self._subclass_window()
        self._add_icon()

    def _setup_api(self) -> None:
        self.shell32.Shell_NotifyIconW.argtypes = [wintypes.DWORD, ctypes.POINTER(self.NOTIFYICONDATA)]
        self.shell32.Shell_NotifyIconW.restype = wintypes.BOOL
        self.user32.LoadIconW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR]
        self.user32.LoadIconW.restype = wintypes.HICON
        self.user32.CreatePopupMenu.restype = wintypes.HMENU
        self.user32.AppendMenuW.argtypes = [wintypes.HMENU, wintypes.UINT, wintypes.WPARAM, wintypes.LPCWSTR]
        self.user32.TrackPopupMenu.argtypes = [
            wintypes.HMENU,
            wintypes.UINT,
            ctypes.c_int,
            ctypes.c_int,
            ctypes.c_int,
            wintypes.HWND,
            wintypes.LPVOID,
        ]
        self.user32.TrackPopupMenu.restype = wintypes.UINT

    def _subclass_window(self) -> None:
        callback_type = ctypes.WINFUNCTYPE(
            wintypes.LRESULT,
            wintypes.HWND,
            wintypes.UINT,
            wintypes.WPARAM,
            wintypes.LPARAM,
        )
        self._proc_ref = callback_type(self._window_proc)
        if ctypes.sizeof(ctypes.c_void_p) == 8:
            set_window_long = self.user32.SetWindowLongPtrW
        else:
            set_window_long = self.user32.SetWindowLongW
        self._call_window_proc = self.user32.CallWindowProcW
        set_window_long.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_void_p]
        set_window_long.restype = ctypes.c_void_p
        self._call_window_proc.argtypes = [ctypes.c_void_p, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
        self._call_window_proc.restype = wintypes.LRESULT
        self._old_proc = set_window_long(self.hwnd, -4, self._proc_ref)

    def _window_proc(self, hwnd, msg, wparam, lparam):
        if msg == self.WM_TRAYICON:
            if lparam in (self.WM_LBUTTONUP, self.WM_LBUTTONDBLCLK):
                self.root.after(0, self.app.show_window)
            elif lparam == self.WM_RBUTTONUP:
                self.root.after(0, self.show_menu)
            return 0
        if msg == self.WM_DESTROY:
            self.remove()
        return self._call_window_proc(self._old_proc, hwnd, msg, wparam, lparam)

    def _icon_data(self) -> "WindowsTrayIcon.NOTIFYICONDATA":
        data = self.NOTIFYICONDATA()
        data.cbSize = ctypes.sizeof(self.NOTIFYICONDATA)
        data.hWnd = self.hwnd
        data.uID = self.icon_id
        data.uFlags = self.NIF_MESSAGE | self.NIF_ICON | self.NIF_TIP
        data.uCallbackMessage = self.WM_TRAYICON
        app_icon = ctypes.cast(ctypes.c_void_p(32512), wintypes.LPCWSTR)
        data.hIcon = self.user32.LoadIconW(None, app_icon)
        data.szTip = APP_NAME
        return data

    def _add_icon(self) -> None:
        self.shell32.Shell_NotifyIconW(self.NIM_ADD, ctypes.byref(self._icon_data()))

    def remove(self) -> None:
        try:
            self.shell32.Shell_NotifyIconW(self.NIM_DELETE, ctypes.byref(self._icon_data()))
        except Exception:
            pass

    def show_menu(self) -> None:
        menu = self.user32.CreatePopupMenu()
        connect_label = "Disconnect" if self.app.worker else "Connect"
        self.user32.AppendMenuW(menu, 0, self.ID_SHOW, "Show TeleDrive")
        self.user32.AppendMenuW(menu, 0, self.ID_CONNECT, connect_label)
        self.user32.AppendMenuW(menu, 0, self.ID_EXIT, "Exit")
        point = self.POINT()
        self.user32.GetCursorPos(ctypes.byref(point))
        self.user32.SetForegroundWindow(self.hwnd)
        command = self.user32.TrackPopupMenu(menu, 0x0100, point.x, point.y, 0, self.hwnd, None)
        self.user32.DestroyMenu(menu)
        if command == self.ID_SHOW:
            self.app.show_window()
        elif command == self.ID_CONNECT:
            self.app.disconnect() if self.app.worker else self.app.connect()
        elif command == self.ID_EXIT:
            self.app.quit_app()
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
        "autostart": bool(data.get("autostart", False)),
    }


def save_config(config: dict) -> None:
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")


def set_autostart(enabled: bool) -> None:
    executable = sys.executable if getattr(sys, "frozen", False) else f'"{sys.executable}" "{Path(__file__).resolve()}"'
    system = platform.system()

    if system == "Windows":
        if not getattr(sys, "frozen", False):
            pythonw = Path(sys.executable).with_name("pythonw.exe")
            runner = pythonw if pythonw.exists() else Path(sys.executable)
            executable = f'"{runner}" "{Path(__file__).resolve()}"'
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
        self.tray_icon: WindowsTrayIcon | None = None
        self.is_quitting = False

        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("720x540")
        self.root.minsize(680, 500)
        self.root.configure(bg="#F1F3F6")
        self.root.protocol("WM_DELETE_WINDOW", self.handle_close)

        self.server_var = tk.StringVar(value=self.config["server_url"])
        self.key_var = tk.StringVar(value=self.config["api_key"])
        self.folder_var = tk.StringVar(value=self.config["folder"])
        self.autostart_var = tk.BooleanVar(value=self.config["autostart"])
        self.power_var = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value="Disconnected")
        self.detail_var = tk.StringVar(value="Isi API key, pilih folder, lalu klik Connect.")
        self.device_var = tk.StringVar(value=self.config.get("device_name") or "-")
        self.folder_display_var = tk.StringVar(value=self.config["folder"])

        self.build_ui()
        self.root.after(100, self.init_tray)
        self.root.after(400, self.process_events)

    def build_ui(self) -> None:
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass

        style.configure("TCheckbutton", background="#F1F3F6", foreground="#27313F", font=("Segoe UI", 9))

        header = tk.Frame(self.root, bg="#2E3642", height=58)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(header, text="TeleDrive Desktop Client", bg="#2E3642", fg="#FFFFFF",
                 font=("Segoe UI", 15, "bold")).pack(side="left", padx=18)
        tk.Label(header, text="Control Panel", bg="#2E3642", fg="#AEB7C4",
                 font=("Segoe UI", 9)).pack(side="right", padx=18)

        frame = tk.Frame(self.root, bg="#F1F3F6", padx=18, pady=16)
        frame.pack(fill="both", expand=True)

        control = tk.Frame(frame, bg="#FFFFFF", highlightthickness=1, highlightbackground="#C8D0DA")
        control.pack(fill="x")

        top = tk.Frame(control, bg="#FFFFFF", padx=14, pady=12)
        top.pack(fill="x")
        self.status_badge = tk.Label(top, text="OFF", bg="#C0392B", fg="#FFFFFF",
                                     font=("Segoe UI", 12, "bold"), width=8)
        self.status_badge.pack(side="left")
        tk.Label(top, textvariable=self.status_var, bg="#FFFFFF", fg="#202832",
                 font=("Segoe UI", 12, "bold")).pack(side="left", padx=(12, 0))
        tk.Button(top, text="ON", command=self.power_on, bg="#2EAD4F", fg="#FFFFFF",
                  relief="flat", font=("Segoe UI", 10, "bold"), width=10, pady=6).pack(side="right", padx=(8, 0))
        tk.Button(top, text="OFF", command=self.power_off, bg="#D9534F", fg="#FFFFFF",
                  relief="flat", font=("Segoe UI", 10, "bold"), width=10, pady=6).pack(side="right")

        tk.Label(control, textvariable=self.detail_var, bg="#FFFFFF", fg="#637083",
                 font=("Segoe UI", 9), wraplength=650, justify="left").pack(fill="x", padx=14, pady=(0, 12), anchor="w")

        table = tk.Frame(frame, bg="#FFFFFF", highlightthickness=1, highlightbackground="#C8D0DA")
        table.pack(fill="both", expand=True, pady=(14, 0))
        for col, text, width in [(0, "Module", 15), (1, "Status", 13), (2, "Info", 34), (3, "Actions", 22)]:
            tk.Label(table, text=text, bg="#E8ECF2", fg="#27313F",
                     font=("Segoe UI", 9, "bold"), anchor="w", width=width).grid(
                         row=0, column=col, sticky="ew", padx=1, pady=1, ipady=7)
        table.grid_columnconfigure(2, weight=1)

        tk.Label(table, text="Sync Service", bg="#FFFFFF", fg="#27313F",
                 font=("Segoe UI", 10, "bold"), anchor="w").grid(row=1, column=0, sticky="ew", padx=10, pady=10)
        self.service_state = tk.Label(table, text="Stopped", bg="#FFFFFF", fg="#C0392B",
                                      font=("Segoe UI", 10, "bold"), anchor="w")
        self.service_state.grid(row=1, column=1, sticky="ew", padx=10, pady=10)
        tk.Label(table, textvariable=self.device_var, bg="#FFFFFF", fg="#637083",
                 font=("Segoe UI", 9), anchor="w").grid(row=1, column=2, sticky="ew", padx=10, pady=10)
        action_row = tk.Frame(table, bg="#FFFFFF")
        action_row.grid(row=1, column=3, sticky="e", padx=10, pady=8)
        tk.Button(action_row, text="Start", command=self.connect, bg="#4CAF50", fg="#FFFFFF",
                  relief="flat", width=8, pady=4).pack(side="left", padx=(0, 6))
        tk.Button(action_row, text="Stop", command=self.disconnect, bg="#D9534F", fg="#FFFFFF",
                  relief="flat", width=8, pady=4).pack(side="left")

        tk.Label(table, text="Folder", bg="#FFFFFF", fg="#27313F",
                 font=("Segoe UI", 10, "bold"), anchor="w").grid(row=2, column=0, sticky="ew", padx=10, pady=10)
        tk.Label(table, text="Ready", bg="#FFFFFF", fg="#2EAD4F",
                 font=("Segoe UI", 10, "bold"), anchor="w").grid(row=2, column=1, sticky="ew", padx=10, pady=10)
        tk.Label(table, textvariable=self.folder_display_var, bg="#FFFFFF", fg="#637083",
                 font=("Consolas", 9), anchor="w").grid(row=2, column=2, sticky="ew", padx=10, pady=10)
        folder_actions = tk.Frame(table, bg="#FFFFFF")
        folder_actions.grid(row=2, column=3, sticky="e", padx=10, pady=8)
        tk.Button(folder_actions, text="Browse", command=self.pick_folder, bg="#56616F", fg="#FFFFFF",
                  relief="flat", width=8, pady=4).pack(side="left", padx=(0, 6))
        tk.Button(folder_actions, text="Open", command=self.open_folder, bg="#56616F", fg="#FFFFFF",
                  relief="flat", width=8, pady=4).pack(side="left")

        form = tk.Frame(frame, bg="#F1F3F6")
        form.pack(fill="x", pady=(14, 0))
        left = tk.Frame(form, bg="#F1F3F6")
        left.pack(side="left", fill="both", expand=True)
        right = tk.Frame(form, bg="#F1F3F6")
        right.pack(side="right", fill="y", padx=(14, 0))

        self.add_field(left, "Server URL", self.server_var, show=None)
        self.add_field(left, "API Key Perangkat", self.key_var, show="*")

        tk.Checkbutton(right, text="Startup Windows",
                       variable=self.autostart_var, command=self.update_autostart,
                       bg="#F1F3F6", fg="#27313F", selectcolor="#FFFFFF",
                       activebackground="#F1F3F6", font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(22, 8))
        tk.Label(right, text="Dicentang: otomatis berjalan saat Windows restart.\nTidak dicentang: tidak auto running.",
                 bg="#F1F3F6", fg="#637083", font=("Segoe UI", 8),
                 justify="left").pack(anchor="w")

    def add_field(self, parent, label: str, variable: tk.StringVar, show: str | None = None) -> None:
        tk.Label(parent, text=label, bg="#F1F3F6", fg="#27313F",
                 font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(0, 4))
        tk.Entry(parent, textvariable=variable, bg="#FFFFFF", fg="#202832",
                 insertbackground="#202832", relief="solid", bd=1, font=("Consolas", 10),
                 show=show or "").pack(fill="x", ipady=7, pady=(0, 10))

    def pick_folder(self) -> None:
        folder = filedialog.askdirectory(title="Pilih folder lokal TeleDrive")
        if folder:
            self.folder_var.set(folder)
            self.folder_display_var.set(folder)
            self.config = self.current_config()
            save_config(self.config)

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
        self.power_var.set(True)
        self.update_status_view("syncing")
        self.worker = SyncWorker(config, self.events)
        self.worker.start()

    def disconnect(self) -> None:
        if self.worker:
            self.worker.stop()
            self.worker = None
        self.power_var.set(False)
        self.status_var.set("Disconnected")
        self.detail_var.set("Sync berhenti. Klik ON atau Start untuk menjalankan kembali.")
        self.update_status_view("stopped")

    def power_on(self) -> None:
        self.connect()

    def power_off(self) -> None:
        self.disconnect()
        self.quit_app()

    def update_autostart(self) -> None:
        self.config = self.current_config()
        save_config(self.config)
        set_autostart(self.config["autostart"])

    def update_status_view(self, status: str) -> None:
        if status in ("online", "syncing"):
            self.status_badge.config(text="ON", bg="#2EAD4F")
            self.service_state.config(text="Running", fg="#2EAD4F")
        elif status == "error":
            self.status_badge.config(text="ERR", bg="#F0AD4E")
            self.service_state.config(text="Error", fg="#F0AD4E")
        else:
            self.status_badge.config(text="OFF", bg="#C0392B")
            self.service_state.config(text="Stopped", fg="#C0392B")

    def process_events(self) -> None:
        while True:
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                break
            status = event["status"]
            self.status_var.set(status.capitalize())
            self.detail_var.set(event["message"])
            self.device_var.set(self.config.get("device_name") or "-")
            self.update_status_view(status)
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

    def init_tray(self) -> None:
        if platform.system() != "Windows":
            return
        try:
            self.root.update_idletasks()
            self.tray_icon = WindowsTrayIcon(self)
        except Exception as exc:
            self.tray_icon = None
            log(f"Tray init gagal: {exc}")

    def show_window(self) -> None:
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()

    def hide_window(self) -> None:
        if self.tray_icon:
            self.root.withdraw()
        else:
            self.root.iconify()

    def handle_close(self) -> None:
        if self.worker:
            self.hide_window()
        else:
            self.quit_app()

    def quit_app(self) -> None:
        self.is_quitting = True
        if self.worker:
            self.worker.stop()
            self.worker = None
        if self.tray_icon:
            self.tray_icon.remove()
            self.tray_icon = None
        self.root.destroy()

    def run(self) -> None:
        if self.config["server_url"] and self.config["api_key"]:
            self.root.after(800, self.connect)
        self.root.mainloop()


if __name__ == "__main__":
    DesktopApp().run()
