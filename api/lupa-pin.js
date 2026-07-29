// api/lupa-pin.js
// Endpoint: POST /api/lupa-pin
// Body (JSON): { "nik": "3320012345670001", "tanggal_lahir": "2012-05-14" }
// Dipakai oleh fitur "Lupa No. Pendaftaran / PIN?" — mencari data pendaftar
// berdasarkan NIK + Tanggal Lahir santri, lalu mengembalikan No. Pendaftaran & PIN-nya.
//
// RATE LIMITING: dibatasi 5 percobaan per menit per alamat IP, dicatat lewat tabel
// rate_limit_log di Postgres (bukan variabel in-memory) — karena Serverless Function
// di Vercel bisa berjalan di instance yang berbeda-beda tiap request, jadi variabel
// biasa di memori TIDAK bisa diandalkan untuk menghitung percobaan secara konsisten.
// Kalau nanti traffic besar dan butuh yang lebih cepat, pertimbangkan pindah ke
// Vercel KV (Redis) — pola kodenya mirip, tinggal ganti query SQL jadi perintah Redis.

import { sql } from '@vercel/postgres';

const RATE_LIMIT_MAX_ATTEMPTS = 5; // maksimal percobaan per menit per IP

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function checkRateLimit(identifier) {
  // Buang catatan lama (>1 jam) supaya tabel tidak membengkak — aman dijalankan tiap request.
  await sql`DELETE FROM rate_limit_log WHERE created_at < now() - interval '1 hour';`;

  const { rows } = await sql`
    SELECT COUNT(*)::int AS attempts
    FROM rate_limit_log
    WHERE endpoint = 'lupa-pin'
      AND identifier = ${identifier}
      AND created_at > now() - interval '1 minute';
  `;
  return rows[0].attempts;
}

async function logAttempt(identifier) {
  await sql`INSERT INTO rate_limit_log (endpoint, identifier) VALUES ('lupa-pin', ${identifier});`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metode tidak diizinkan.' });
  }

  const clientIp = getClientIp(req);

  try {
    const attempts = await checkRateLimit(clientIp);
    if (attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Terlalu banyak percobaan. Silakan coba lagi dalam 1 menit.',
      });
    }
  } catch (err) {
    // Kalau pengecekan rate limit sendiri gagal (mis. tabel belum dibuat), jangan sampai
    // seluruh endpoint ikut error — cukup catat di log server dan lanjutkan tanpa rate limit.
    console.error('[api/lupa-pin] rate limit check gagal:', err);
  }

  try {
    const body = req.body || {};
    const nik = (body.nik || '').toString().trim();
    const tanggalLahir = (body.tanggal_lahir || '').toString().trim(); // format YYYY-MM-DD

    if (!nik || !tanggalLahir) {
      return res.status(422).json({ success: false, message: 'NIK dan Tanggal Lahir wajib diisi.' });
    }

    await logAttempt(clientIp).catch((err) => console.error('[api/lupa-pin] gagal mencatat attempt:', err));

    const result = await sql`
      SELECT no_pendaftaran, pin, nama_lengkap
      FROM pendaftar_santri
      WHERE nik = ${nik} AND tanggal_lahir = ${tanggalLahir}
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data tidak ditemukan. Periksa kembali NIK dan tanggal lahir.',
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      no_pendaftaran: row.no_pendaftaran,
      pin: row.pin,
      nama_lengkap: row.nama_lengkap,
    });
  } catch (err) {
    console.error('[api/lupa-pin]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba lagi.' });
  }
}
