#!/usr/bin/env python3
"""
TeleDrive Sync Daemon — sinkronisasi DUA ARAH otomatis.

Install:  pip install requests watchdog
Jalankan: bash start-nama-pc.sh   (download dari halaman Perangkat di web)
"""

import argparse, json, logging, sys, threading, time
from pathlib import Path

try:
    import requests
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("Install dulu:\n  pip install requests watchdog"); sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("teledrive")


class StateTracker:
    def __init__(self, path: Path):
        self.path  = path
        self._data: dict[str, int] = {}
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if self.path.exists():
            try: self._data = json.loads(self.path.read_text())
            except: self._data = {}

    def _save(self):
        self.path.write_text(json.dumps(self._data, indent=2))

    def add(self, name: str, mid: int):
        with self._lock: self._data[name] = mid; self._save()

    def remove(self, name: str):
        with self._lock: self._data.pop(name, None); self._save()

    def get(self, name: str) -> int | None:
        with self._lock: return self._data.get(name)

    def all(self) -> dict[str, int]:
        with self._lock: return dict(self._data)


class TeleDriveAPI:
    def __init__(self, base: str, api_key: str):
        self.base    = base.rstrip("/")
        self.headers = {"X-API-Key": api_key}

    def list_files(self) -> list[dict]:
        r = requests.get(f"{self.base}/api/files", headers=self.headers, timeout=30)
        r.raise_for_status(); return r.json()["files"]

    def upload(self, path: Path) -> dict:
        with open(path, "rb") as f:
            r = requests.post(f"{self.base}/api/upload", headers=self.headers,
                files={"file": (path.name, f)}, data={"filename": path.name}, timeout=300)
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
        r = requests.post(f"{self.base}/api/file/{mid}/delete",
            headers=self.headers, timeout=30)
        r.raise_for_status()

    def heartbeat(self, client_id: str):
        requests.post(f"{self.base}/api/clients/{client_id}/heartbeat",
            headers=self.headers, timeout=10)


class Syncer:
    def __init__(self, folder: Path, api: TeleDriveAPI,
                 state: StateTracker, interval: int, client_id: str):
        self.folder    = folder
        self.api       = api
        self.state     = state
        self.interval  = interval
        self.client_id = client_id
        self._busy: set[str] = set()
        self._lock = threading.Lock()

    def _busy_check(self, name: str) -> bool:
        with self._lock: return name in self._busy

    def _busy_set(self, name: str, v: bool):
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
            log.info(f"⬆  Upload  {name} ({_human(path.stat().st_size)})")
            result = self.api.upload(path)
            self.state.add(name, result["messageId"])
            log.info(f"✅ Upload selesai: {name}")
        except Exception as e: log.error(f"❌ Gagal upload {name}: {e}")
        finally: self._busy_set(name, False)

    def delete_remote(self, name: str):
        if name.endswith(".tdtmp"): return
        mid = self.state.get(name)
        if mid is None: return
        try:
            log.info(f"🗑  Hapus di TeleDrive: {name}")
            self.api.delete(mid)
            self.state.remove(name)
            log.info(f"✅ Terhapus di TeleDrive: {name}")
        except Exception as e: log.error(f"❌ Gagal hapus {name}: {e}")

    def rename_remote(self, old_name: str, new_path: Path):
        if old_name.endswith(".tdtmp") or new_path.name.endswith(".tdtmp"): return
        mid = self.state.get(old_name)
        if mid is not None:
            try:
                log.info(f"✏  Rename: {old_name} → {new_path.name}")
                self.api.delete(mid)
                self.state.remove(old_name)
            except Exception as e: log.error(f"❌ Gagal hapus lama saat rename: {e}")
        self.upload_file(new_path)

    def sync_from_remote(self):
        try: remote = self.api.list_files()
        except Exception as e: log.warning(f"⚠  Gagal ambil daftar: {e}"); return

        remote_by_id   = {f["messageId"]: f for f in remote}
        remote_by_name = {f["name"]: f for f in remote}

        # Download file baru
        for rf in remote:
            name = rf["name"]
            if self._busy_check(name): continue
            dest = self.folder / name
            if dest.exists():
                try:
                    if dest.stat().st_size == rf["size"]:
                        self.state.add(name, rf["messageId"]); continue
                except FileNotFoundError: pass
            self._busy_set(name, True)
            try:
                log.info(f"⬇  Download {name} ({_human(rf['size'])})")
                self.api.download(rf["messageId"], dest)
                self.state.add(name, rf["messageId"])
                log.info(f"✅ Download selesai: {name}")
            except Exception as e: log.error(f"❌ Gagal download {name}: {e}")
            finally: self._busy_set(name, False)

        # Hapus lokal jika dihapus di TeleDrive
        for name, mid in list(self.state.all().items()):
            if mid not in remote_by_id:
                local = self.folder / name
                if local.exists():
                    try:
                        log.info(f"🗑  Hapus lokal (dihapus di cloud): {name}")
                        local.unlink()
                        log.info(f"✅ Terhapus lokal: {name}")
                    except Exception as e: log.error(f"❌ Gagal hapus lokal {name}: {e}")
                self.state.remove(name)

    def heartbeat_loop(self):
        if not self.client_id: return
        log.info(f"💓 Heartbeat aktif (client_id: {self.client_id[:16]}...)")
        while True:
            try: self.api.heartbeat(self.client_id)
            except: pass
            time.sleep(30)

    def poll_loop(self):
        log.info(f"🔄 Polling setiap {self.interval} detik...")
        while True:
            self.sync_from_remote()
            time.sleep(self.interval)


class ChangeHandler(FileSystemEventHandler):
    def __init__(self, syncer: Syncer):
        self.syncer = syncer

    def _run(self, fn, *args):
        threading.Thread(target=fn, args=args, daemon=True).start()

    def on_created(self, e):
        if not e.is_directory: self._run(self.syncer.upload_file, Path(e.src_path))

    def on_deleted(self, e):
        if not e.is_directory: self._run(self.syncer.delete_remote, Path(e.src_path).name)

    def on_moved(self, e):
        if not e.is_directory:
            self._run(self.syncer.rename_remote, Path(e.src_path).name, Path(e.dest_path))


def _human(b: int) -> str:
    for u in ["B","KB","MB","GB"]:
        if b < 1024: return f"{b:.0f} {u}" if u=="B" else f"{b:.1f} {u}"
        b /= 1024
    return f"{b:.1f} GB"


def main():
    ap = argparse.ArgumentParser(description="TeleDrive Sync Daemon")
    ap.add_argument("--folder",    required=True)
    ap.add_argument("--url",       required=True)
    ap.add_argument("--api-key",   required=True)
    ap.add_argument("--client-id", default="", help="ID dari halaman Perangkat (untuk status online)")
    ap.add_argument("--interval",  type=int, default=30)
    ap.add_argument("--log-file",  default="")
    args = ap.parse_args()

    folder = Path(args.folder).expanduser().resolve()
    folder.mkdir(parents=True, exist_ok=True)

    if args.log_file:
        fh = logging.FileHandler(args.log_file, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-7s  %(message)s"))
        logging.getLogger().addHandler(fh)

    state  = StateTracker(folder / ".teledrive-state.json")
    api    = TeleDriveAPI(args.url, args.api_key)
    syncer = Syncer(folder, api, state, args.interval, args.client_id)

    log.info("━" * 52)
    log.info("  TeleDrive Sync Daemon")
    log.info(f"  Folder    : {folder}")
    log.info(f"  Server    : {args.url}")
    log.info(f"  Client ID : {args.client_id or '(tidak diset)'}")
    log.info(f"  Interval  : {args.interval}s")
    log.info("━" * 52)

    try:
        files = api.list_files()
        log.info(f"✅ Terhubung ({len(files)} file di cloud)")
    except Exception as e:
        log.error(f"❌ Tidak bisa konek: {e}"); sys.exit(1)

    log.info("🔁 Sync awal dari TeleDrive...")
    syncer.sync_from_remote()

    obs = Observer()
    obs.schedule(ChangeHandler(syncer), str(folder), recursive=False)
    obs.start()
    log.info(f"👁  Memantau: {folder}")

    for target in [syncer.poll_loop, syncer.heartbeat_loop]:
        threading.Thread(target=target, daemon=True).start()

    log.info("🟢 Daemon aktif. Ctrl+C untuk berhenti.\n")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        log.info("\n🔴 Berhenti..."); obs.stop()
    obs.join()

if __name__ == "__main__":
    main()
