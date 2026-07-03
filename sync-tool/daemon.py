#!/usr/bin/env python3
"""
TeleDrive Sync Daemon — sinkronisasi DUA ARAH otomatis.

Cara kerja:
  - UPLOAD: watchdog memantau folder lokal secara real-time.
    File baru/berubah → langsung diupload ke TeleDrive.
  - DOWNLOAD: polling ke TeleDrive API setiap --interval detik.
    File baru di TeleDrive yang belum ada lokal → didownload otomatis.

Install:
  pip install requests watchdog

Jalankan:
  python daemon.py --folder "C:/TeleDrive" --url https://app.vercel.app --api-key PASSWORD

Jalankan di background (Windows):
  pythonw daemon.py --folder "C:/TeleDrive" --url https://app.vercel.app --api-key PASSWORD

Jadwalkan otomatis saat startup: lihat README.md
"""

import argparse
import logging
import os
import sys
import threading
import time
from pathlib import Path

try:
    import requests
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("Install dependencies dulu:\n  pip install requests watchdog")
    sys.exit(1)

# ─── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("teledrive")


# ─── API Client ────────────────────────────────────────────────────────────────

class TeleDriveAPI:
    def __init__(self, base_url: str, api_key: str):
        self.base = base_url.rstrip("/")
        self.headers = {"X-API-Key": api_key}

    def list_files(self) -> list[dict]:
        r = requests.get(f"{self.base}/api/files", headers=self.headers, timeout=30)
        r.raise_for_status()
        return r.json()["files"]

    def upload(self, path: Path) -> dict:
        with open(path, "rb") as f:
            r = requests.post(
                f"{self.base}/api/upload",
                headers=self.headers,
                files={"file": (path.name, f)},
                data={"filename": path.name},
                timeout=300,
            )
        r.raise_for_status()
        return r.json()["file"]

    def download(self, message_id: int, dest: Path) -> None:
        r = requests.get(
            f"{self.base}/api/file/{message_id}/download",
            headers=self.headers,
            stream=True,
            timeout=300,
        )
        r.raise_for_status()
        tmp = dest.with_suffix(dest.suffix + ".tdtmp")
        try:
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=64 * 1024):
                    f.write(chunk)
            tmp.rename(dest)
        except Exception:
            tmp.unlink(missing_ok=True)
            raise


# ─── Syncer ────────────────────────────────────────────────────────────────────

class Syncer:
    def __init__(self, folder: Path, api: TeleDriveAPI, interval: int):
        self.folder = folder
        self.api = api
        self.interval = interval

        # File yang sedang dalam proses upload — jangan di-trigger ulang
        self._uploading: set[str] = set()
        self._lock = threading.Lock()

    # ── Upload helpers ──────────────────────────────────────────────────────────

    def _local_fingerprint(self) -> dict[str, int]:
        """Nama → ukuran untuk semua file lokal (bukan file temp)."""
        result = {}
        for p in self.folder.iterdir():
            if p.is_file() and not p.name.endswith(".tdtmp"):
                result[p.name] = p.stat().st_size
        return result

    def _remote_fingerprint(self, remote_files: list[dict]) -> dict[str, dict]:
        """Nama → entry remote untuk semua file di TeleDrive."""
        return {f["name"]: f for f in remote_files}

    def upload_file(self, path: Path) -> None:
        name = path.name
        with self._lock:
            if name in self._uploading:
                return
            self._uploading.add(name)
        try:
            # Tunggu file selesai ditulis (ukuran stabil selama 1 detik)
            size_before = -1
            for _ in range(10):
                time.sleep(0.5)
                try:
                    size_now = path.stat().st_size
                except FileNotFoundError:
                    return
                if size_now == size_before:
                    break
                size_before = size_now

            if not path.exists():
                return

            log.info(f"⬆  Upload  {name} ({_human(path.stat().st_size)})")
            self.api.upload(path)
            log.info(f"✅ Selesai {name}")
        except Exception as e:
            log.error(f"❌ Gagal upload {name}: {e}")
        finally:
            with self._lock:
                self._uploading.discard(name)

    # ── Download helpers ────────────────────────────────────────────────────────

    def sync_downloads(self) -> None:
        try:
            remote_files = self.api.list_files()
        except Exception as e:
            log.warning(f"⚠  Gagal ambil daftar file: {e}")
            return

        local_fp = self._local_fingerprint()
        remote_fp = self._remote_fingerprint(remote_files)

        for name, rf in remote_fp.items():
            with self._lock:
                being_uploaded = name in self._uploading
            if being_uploaded:
                continue

            local_path = self.folder / name
            local_size = local_fp.get(name)

            # Sudah ada dengan ukuran sama → skip
            if local_size is not None and local_size == rf["size"]:
                continue

            log.info(f"⬇  Download {name} ({_human(rf['size'])})")
            try:
                self.api.download(rf["messageId"], local_path)
                log.info(f"✅ Selesai  {name}")
            except Exception as e:
                log.error(f"❌ Gagal download {name}: {e}")

    # ── Poll loop ───────────────────────────────────────────────────────────────

    def poll_loop(self) -> None:
        log.info(f"🔄 Polling setiap {self.interval} detik...")
        while True:
            self.sync_downloads()
            time.sleep(self.interval)


# ─── Watchdog handler ──────────────────────────────────────────────────────────

class LocalChangeHandler(FileSystemEventHandler):
    def __init__(self, syncer: Syncer):
        self.syncer = syncer

    def _handle(self, path_str: str) -> None:
        path = Path(path_str)
        if not path.is_file():
            return
        if path.name.endswith(".tdtmp"):
            return  # file temp download kita sendiri
        # Upload di thread terpisah supaya watchdog tidak blocking
        threading.Thread(
            target=self.syncer.upload_file,
            args=(path,),
            daemon=True,
        ).start()

    def on_created(self, event):
        if not event.is_directory:
            self._handle(event.src_path)

    def on_moved(self, event):
        # File di-rename ke dalam folder → upload
        if not event.is_directory:
            self._handle(event.dest_path)


# ─── Utilities ─────────────────────────────────────────────────────────────────

def _human(b: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if b < 1024:
            return f"{b:.0f} {unit}" if unit == "B" else f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} GB"


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="TeleDrive Sync Daemon — sinkronisasi dua arah otomatis"
    )
    ap.add_argument("--folder",   required=True, help="Path folder lokal yang akan disinkron")
    ap.add_argument("--url",      required=True, help="https://nama-app.vercel.app")
    ap.add_argument("--api-key",  required=True, help="Nilai APP_PASSWORD di Vercel")
    ap.add_argument("--interval", type=int, default=30,
                    help="Interval cek file baru dari TeleDrive (detik, default: 30)")
    ap.add_argument("--log-file", default="",
                    help="Simpan log ke file (opsional)")
    args = ap.parse_args()

    folder = Path(args.folder).expanduser().resolve()
    folder.mkdir(parents=True, exist_ok=True)

    if args.log_file:
        fh = logging.FileHandler(args.log_file, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-7s  %(message)s"))
        logging.getLogger().addHandler(fh)

    log.info("━" * 50)
    log.info("  TeleDrive Sync Daemon")
    log.info(f"  Folder  : {folder}")
    log.info(f"  Server  : {args.url}")
    log.info(f"  Interval: {args.interval}s")
    log.info("━" * 50)

    api    = TeleDriveAPI(args.url, args.api_key)
    syncer = Syncer(folder, api, args.interval)

    # Test koneksi
    try:
        files = api.list_files()
        log.info(f"✅ Terhubung ke TeleDrive ({len(files)} file di cloud)")
    except Exception as e:
        log.error(f"❌ Tidak bisa konek ke TeleDrive: {e}")
        sys.exit(1)

    # Sync awal saat startup
    log.info("🔁 Sync awal dari TeleDrive...")
    syncer.sync_downloads()

    # Watchdog — pantau folder lokal
    handler  = LocalChangeHandler(syncer)
    observer = Observer()
    observer.schedule(handler, str(folder), recursive=False)
    observer.start()
    log.info(f"👁  Memantau folder: {folder}")

    # Poll loop di thread background
    poll_thread = threading.Thread(target=syncer.poll_loop, daemon=True)
    poll_thread.start()

    log.info("🟢 Daemon berjalan. Tekan Ctrl+C untuk berhenti.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("\n🔴 Berhenti...")
        observer.stop()

    observer.join()
    log.info("Daemon selesai.")


if __name__ == "__main__":
    main()
