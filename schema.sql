-- ============================================================
-- Skema Database (PostgreSQL) — PSB Amtsilati - Registrasi Santri Baru
-- Untuk Vercel Postgres (berbasis Neon).
--
-- Cara menjalankan:
--   1. Buka dashboard Vercel -> project Anda -> tab "Storage" -> database Postgres Anda
--   2. Buka tab "Query" (atau connect via psql pakai connection string yang tersedia di sana)
--   3. Paste seluruh isi file ini lalu jalankan (Run)
-- ============================================================

CREATE TABLE IF NOT EXISTS pendaftar_santri (
  id SERIAL PRIMARY KEY,

  -- Identitas pendaftaran
  no_pendaftaran VARCHAR(20) UNIQUE NOT NULL,
  pin CHAR(6) NOT NULL,

  -- Mendaftar di
  jenis_pondok VARCHAR(20) NOT NULL,     -- 'Pondok Putra' / 'Pondok Putri'
  jenjang_pondok VARCHAR(10) NOT NULL,   -- 'MTs' / 'MA'

  -- Identitas Santri
  foto_santri TEXT,                      -- URL file di Vercel Blob
  nisn VARCHAR(10),
  nik VARCHAR(16) NOT NULL,
  nama_lengkap VARCHAR(150) NOT NULL,
  tempat_lahir VARCHAR(100) NOT NULL,
  tanggal_lahir DATE NOT NULL,
  jenis_kelamin VARCHAR(10) NOT NULL,    -- 'Laki-laki' / 'Perempuan'
  sekolah_asal VARCHAR(150),
  jenjang_sekolah_asal VARCHAR(20),
  alamat TEXT,
  provinsi VARCHAR(50),
  kabupaten VARCHAR(100),
  kecamatan VARCHAR(100),
  kode_pos VARCHAR(5),

  -- Identitas Orang Tua / Wali
  nama_ayah VARCHAR(150) NOT NULL,
  nik_ayah VARCHAR(16),
  pekerjaan_ayah VARCHAR(50),
  penghasilan_ayah VARCHAR(30),
  nama_ibu VARCHAR(150) NOT NULL,
  nik_ibu VARCHAR(16),
  pekerjaan_ibu VARCHAR(50),
  penghasilan_ibu VARCHAR(30),
  status_rumah VARCHAR(50),
  telepon_ortu VARCHAR(20) NOT NULL,
  foto_kk TEXT,                          -- URL file di Vercel Blob

  -- Status proses, dipakai fitur "Cek Status Pendaftaran".
  -- Tahapan (1-5) sesuai section Alur Pendaftaran di website:
  --   1 Isi Formulir, 2 Catat No. & PIN, 3 Konfirmasi, 4 Pembayaran, 5 Penempatan Kamar
  status_label VARCHAR(50) NOT NULL DEFAULT 'Pendaftaran Diterima',
  current_step SMALLINT NOT NULL DEFAULT 2,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_no_pin ON pendaftar_santri (no_pendaftaran, pin);

-- Trigger supaya updated_at otomatis terisi ulang saat baris diubah
-- (misalnya nanti panitia mengubah status_label / current_step lewat phpMyAdmin/dashboard).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at ON pendaftar_santri;
CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON pendaftar_santri
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Tabel rate limiting untuk endpoint yang rawan disalahgunakan
-- (dipakai oleh api/lupa-pin.js — 5 percobaan/menit per IP)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(50) NOT NULL,
  identifier VARCHAR(64) NOT NULL,  -- alamat IP pemanggil
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON rate_limit_log (endpoint, identifier, created_at);
