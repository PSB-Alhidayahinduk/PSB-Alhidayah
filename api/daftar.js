// api/daftar.js
// Endpoint: POST /api/daftar
// Menerima data formulir pendaftaran (multipart/form-data, termasuk file foto),
// mengunggah foto ke Vercel Blob, menyimpan datanya ke Postgres, lalu mengembalikan
// No. Pendaftaran & PIN yang dibuat otomatis.

import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import formidable from 'formidable';
import fs from 'fs';

// Wajib: matikan body parser bawaan Vercel supaya formidable bisa membaca stream multipart-nya sendiri.
export const config = {
  api: { bodyParser: false },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false, maxFileSize: 2 * 1024 * 1024 }); // maks 2MB per file
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function uploadFile(file, prefix) {
  if (!file) return null;
  const buffer = fs.readFileSync(file.filepath);
  const ext = (file.originalFilename || 'file.jpg').split('.').pop().toLowerCase();
  const blob = await put(`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, buffer, {
    access: 'public',
    contentType: file.mimetype || undefined,
  });
  return blob.url;
}

const BULAN = {
  Januari: 1, Februari: 2, Maret: 3, April: 4, Mei: 5, Juni: 6,
  Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metode tidak diizinkan.' });
  }

  try {
    const { fields, files } = await parseForm(req);
    const f = (key) => {
      const v = Array.isArray(fields[key]) ? fields[key][0] : fields[key];
      return (v || '').toString().trim();
    };

    const required = [
      'jenis_pondok', 'jenjang_pondok', 'nik', 'nama_lengkap', 'tempat_lahir',
      'tgl_lahir_tanggal', 'tgl_lahir_bulan', 'tgl_lahir_tahun', 'jenis_kelamin',
      'nama_ayah', 'nama_ibu', 'telepon_ortu',
    ];
    for (const key of required) {
      if (!f(key)) {
        return res.status(422).json({ success: false, message: `Field '${key}' wajib diisi.` });
      }
    }

    const bulanNum = BULAN[f('tgl_lahir_bulan')];
    if (!bulanNum) {
      return res.status(422).json({ success: false, message: 'Bulan lahir tidak valid.' });
    }
    const tanggalLahir = `${f('tgl_lahir_tahun')}-${String(bulanNum).padStart(2, '0')}-${f('tgl_lahir_tanggal').padStart(2, '0')}`;

    const fotoSantriFile = Array.isArray(files.foto_santri) ? files.foto_santri[0] : files.foto_santri;
    const fotoKkFile = Array.isArray(files.foto_kk) ? files.foto_kk[0] : files.foto_kk;
    const fotoSantriUrl = await uploadFile(fotoSantriFile, 'santri');
    const fotoKkUrl = await uploadFile(fotoKkFile, 'kk');

    const pin = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');

    // Insert dulu dengan no_pendaftaran sementara, lalu update memakai id (jamin unik & berurutan).
    const insertResult = await sql`
      INSERT INTO pendaftar_santri
        (no_pendaftaran, pin, jenis_pondok, jenjang_pondok, foto_santri, nisn, nik, nama_lengkap,
         tempat_lahir, tanggal_lahir, jenis_kelamin, sekolah_asal, jenjang_sekolah_asal, alamat,
         provinsi, kabupaten, kecamatan, kode_pos, nama_ayah, nik_ayah, pekerjaan_ayah, penghasilan_ayah,
         nama_ibu, nik_ibu, pekerjaan_ibu, penghasilan_ibu, status_rumah, telepon_ortu, foto_kk)
      VALUES
        ('PENDING', ${pin}, ${f('jenis_pondok')}, ${f('jenjang_pondok')}, ${fotoSantriUrl}, ${f('nisn')}, ${f('nik')}, ${f('nama_lengkap')},
         ${f('tempat_lahir')}, ${tanggalLahir}, ${f('jenis_kelamin')}, ${f('sekolah_asal')}, ${f('jenjang_sekolah_asal')}, ${f('alamat')},
         ${f('provinsi')}, ${f('kabupaten')}, ${f('kecamatan')}, ${f('kode_pos')}, ${f('nama_ayah')}, ${f('nik_ayah')}, ${f('pekerjaan_ayah')}, ${f('penghasilan_ayah')},
         ${f('nama_ibu')}, ${f('nik_ibu')}, ${f('pekerjaan_ibu')}, ${f('penghasilan_ibu')}, ${f('status_rumah')}, ${f('telepon_ortu')}, ${fotoKkUrl})
      RETURNING id;
    `;

    const id = insertResult.rows[0].id;
    const noPendaftaran = `AMT-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;

    await sql`UPDATE pendaftar_santri SET no_pendaftaran = ${noPendaftaran} WHERE id = ${id};`;

    return res.status(200).json({
      success: true,
      message: 'Pendaftaran berhasil disimpan.',
      no_pendaftaran: noPendaftaran,
      pin,
      nama_lengkap: f('nama_lengkap'),
    });
  } catch (err) {
    console.error('[api/daftar]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba lagi.' });
  }
}
