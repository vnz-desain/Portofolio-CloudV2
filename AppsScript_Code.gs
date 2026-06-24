// ============================================================
//  MEA Portfolio CMS — Google Apps Script
//  Fungsi: baca data dari Sheets → push data.json ke GitHub
//
//  SETUP:
//  1. Paste script ini di Apps Script (script.google.com)
//  2. Isi TOKEN di bagian CONFIG
//  3. Run → onOpen → izinkan akses
// ============================================================

var CONFIG = {
  TOKEN      : 'GANTI_DENGAN_GITHUB_TOKEN_KAMU',  // ghp_xxxx
  REPO_OWNER : 'vnz-desain',
  REPO_NAME  : 'Portofolio-CloudV2',
  FILE_PATH  : 'data.json',
  BRANCH     : 'main'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Portfolio CMS')
    .addItem('🚀 Publish to GitHub', 'publishToGitHub')
    .addItem('👁 Preview JSON', 'previewJSON')
    .addToUi();
}

function publishToGitHub() {
  var ui   = SpreadsheetApp.getUi();
  var data = buildJSON();

  if (!data) return;

  var json    = JSON.stringify(data, null, 2);
  var success = commitToGitHub(json);

  if (success) {
    ui.alert('✅ Berhasil publish!\n\nPortfolio update dalam ~30 detik.');
  } else {
    ui.alert('❌ Gagal publish.\nCek TOKEN dan lihat View → Logs untuk detail.');
  }
}

function previewJSON() {
  var data = buildJSON();
  if (!data) return;
  var json = JSON.stringify(data, null, 2);
  SpreadsheetApp.getUi().alert('Preview (' + data.slides.length + ' slides):\n\n' + json.substring(0, 1200) + (json.length > 1200 ? '\n...' : ''));
}

// ── Build JSON dari semua sheet ──────────────────────────────

function buildJSON() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  /* Sheet "About" — bio dan tags */
  var aboutSheet = ss.getSheetByName('About');
  if (!aboutSheet) {
    ui.alert('Sheet "About" tidak ditemukan!');
    return null;
  }
  var bio  = aboutSheet.getRange('B2').getValue().toString().trim();
  var tags = aboutSheet.getRange('B3').getValue().toString()
               .split(',').map(function(t){ return t.trim(); }).filter(Boolean);

  /* Sheet "Data" — slides */
  var dataSheet = ss.getSheetByName('Data');
  if (!dataSheet) {
    ui.alert('Sheet "Data" tidak ditemukan!');
    return null;
  }

  var rows    = dataSheet.getDataRange().getValues();
  var headers = rows[0].map(function(h){ return h.toString().trim().toLowerCase(); });
  var slides  = [];

  for (var i = 1; i < rows.length; i++) {
    var row      = rows[i];
    var titleIdx = headers.indexOf('title');
    if (titleIdx === -1 || !row[titleIdx] || row[titleIdx].toString().trim() === '') continue;

    var item = {};
    headers.forEach(function(header, colIdx) {
      var val = row[colIdx] !== undefined ? row[colIdx].toString().trim() : '';
      if (header === 'tags') {
        item.tags = val ? val.split(',').map(function(t){ return t.trim(); }).filter(Boolean) : [];
      } else if (header === 'founder') {
        item.founder = (val.toLowerCase() === 'true' || val === '1');
      } else if (header !== '') {
        item[header] = val;
      }
    });
    slides.push(item);
  }

  return { bio: bio, tags: tags, slides: slides };
}

// ── GitHub commit ────────────────────────────────────────────

function commitToGitHub(jsonContent) {
  var apiBase = 'https://api.github.com/repos/' + CONFIG.REPO_OWNER + '/' + CONFIG.REPO_NAME + '/contents/' + CONFIG.FILE_PATH;
  var headers = {
    'Authorization': 'token ' + CONFIG.TOKEN,
    'Accept'       : 'application/vnd.github.v3+json',
    'Content-Type' : 'application/json',
    'User-Agent'   : 'MEA-Portfolio-CMS'
  };

  var sha = null;
  try {
    var getRes = UrlFetchApp.fetch(apiBase + '?ref=' + CONFIG.BRANCH, { method: 'get', headers: headers, muteHttpExceptions: true });
    if (getRes.getResponseCode() === 200) sha = JSON.parse(getRes.getContentText()).sha;
  } catch(e) { Logger.log('Cek file: ' + e.message); }

  var payload = {
    message: 'chore: update data.json [' + new Date().toISOString() + ']',
    content: Utilities.base64Encode(jsonContent, Utilities.Charset.UTF_8),
    branch : CONFIG.BRANCH
  };
  if (sha) payload.sha = sha;

  try {
    var putRes = UrlFetchApp.fetch(apiBase, { method: 'put', headers: headers, payload: JSON.stringify(payload), muteHttpExceptions: true });
    var code   = putRes.getResponseCode();
    Logger.log('GitHub response: ' + code);
    return (code === 200 || code === 201);
  } catch(e) {
    Logger.log('Commit error: ' + e.message);
    return false;
  }
}
