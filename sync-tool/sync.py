#!/usr/bin/env python3
"""
TeleDrive Sync - satu arah: folder lokal -> TeleDrive.
Install: pip install requests
Jalankan: python sync.py /path/folder --url https://app.vercel.app --api-key PASSWORD
Opsi    : --recursive (ikut subfolder), --dry-run (preview tanpa upload)
Jadwal  : Task Scheduler (Windows) atau cron (Linux) - lihat README.
"""
import argparse, os, sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Jalankan dulu: pip install requests"); sys.exit(1)

def human_size(b):
    for u in ['B','KB','MB','GB']:
        if b < 1024 or u=='GB': return f"{b:.1f} {u}" if u!='B' else f"{int(b)} B"
        b /= 1024

def get_remote(url, key):
    r = requests.get(f"{url}/api/files", headers={"X-API-Key": key}, timeout=30)
    if not r.ok: raise RuntimeError(f"HTTP {r.status_code}: {r.text}")
    return r.json()["files"]

def upload(url, key, path):
    with open(path, "rb") as f:
        r = requests.post(f"{url}/api/upload", headers={"X-API-Key": key},
                          files={"file": (path.name, f)},
                          data={"filename": path.name}, timeout=300)
    if not r.ok: raise RuntimeError(f"HTTP {r.status_code}: {r.text}")

def main():
    ap = argparse.ArgumentParser(description="Sync folder lokal -> TeleDrive (satu arah)")
    ap.add_argument("folder")
    ap.add_argument("--url", required=True, help="https://nama-app.vercel.app")
    ap.add_argument("--api-key", required=True, help="Nilai APP_PASSWORD di Vercel")
    ap.add_argument("--recursive", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    folder = Path(args.folder).expanduser().resolve()
    url = args.url.rstrip("/")
    if not folder.is_dir(): print(f"Folder tidak ditemukan: {folder}"); sys.exit(1)

    print(f"Mengambil daftar file dari {url} ...")
    try:
        remote = get_remote(url, args.api_key)
    except Exception as e:
        print(f"Gagal: {e}"); sys.exit(1)

    remote_fps = {(f["name"], f["size"]) for f in remote}
    print(f"{len(remote)} file di TeleDrive.")

    local = list(folder.rglob("*") if args.recursive else folder.iterdir())
    local = [p for p in local if p.is_file()]
    print(f"{len(local)} file di folder lokal.\n")

    to_upload = [p for p in local if (p.name, p.stat().st_size) not in remote_fps]
    if not to_upload:
        print("Semua file sudah ada di TeleDrive."); return

    print(f"{len(to_upload)} file akan diupload:")
    for p in to_upload:
        print(f"  - {p.name} ({human_size(p.stat().st_size)})")

    if args.dry_run:
        print("\n[DRY RUN] Tidak ada yang diupload."); return

    print()
    ok = fail = 0
    for p in to_upload:
        print(f"Mengupload {p.name} ...", end=" ", flush=True)
        try:
            upload(url, args.api_key, p); print("OK"); ok += 1
        except Exception as e:
            print(f"GAGAL ({e})"); fail += 1

    print(f"\nSelesai. Berhasil: {ok}, gagal: {fail}.")

if __name__ == "__main__":
    main()
