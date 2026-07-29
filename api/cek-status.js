// api/cek-status.js
// Endpoint: POST /api/cek-status
// Body (JSON): { "no_pendaftaran": "AMT-2026-00001", "pin": "482915" }
// Mengembalikan SELURUH data pendaftar (untuk tampilan read-only "seperti form
// pendaftaran, tapi tidak bisa diedit") jika No. Pendaftaran & PIN cocok.
// PIN dan id internal sengaja tidak diikutsertakan dalam respons demi keamanan.

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metode tidak diizinkan.' });
  }

  try {
    const body = req.body || {};
    const no = (body.no_pendaftaran || '').toString().trim().toUpperCase();
    const pin = (body.pin || '').toString().trim();

    if (!no || !pin) {
      return res.status(422).json({ success: false, message: 'No. Pendaftaran dan PIN wajib diisi.' });
    }

    const result = await sql`
      SELECT *
      FROM pendaftar_santri
      WHERE no_pendaftaran = ${no} AND pin = ${pin}
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nomor pendaftaran atau PIN tidak ditemukan.' });
    }

    const row = result.rows[0];
    const { pin: _pin, id: _id, ...publicData } = row; // jangan pernah mengembalikan PIN/id internal

    return res.status(200).json({
      success: true,
      ...publicData,
      mendaftar_di: `${row.jenis_pondok} · ${row.jenjang_pondok}`,
      status_label: row.status_label,
      current_step: row.current_step,
    });
  } catch (err) {
    console.error('[api/cek-status]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba lagi.' });
  }
}
