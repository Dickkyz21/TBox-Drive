# TeleDrive

TeleDrive adalah aplikasi drive pribadi/tim kecil yang memakai:

- **Vercel + Next.js** untuk dashboard web.
- **Telegram Bot API** sebagai penyimpanan file.
- **Upstash Redis** untuk index file, folder, perangkat, pengaturan, dan riwayat.
- **Desktop Client** untuk sync folder lokal Windows/Linux dengan server.

## Mulai Dari Sini

Panduan instalasi dan konfigurasi lengkap ada di:

[docs/INSTALLATION.md](docs/INSTALLATION.md)

## Screenshot

![Menu File](docs/screenshots/file-dashboard.svg)

Screenshot menu lain tersedia di bagian **Screenshot Menu** pada [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Alur Cepat

1. Buat bot Telegram dan group/channel storage.
2. Buat Upstash Redis.
3. Deploy project ke Vercel.
4. Isi environment variable:

   ```text
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   APP_PASSWORD
   ```

5. Login dashboard TeleDrive.
6. Isi Token Bot dan Chat ID dari menu Pengaturan.
7. Tambah perangkat dari menu Perangkat.
8. Download desktop client dan isi API key perangkat.
9. Klik ON/Start untuk sync.

## Multi User

Versi ini cocok untuk:

- 1 admin dengan banyak perangkat.
- 1 tim kecil memakai 1 storage bersama.
- Banyak user dengan masing-masing deployment sendiri.

Untuk model SaaS publik multi-tenant, project perlu ditambah sistem akun, workspace, dan storage terpisah per user.
