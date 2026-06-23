# 📋 Panduan Setup Portfolio CMS
**Google Sheets → Apps Script → GitHub → Portfolio**

---

## Step 1 — Upload file ke GitHub repo

Upload 2 file ini ke root repo `Portofolio-CloudV2`:

| File | Keterangan |
|------|-----------|
| `data.json` | Data awal Education & Venture |
| `script.js` | Ganti script.js yang lama |

Cara upload:
1. Buka `github.com/vnz-desain/Portofolio-CloudV2`
2. Klik **Add file → Upload files**
3. Drag kedua file → **Commit changes**

---

## Step 2 — Buat Google Spreadsheet

1. Buka `sheets.google.com` → buat spreadsheet baru
2. Rename sheet pertama jadi **`Data`** (klik kanan tab → Rename)
3. Buat header di **baris 1** persis seperti ini (copy paste):

```
tab | period | title | subtitle | desc | tags | founder
```

Contoh isi data (baris 2 dst):

| tab | period | title | subtitle | desc | tags | founder |
|-----|--------|-------|----------|------|------|---------|
| Education | 2023 — 2026 | MAN 2 Kota Cirebon | Multimedia Major | Studying at... | Multimedia, Video Production | false |
| Venture | 2025 — Present | MEA Ecosystem | Platform · Founder & Builder | MEA Ecosystem is... | Platform Development, Web Services | true |

> **Kolom tags:** pisah pakai koma, misal: `Leadership, Journalism, Broadcasting`  
> **Kolom founder:** isi `true` untuk Venture, biarkan kosong atau `false` untuk Education

---

## Step 3 — Setup Apps Script

1. Di Spreadsheet, klik menu **Extensions → Apps Script**
2. Hapus semua kode yang ada
3. **Copy-paste** seluruh isi file `AppsScript_Code.gs`
4. **PENTING:** Isi bagian CONFIG di baris paling atas:

```javascript
var CONFIG = {
  TOKEN      : 'ghp_XXXXXXXXXXXXXXXX',  // ← token GitHub kamu
  REPO_OWNER : 'vnz-desain',            // ← sudah benar
  REPO_NAME  : 'Portofolio-CloudV2',    // ← sudah benar
  FILE_PATH  : 'data.json',
  BRANCH     : 'main'
};
```

5. Klik **Save** (Ctrl+S)
6. Klik **Run** → pilih fungsi `onOpen` → klik **Run**
7. Izinkan akses ketika diminta (klik Allow)

---

## Step 4 — Test publish pertama

1. Kembali ke Spreadsheet (tab browser Sheets)
2. **Refresh halaman** — sekarang ada menu baru **"Portfolio CMS"** di menu bar
3. Klik **Portfolio CMS → 👁 Preview JSON** dulu untuk cek data sudah benar
4. Kalau oke, klik **Portfolio CMS → 🚀 Publish to GitHub**
5. Tunggu alert "✅ Berhasil publish!"

---

## Cara tambah slide baru (sehari-hari)

Cukup:
1. Buka Spreadsheet
2. Tambah baris baru di bawah
3. Isi kolom sesuai format
4. Klik **Portfolio CMS → 🚀 Publish to GitHub**
5. Selesai! Portfolio update otomatis dalam ~30 detik

---

## Troubleshooting

**❌ "Gagal publish"**
- Cek TOKEN sudah diisi dengan benar (tidak ada spasi/kutip ekstra)
- Pastikan scope token `public_repo` sudah dicentang
- Cek di Apps Script: **View → Logs** untuk detail error

**❌ Portfolio masih loading / tidak update**
- Cek file `data.json` sudah ada di repo GitHub
- Coba hard refresh browser: `Ctrl+Shift+R`
- GitHub Pages butuh ~1-2 menit untuk deploy setelah commit

**❌ Menu "Portfolio CMS" tidak muncul**
- Refresh Spreadsheet
- Atau jalankan manual: Apps Script → Run → `onOpen`

---

## Struktur file di repo setelah setup

```
Portofolio-CloudV2/
├── index.html       ← tidak diubah
├── style.css        ← tidak diubah  
├── script.js        ← GANTI dengan yang baru (fetch data.json)
├── data.json        ← BARU — sumber data dari Sheets
├── images/
│   └── ...
└── robots.txt
```
