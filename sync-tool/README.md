# TeleDrive Sync Daemon

Script Python yang jalan di **background** seperti Google Drive Desktop:
- ⬆ File baru di folder lokal → otomatis upload ke TeleDrive (real-time, pakai watchdog)
- ⬇ File baru di TeleDrive → otomatis download ke folder lokal (polling tiap N detik)

## Install

```bash
pip install requests watchdog
```

## Jalankan

### Windows
```bat
python daemon.py --folder "C:\Users\Kamu\TeleDrive" --url https://nama-app.vercel.app --api-key PASSWORD
```

Untuk jalan di background tanpa jendela cmd:
```bat
pythonw daemon.py --folder "C:\Users\Kamu\TeleDrive" --url https://nama-app.vercel.app --api-key PASSWORD
```

### Linux / macOS
```bash
python3 daemon.py --folder ~/TeleDrive --url https://nama-app.vercel.app --api-key PASSWORD
```

Semua argumen:
```
--folder    Path folder lokal (dibuat otomatis kalau belum ada)
--url       URL Vercel deployment kamu
--api-key   Nilai APP_PASSWORD di environment variable Vercel
--interval  Jeda cek file baru dari cloud (detik, default: 30)
--log-file  Simpan log ke file (opsional, misal: --log-file sync.log)
```

## Otomatis jalan saat startup

### Windows — Task Scheduler

1. Buka **Task Scheduler** → **Create Basic Task**
2. Trigger: **At log on**
3. Action: **Start a program**
   - Program: `C:\Python312\pythonw.exe` (cek lokasi Python kamu dengan `where python`)
   - Arguments: 
     ```
     daemon.py --folder "C:\Users\Kamu\TeleDrive" --url https://nama-app.vercel.app --api-key PASSWORD --log-file "C:\Users\Kamu\teledrive-sync.log"
     ```
   - Start in: `C:\path\ke\sync-tool`
4. Klik Finish

### Linux — systemd

1. Edit file `teledrive-daemon.service`, ganti `USER`, path folder, URL, dan password
2. Salin ke systemd:
   ```bash
   sudo cp teledrive-daemon.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable teledrive-daemon
   sudo systemctl start teledrive-daemon
   ```
3. Cek status:
   ```bash
   sudo systemctl status teledrive-daemon
   journalctl -u teledrive-daemon -f
   ```

## Catatan penting

- Daemon memantau **1 level folder** (tidak rekursif ke subfolder) supaya sederhana
- File yang sedang diupload tidak akan di-download ulang (ada lock internal)
- Download file disimpan dulu sebagai `.tdtmp` sebelum di-rename ke nama asli — mencegah file corrupt kalau internet putus di tengah jalan
- Batas upload tetap **50MB per file** (limit Telegram Bot API)
- Konflik nama file (file berbeda isi, nama sama): versi lokal MENANG — file lokal tidak ditimpa kalau ukurannya berbeda dengan yang di cloud
