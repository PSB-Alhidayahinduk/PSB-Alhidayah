# Panduan Deploy Website & Backend PSB Amtsilati ke Vercel

Backend ini pakai **Vercel Serverless Functions (Node.js)** + **Vercel Postgres** (database) + **Vercel Blob** (penyimpanan foto upload) — semuanya bisa diaktifkan langsung dari dashboard Vercel Anda, tanpa perlu server/hosting tambahan.

## Struktur folder (sudah tersusun di dalam ZIP ini)
```
psb-amtsilati/
├── index.html          <- halaman utama website
├── package.json        <- daftar dependency backend
├── schema.sql           <- struktur database (jalankan sekali di awal)
└── api/
    ├── daftar.js         <- terima & simpan data pendaftaran (Pondok & MI)
    ├── cek-status.js     <- cek status pendaftaran (No. Pendaftaran + PIN)
    └── lupa-pin.js       <- pemulihan No. Pendaftaran/PIN (via NIK + Tgl Lahir)
```

## 1. Buat/siapkan project di Vercel
- Kalau project Anda sudah ada di Vercel (dari GitHub misalnya), cukup upload seluruh isi folder ini ke root project, lalu push.
- Kalau belum ada, termudah lewat Vercel CLI dari dalam folder hasil ekstrak ZIP ini:
  ```
  npm i -g vercel
  vercel login
  vercel
  ```
  Ikuti instruksi di terminal (pilih "Other" sebagai framework saat ditanya).

## 2. Aktifkan Vercel Postgres
1. Buka [vercel.com/dashboard](https://vercel.com/dashboard) → pilih project Anda.
2. Buka tab **Storage** → **Create Database** → pilih **Postgres**.
3. Beri nama, pilih region terdekat (misal Singapore), klik **Create**.
4. Setelah dibuat, klik **Connect Project** agar environment variable (`POSTGRES_URL`, dll) otomatis ditambahkan ke project Anda.

## 3. Jalankan schema.sql
1. Masih di tab **Storage**, buka database Postgres yang baru dibuat.
2. Cari tab **Query** (query editor bawaan dashboard Vercel).
3. Buka file `schema.sql` di folder ini, salin seluruh isinya, tempel di query editor, lalu **Run**.
4. Pastikan muncul tabel `pendaftar_santri` (bisa dicek di tab "Data"/"Tables").

## 4. Aktifkan Vercel Blob (untuk upload foto)
1. Masih di tab **Storage** → **Create Database** → pilih **Blob**.
2. Beri nama, klik **Create**, lalu **Connect Project** — environment variable `BLOB_READ_WRITE_TOKEN` otomatis ditambahkan.

## 5. Deploy
```
vercel --prod
```
(atau otomatis ter-deploy tiap Anda push ke branch utama, jika project sudah terhubung ke GitHub).

Vercel akan otomatis menjalankan `npm install` untuk memasang `@vercel/postgres`, `@vercel/blob`, dan `formidable` yang tercantum di `package.json`.

## 6. Cek koneksi ke frontend
Di `index.html`, cari baris berikut di bagian `<script>` paling bawah — **sudah di-set otomatis ke `/api/`** karena halaman dan API berada di domain Vercel yang sama (tidak perlu isi manual, tidak ada masalah CORS):
```js
const API_BASE_URL = '/api/';
```

## 7. Uji coba
1. Buka `https://nama-project-anda.vercel.app`.
2. Isi & kirim **Form Pendaftaran** (tab DAFTAR maupun DAFTAR MI) → No. Pendaftaran & PIN asli (dibuat otomatis server) akan muncul di kotak hijau.
3. Coba tab **Cek Status Pendaftaran** memakai No. Pendaftaran & PIN tersebut → akan tampil detail lengkap read-only (identitas santri + orang tua).
4. Coba juga fitur **"Lupa No. Pendaftaran / PIN?"** dengan NIK + tanggal lahir yang baru saja didaftarkan.
5. Cek isi tabel `pendaftar_santri` lewat tab **Data** di dashboard Vercel Postgres untuk memastikan data benar-benar masuk, termasuk link foto yang tersimpan di Vercel Blob.

## Ringkasan endpoint API
| Endpoint | Fungsi |
|---|---|
| `POST /api/daftar` | Simpan data pendaftaran baru, generate No. Pendaftaran + PIN |
| `POST /api/cek-status` | Ambil seluruh data pendaftar by No. Pendaftaran + PIN |
| `POST /api/lupa-pin` | Cari No. Pendaftaran + PIN by NIK + Tanggal Lahir |

## Batasan yang perlu diketahui
- Ukuran file upload dibatasi 5MB per file (bisa diubah di `api/daftar.js`, cari `maxFileSize`). Vercel sendiri membatasi ukuran body request ke Serverless Function (biasanya 4.5MB di paket Hobby) — cukup untuk foto 3x4 dan scan KK, tapi kalau nanti sering gagal karena file besar, pertimbangkan paket Vercel berbayar atau alur upload langsung ke Blob dari browser (client-side upload).
- Captcha saat ini baru divalidasi di sisi browser (JavaScript), belum di sisi server — cukup untuk mencegah bot sederhana, tapi bukan proteksi tingkat tinggi.
- `/api/lupa-pin` sudah dibatasi **5 percobaan per menit per IP** (dicatat lewat tabel `rate_limit_log` di Postgres). Kalau Anda sudah pernah menjalankan `schema.sql` versi sebelumnya, jalankan ulang file `schema.sql` yang baru ini sekali lagi di query editor — aman diulang (pakai `CREATE TABLE IF NOT EXISTS`), akan otomatis menambahkan tabel `rate_limit_log` tanpa mengubah data yang sudah ada.
- Menu BROSUR (tombol download PDF) masih mengarah ke file placeholder `brosur-depan.pdf` / `brosur-belakang.pdf` — ganti dengan file PDF asli Anda.
