// ============================================================
//  MEA Portfolio CMS — Google Apps Script
//  Fungsi: baca data dari Sheets → commit data.json ke GitHub
//
//  SETUP (isi bagian CONFIG di bawah, jangan share ke siapapun):
//  1. Paste script ini di Apps Script (script.google.com)
//  2. Isi TOKEN, REPO_OWNER, REPO_NAME di bagian CONFIG
//  3. Klik "Run" → setupMenu() untuk tambah menu di Sheets
//  4. Klik menu "Portfolio CMS" → "Publish to GitHub"
// ============================================================

// ── CONFIG — HANYA KAMU YANG BOLEH LIHAT ──────────────────
var CONFIG = {
  TOKEN      : 'GANTI_DENGAN_GITHUB_TOKEN_KAMU',   // ghp_xxxxxxxxxxxx
  REPO_OWNER : 'vnz-desain',
  REPO_NAME  : 'Portofolio-CloudV2',
  FILE_PATH  : 'data.json',   // path file di repo
  BRANCH     : 'main'
};
// ──────────────────────────────────────────────────────────

/**
 * Jalankan fungsi ini SEKALI untuk setup menu di Spreadsheet.
 * Setelah itu menu "Portfolio CMS" muncul otomatis setiap buka Sheets.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Portfolio CMS')
    .addItem('🚀 Publish to GitHub', 'publishToGitHub')
    .addItem('👁 Preview JSON', 'previewJSON')
    .addToUi();
}

/**
 * Baca semua baris dari sheet "Data", konversi ke JSON,
 * lalu commit ke GitHub sebagai data.json
 */
function publishToGitHub() {
  var ui   = SpreadsheetApp.getUi();
  var data = readSheetData();

  if (data.length === 0) {
    ui.alert('❌ Tidak ada data di sheet "Data". Pastikan ada baris isi.');
    return;
  }

  var json    = JSON.stringify(data, null, 2);
  var success = commitToGitHub(json);

  if (success) {
    ui.alert('✅ Berhasil publish!\n\ndata.json sudah diupdate di GitHub.\nPortfolio akan update dalam beberapa detik.');
  } else {
    ui.alert('❌ Gagal publish. Cek TOKEN dan koneksi internet.\nLihat Logs (View → Logs) untuk detail error.');
  }
}

/**
 * Preview JSON hasil konversi tanpa upload ke GitHub
 */
function previewJSON() {
  var data = readSheetData();
  var json = JSON.stringify(data, null, 2);
  var ui   = SpreadsheetApp.getUi();
  // Tampilkan 1000 karakter pertama saja (alert terbatas)
  ui.alert('Preview JSON (' + data.length + ' items):\n\n' + json.substring(0, 1000) + (json.length > 1000 ? '\n...(truncated)' : ''));
}

// ── INTERNAL FUNCTIONS ─────────────────────────────────────

/**
 * Baca sheet bernama "Data", baris pertama = header, sisanya = data.
 * Kolom yang diharapkan (urutan tidak harus persis, nama kolom harus sama):
 *   tab | period | title | subtitle | desc | tags | founder
 *
 * Kolom "tags": pisahkan dengan koma, misal: "Leadership, Journalism, Broadcasting"
 * Kolom "founder": isi "true" atau biarkan kosong/false
 */
function readSheetData() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Data');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet bernama "Data" tidak ditemukan!\nBuat sheet baru dan namai "Data".');
    return [];
  }

  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0].map(function (h) { return h.toString().trim().toLowerCase(); });
  var result  = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];

    // Skip baris kosong (cek kolom title)
    var titleIdx = headers.indexOf('title');
    if (titleIdx === -1 || !row[titleIdx] || row[titleIdx].toString().trim() === '') continue;

    var item = {};

    headers.forEach(function (header, colIdx) {
      var val = row[colIdx] !== undefined ? row[colIdx].toString().trim() : '';

      if (header === 'tags') {
        // Split by comma, trim setiap tag
        item.tags = val ? val.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
      } else if (header === 'founder') {
        // Boolean: "true" / "TRUE" / "1" = true, selainnya false
        item.founder = (val.toLowerCase() === 'true' || val === '1');
      } else if (header !== '') {
        item[header] = val;
      }
    });

    result.push(item);
  }

  return result;
}

/**
 * Commit konten JSON ke file data.json di GitHub via API.
 * Kalau file sudah ada, update (butuh SHA). Kalau belum ada, create baru.
 */
function commitToGitHub(jsonContent) {
  var apiBase = 'https://api.github.com/repos/' + CONFIG.REPO_OWNER + '/' + CONFIG.REPO_NAME + '/contents/' + CONFIG.FILE_PATH;

  var headers = {
    'Authorization' : 'token ' + CONFIG.TOKEN,
    'Accept'        : 'application/vnd.github.v3+json',
    'Content-Type'  : 'application/json',
    'User-Agent'    : 'MEA-Portfolio-CMS'
  };

  // Step 1: Cek apakah file sudah ada (untuk dapat SHA)
  var sha = null;
  try {
    var getRes = UrlFetchApp.fetch(apiBase + '?ref=' + CONFIG.BRANCH, {
      method            : 'get',
      headers           : headers,
      muteHttpExceptions: true
    });

    if (getRes.getResponseCode() === 200) {
      var existing = JSON.parse(getRes.getContentText());
      sha = existing.sha;
      Logger.log('File sudah ada, SHA: ' + sha);
    } else {
      Logger.log('File belum ada, akan dibuat baru.');
    }
  } catch (e) {
    Logger.log('Error cek file: ' + e.message);
  }

  // Step 2: Encode konten ke Base64
  var encoded = Utilities.base64Encode(jsonContent, Utilities.Charset.UTF_8);

  // Step 3: Build payload
  var payload = {
    message : 'chore: update data.json via Sheets CMS [' + new Date().toISOString() + ']',
    content : encoded,
    branch  : CONFIG.BRANCH
  };
  if (sha) payload.sha = sha; // wajib ada kalau update

  // Step 4: PUT ke GitHub API
  try {
    var putRes = UrlFetchApp.fetch(apiBase, {
      method            : 'put',
      headers           : headers,
      payload           : JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = putRes.getResponseCode();
    Logger.log('GitHub API response: ' + code + ' — ' + putRes.getContentText().substring(0, 200));

    return (code === 200 || code === 201); // 200 = updated, 201 = created
  } catch (e) {
    Logger.log('Error commit: ' + e.message);
    return false;
  }
}
