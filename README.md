# TeleDrive Simple

Versi simple dari [TeleDrive](https://github.com/ShUBHaMJHA9/Teledrive) yang dirancang khusus untuk berjalan di **Vercel** (serverless), memakai **Telegram Bot API** sebagai storage dan **Redis (Upstash)** sebagai index ringan metadata file.

> File fisik 100% disimpan di Telegram (channel/grup kamu). Redis hanya menyimpan nama, ukuran, dan pointer ke file — bukan isi file itu sendiri.

---

## ✨ Fitur

- Upload file (drag & drop atau klik), progress bar per file
- List file dalam grid, dengan pencarian nama
- Download file (di-proxy lewat server, nama file tetap rapi)
- Hapus file (terhapus dari Telegram & index)
- Password gate sederhana (satu password untuk seluruh akses)

## ⚠️ Yang berbeda dari TeleDrive asli

Karena Vercel itu serverless (tidak ada server yang nyala terus), beberapa fitur TeleDrive asli **tidak** ada di versi ini:

| Fitur TeleDrive asli | Status di versi ini |
|---|---|
| Login OTP Telegram multi-akun | ❌ Diganti 1 password tunggal |
| Folder & subfolder | ❌ Semua file flat (1 level) |
| Sync otomatis dari channel/grup Telegram | ❌ Tidak ada |
| Chunked upload paralel besar | ⚠️ Upload biasa, maks **50MB/file** (limit resmi Bot API) |
| Compress/extract ZIP di server | ❌ Tidak ada |
| Public share link | ❌ Tidak ada (bisa ditambah nanti) |
| Preview inline (video/gambar/PDF) | ❌ Tidak ada (download langsung) |

Semua ini bisa ditambahkan belakangan kalau dibutuhkan — versi ini fokus ke inti: **upload, lihat, download, hapus**.

---

## 🚀 Setup

### 1. Buat Bot Telegram

1. Chat [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot`, ikuti instruksinya
3. Simpan **Bot Token** yang diberikan (formatnya: `123456789:AAExxxxx...`)

### 2. Siapkan Channel/Grup sebagai Storage

1. Buat channel atau grup baru di Telegram (bisa privat)
2. Tambahkan bot kamu sebagai **admin** di channel/grup itu (wajib, supaya bot bisa kirim & hapus pesan)
3. Dapatkan **Chat ID**:
   - Channel publik: pakai `@namachannel` langsung
   - Channel/grup privat: kirim pesan apa saja ke channel itu, lalu buka `https://api.telegram.org/bot<TOKEN>/getUpdates` di browser, cari `"chat":{"id":-100...}` — angka itu Chat ID-nya (biasanya dimulai `-100`)

### 3. Clone & install

```bash
git clone <repo-ini>
cd teledrive-simple
npm install
```

### 4. Isi environment variable

```bash
cp .env.example .env
```

Edit `.env`:

```
TELEGRAM_BOT_TOKEN=123456789:AAExxxxx...
TELEGRAM_CHAT_ID=-1001234567890
APP_PASSWORD=password-rahasia-kamu
```

> `APP_PASSWORD` opsional. Kalau dikosongkan, aplikasi bisa diakses tanpa login — **tidak disarankan** kalau di-deploy publik.

### 5. Jalankan lokal

```bash
npm run dev
```

Buka `http://localhost:3000`.

> Catatan: tanpa Redis (Upstash) terhubung, fitur list/upload akan error saat development lokal kecuali kamu set `KV_REST_API_URL` dan `KV_REST_API_TOKEN` (lihat langkah 7) — bisa didapat dengan `vercel env pull .env.local` setelah integrasi terpasang di dashboard.

---

## ☁️ Deploy ke Vercel

### 6. Push ke GitHub & import ke Vercel

1. Push project ini ke repo GitHub kamu
2. Buka [vercel.com/new](https://vercel.com/new), import repo tersebut
3. Vercel otomatis mendeteksi framework Next.js — tidak perlu ubah build setting apa pun

### 7. Tambahkan Redis (Upstash) untuk index file

> Vercel KV sudah dipensiunkan — penggantinya adalah integrasi **Redis (Upstash)** dari Vercel Marketplace. Cara pasangnya mirip, cuma beda nama menu.

1. Di dashboard project Vercel → tab **Storage** → **Marketplace Database** → cari **Redis** (disediakan oleh Upstash) → **Install** / **Create**
2. Setelah dibuat, hubungkan ke project ini (biasanya otomatis ditawarkan saat instalasi)
3. Vercel otomatis menambahkan environment variable `KV_REST_API_URL` dan `KV_REST_API_TOKEN` ke project — tidak perlu diisi manual

### 8. Tambahkan environment variable lainnya

Di project Vercel → **Settings** → **Environment Variables**, tambahkan:

```
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
APP_PASSWORD
```

(nilainya sama seperti di `.env` lokal kamu)

### 9. Deploy

Klik **Deploy** (atau push ulang ke branch utama kalau sudah pernah deploy). Selesai — aplikasi langsung bisa diakses di domain `*.vercel.app` yang diberikan.

---

## 🗂️ Struktur Project

```
app/
├── page.tsx                      # Halaman utama (Drive)
├── login/page.tsx                # Halaman login password
├── api/
│   ├── login/route.ts            # Set cookie session
│   ├── logout/route.ts           # Hapus cookie session
│   ├── files/route.ts            # GET daftar file (dari KV)
│   ├── upload/route.ts           # POST upload file ke Telegram + simpan index
│   └── file/[id]/
│       ├── download/route.ts     # Proxy download dari Telegram
│       └── delete/route.ts       # Hapus pesan Telegram + hapus index
├── globals.css
└── layout.tsx

components/
├── Drive.tsx                     # State management utama (client)
├── Header.tsx                    # Header + status koneksi + logout
├── Dropzone.tsx                  # Upload area + progress bar
├── FileGrid.tsx                  # Grid file + search
├── FileCard.tsx                  # Kartu file individual + aksi
└── FileIcon.tsx                  # Ikon per kategori file

lib/
├── telegram.ts                   # Wrapper Telegram Bot API
├── store.ts                      # Index metadata di Redis (Upstash)
├── auth.ts                       # Helper password & cookie
└── format.ts                     # Format ukuran/tanggal/kategori file

middleware.ts                     # Gate semua route dengan password
```

---

## 🔒 Keamanan

- Bot Token & Chat ID hanya ada di server (environment variable), tidak pernah terkirim ke browser
- Password disimpan sebagai cookie `httpOnly` (tidak bisa dibaca JavaScript di browser)
- Download di-proxy lewat server kamu, jadi URL asli `api.telegram.org` tidak terekspos ke pengguna akhir

## 🧩 Batasan teknis penting

- **50MB per file** — ini batas resmi Telegram Bot API untuk upload via bot (bukan batasan dari kode ini)
- Tanpa integrasi Redis (Upstash) terhubung, aplikasi tidak akan bisa menampilkan atau menyimpan daftar file
- Bot harus **admin** di channel/grup tujuan, atau upload akan gagal dengan error dari Telegram
