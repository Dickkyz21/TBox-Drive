# Build TeleDrive Desktop Client

`desktop_client.py` dibuat dengan Python standard library. Setelah dibundle,
user Windows/Linux tidak perlu install Python package tambahan.

Download dari halaman Perangkat memakai endpoint `/api/desktop-client`, sehingga
Server URL otomatis terisi sesuai domain deploy.

## Windows

Jalankan dari mesin Windows:

```powershell
$env:TELEDRIVE_SERVER_URL="https://domain-teledrive.vercel.app"
.\sync-tool\package-desktop.ps1
```

Output:

```text
dist\TeleDrive.exe
```

File `.exe` ini bisa dibagikan ke user. Saat pertama dibuka, user isi API key
perangkat dan pilih folder lokal.

## Linux

Jalankan dari mesin Linux:

```bash
TELEDRIVE_SERVER_URL="https://domain-teledrive.vercel.app" \
./sync-tool/package-desktop.sh
```

Output:

```text
dist/teledrive
```

## Catatan

- App memakai endpoint `/api/clients/connect` untuk validasi API key dan mengambil
  device id otomatis.
- App melakukan polling folder setiap 30 detik. Ini sengaja dipilih agar tidak
  membutuhkan dependency `watchdog`.
- Jika deploy masih di Vercel, upload web/API besar tetap mengikuti batas request
  body Vercel. Untuk file besar, gunakan backend upload non-Vercel atau desain
  chunk upload.
- Untuk user akhir, distribusikan binary hasil build, bukan file `.py`.
