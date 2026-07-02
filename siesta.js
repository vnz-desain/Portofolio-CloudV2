/* ══ SIESTA — Asisten Pribadi Evan ═════════════════════
   Rule-based chatbot widget, standalone & embeddable
   Cukup taruh <script src=".../siesta.js"></script> di subdomain manapun
══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var SB_URL  = 'https://ocedszxukzrnmvrecrnx.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZWRzenh1a3pybm12cmVjcm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjI4ODAsImV4cCI6MjA5Nzg5ODg4MH0.fxgMdyZlbp0V20oSvI6ZgnZNgWFh4g0iHMI4SxYLkkE';

  var _knowledge   = [];
  var _isOpen      = false;
  var _hasGreeted  = false;
  var _sessionMsgs = [];

  /* ── Umur Evan dihitung otomatis dari tanggal lahir, bukan angka statis ──
     27 Desember 2006. Pakai floor tahun: 20 tahun 11 bulan tetap dibilang 20,
     baru naik ke 21 pas tanggal ulang tahunnya udah lewat di tahun berjalan. */
  var BIRTH_DATE = new Date(2006, 11, 27); // bulan 0-indexed, jadi 11 = Desember

  function calcAge() {
    var now = new Date();
    var age = now.getFullYear() - BIRTH_DATE.getFullYear();
    var hasHadBirthdayThisYear =
      now.getMonth() > BIRTH_DATE.getMonth() ||
      (now.getMonth() === BIRTH_DATE.getMonth() && now.getDate() >= BIRTH_DATE.getDate());
    if (!hasHadBirthdayThisYear) age -= 1;
    return age;
  }

  /* ── Ganti placeholder dinamis di response sebelum ditampilkan ── */
  function resolvePlaceholders(text) {
    return text.replace(/\{\{AGE\}\}/g, calcAge());
  }

  /* ── Fetch knowledge ── */
  function loadKnowledge() {
    return fetch(SB_URL + '/rest/v1/bot_knowledge?select=*&order=sort_order.asc', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON }
    })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) { _knowledge = data; })
      .catch(function (err) { console.error('[Siesta] Gagal load knowledge:', err); _knowledge = []; });
  }

  /* ── Kamus normalisasi: alias/typo umum → kata baku ──
     Tambahin di sini kalau nemu variasi baru yang sering diketik user */
  var SYNONYMS = {
    'skil': 'skill', 'skiil': 'skill', 'kemampuannya': 'kemampuan',
    'proyeknya': 'proyek', 'projeknya': 'proyek', 'projects': 'project',
    'kolab': 'kolaborasi', 'collab': 'kolaborasi', 'kerjasama': 'kerja sama',
    'ig': 'instagram', 'yt': 'youtube', 'gh': 'github', 'medsos': 'social media',
    'sosmed': 'social media', 'fotonya': 'foto', 'galerinya': 'gallery',
    'galeri': 'gallery', 'lagunya': 'lagu', 'musiknya': 'musik',
    'evn': 'evan', 'evann': 'evan', 'org': 'orang', 'gmn': 'gimana',
    'knp': 'kenapa', 'dmn': 'dimana', 'yg': 'yang', 'gk': 'gak', 'ga': 'gak',
    'tdk': 'tidak', 'jd': 'jadi', 'utk': 'untuk', 'trmksh': 'terima kasih',
    'mksh': 'terima kasih', 'thx': 'terima kasih', 'siapasih': 'siapa sih'
  };

  var STOPWORDS = ['yang','apa','itu','ini','di','ke','dari','dan','atau',
    'sih','dong','deh','ya','yah','kah','nya','saya','aku','kamu','lo','gue',
    'the','a','an','is','are','of','to'];

  /* ── Normalisasi teks: lowercase, hapus tanda baca, terapkan sinonim ── */
  function normalizeText(str) {
    var cleaned = str
      .toLowerCase()
      .replace(/[^\w\sà-ÿ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    var words = cleaned.split(' ').map(function (w) {
      return SYNONYMS[w] || w;
    });

    return words.join(' ');
  }

  function tokenize(str) {
    return normalizeText(str).split(' ').filter(function (w) {
      return w.length > 0 && STOPWORDS.indexOf(w) === -1;
    });
  }

  /* ── Levenshtein distance ringan, buat toleransi typo ── */
  function levenshtein(a, b) {
    if (a === b) return 0;
    var al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    var prev = new Array(bl + 1);
    for (var j = 0; j <= bl; j++) prev[j] = j;
    for (var i = 1; i <= al; i++) {
      var cur = [i];
      for (var k = 1; k <= bl; k++) {
        var cost = a[i - 1] === b[k - 1] ? 0 : 1;
        cur[k] = Math.min(
          prev[k] + 1,      // hapus
          cur[k - 1] + 1,   // sisip
          prev[k - 1] + cost // substitusi
        );
      }
      prev = cur;
    }
    return prev[bl];
  }

  /* Cek apakah token user cocok dengan token keyword, exact atau typo-tolerant */
  function tokenMatches(userToken, kwToken) {
    if (userToken === kwToken) return 1;
    if (kwToken.length >= 4 && userToken.length >= 4) {
      var maxDist = kwToken.length <= 5 ? 1 : 2;
      if (levenshtein(userToken, kwToken) <= maxDist) return 0.75;
    }
    // substring untuk frasa multi-kata yang mengandung spasi (keyword tetap dicek utuh terpisah)
    return 0;
  }

  /* ── Log pertanyaan yang gagal / lemah match (buat riset knowledge gap) ──
     Fire-and-forget: tidak menunggu response, tidak mengganggu UI kalau gagal kirim */
  function logFallback(question, matchedCategory, score) {
    try {
      fetch(SB_URL + '/rest/v1/bot_fallback_logs', {
        method: 'POST',
        headers: {
          apikey: SB_ANON,
          Authorization: 'Bearer ' + SB_ANON,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          question: question,
          matched_category: matchedCategory,
          match_score: score
        })
      }).catch(function () { /* diam-diam gagal, gak masalah */ });
    } catch (e) { /* diam-diam gagal, gak masalah */ }
  }

  var _lastCategory = null;

  /* ── Matcher utama ──
     - Tokenisasi + normalisasi input & keyword
     - Skor akumulatif per item (bukan cuma keyword terpanjang)
     - Bonus untuk match frasa penuh (multi-kata keyword ketemu berurutan)
     - Toleransi typo ringan via Levenshtein
     - Fallback ke context (topik terakhir) kalau skor tipis tapi ada nyambung dikit
  */
  function findResponse(input) {
    var normalizedFull = normalizeText(input);
    var userTokens = tokenize(input);

    if (userTokens.length === 0) {
      var fbEmpty = _knowledge.find(function (k) { return k.category === 'fallback'; });
      return resolvePlaceholders(fbEmpty ? fbEmpty.response : 'Hmm, aku belum nangkep maksudnya nih 🌙');
    }

    var best = null;
    var bestScore = 0;
    var bestIsWeak = false;

    for (var i = 0; i < _knowledge.length; i++) {
      var item = _knowledge[i];
      if (item.category === 'fallback') continue;
      var kws = item.keywords || [];
      var itemScore = 0;

      for (var j = 0; j < kws.length; j++) {
        var kwRaw = (kws[j] || '').toLowerCase().trim();
        if (!kwRaw) continue;

        // Frasa penuh (mengandung spasi): cek muncul utuh di teks yang sudah dinormalisasi
        if (kwRaw.indexOf(' ') !== -1) {
          if (normalizedFull.indexOf(kwRaw) !== -1) {
            itemScore += kwRaw.length * 1.5; // bonus frasa spesifik
          }
          continue;
        }

        // Keyword satu kata: cocokkan ke tiap token user (exact / typo-tolerant)
        var kwToken = SYNONYMS[kwRaw] || kwRaw;
        for (var t = 0; t < userTokens.length; t++) {
          var m = tokenMatches(userTokens[t], kwToken);
          if (m > 0) {
            itemScore += kwRaw.length * m;
            break; // satu keyword cukup dihitung sekali per item
          }
        }
      }

      if (itemScore > bestScore) {
        bestScore = itemScore;
        best = item;
      }
    }

    // Threshold: skor terlalu tipis (kemungkinan typo-fluke) dianggap gak match
    var MIN_SCORE = 3;

    if (best && bestScore >= MIN_SCORE) {
      _lastCategory = best.category;
      return resolvePlaceholders(best.response);
    }

    // Skor lemah tapi ada sedikit sinyal → coba nyambung ke topik obrolan sebelumnya
    if (best && bestScore > 0 && _lastCategory) {
      logFallback(input, best.category, bestScore);
      var contextItem = _knowledge.find(function (k) { return k.category === _lastCategory; });
      if (contextItem) return resolvePlaceholders(contextItem.response);
    }

    logFallback(input, best ? best.category : null, bestScore);
    var fb = _knowledge.find(function (k) { return k.category === 'fallback'; });
    return resolvePlaceholders(fb ? fb.response : 'Maaf, Evan belum memberitahu saya mengenai hal itu, jadi saya belum bisa menjawab.');
  }

  function greetingResponse() {
    var g = _knowledge.find(function (k) { return k.category === 'greeting'; });
    return resolvePlaceholders(g ? g.response : 'Halo... Aku Siesta 🌙 Kalau penasaran tentang Evan, tinggal tanya aku aja yah.');
  }

  /* ── Build DOM ── */
  function buildWidget() {
    var root = document.createElement('div');
    root.className = 'siesta-root';
    root.innerHTML = [
      '<button class="siesta-bubble" id="siestaBubble" aria-label="Buka chat Siesta">',
      '  <span class="siesta-notif" id="siestaNotif"></span>',
      '  <span class="siesta-chat-icon"><img src="/images/asisten.webp" alt="Siesta" /></span>',
      '  <svg class="siesta-close-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      '</button>',

      '<div class="siesta-window" id="siestaWindow" role="dialog" aria-label="Chat dengan Siesta">',
      '  <div class="siesta-header">',
      '    <div class="siesta-avatar"><img src="/images/asisten.webp" alt="Siesta" /></div>',
      '    <div class="siesta-header-info">',
      '      <div class="siesta-name">SIESTA</div>',
      '      <div class="siesta-status">Asisten Evan</div>',
      '    </div>',
      '  </div>',
      '  <div class="siesta-messages" id="siestaMessages"></div>',
      '  <div class="siesta-quick-wrap" id="siestaQuick"></div>',
      '  <div class="siesta-input-wrap">',
      '    <input class="siesta-input" id="siestaInput" type="text" placeholder="Tanya sesuatu tentang Evan..." autocomplete="off" />',
      '    <button class="siesta-send" id="siestaSend" aria-label="Kirim">',
      '      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
      '    </button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(root);
    return root;
  }

  /* ── Message rendering ── */
  function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
  }

  function timeNow() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function addMessage(container, text, sender) {
    var msg = document.createElement('div');
    msg.className = 'siesta-msg ' + sender;
    msg.innerHTML =
      '<div class="siesta-msg-bubble"></div>' +
      '<span class="siesta-msg-time">' + timeNow() + '</span>';
    msg.querySelector('.siesta-msg-bubble').textContent = text;
    container.appendChild(msg);
    scrollToBottom(container);
    _sessionMsgs.push({ text: text, sender: sender });
  }

  function showTyping(container) {
    var typing = document.createElement('div');
    typing.className = 'siesta-msg bot siesta-typing';
    typing.id = 'siestaTypingIndicator';
    typing.innerHTML =
      '<div class="siesta-msg-bubble"><span class="siesta-dot"></span><span class="siesta-dot"></span><span class="siesta-dot"></span></div>';
    container.appendChild(typing);
    scrollToBottom(container);
  }

  function hideTyping(container) {
    var t = container.querySelector('#siestaTypingIndicator');
    if (t) t.remove();
  }

  function botReply(container, text) {
    showTyping(container);
    var delay = Math.min(400 + text.length * 8, 1400);
    setTimeout(function () {
      hideTyping(container);
      addMessage(container, text, 'bot');
    }, delay);
  }

  /* ── Quick replies ── */
  var QUICK_REPLIES = [
    { label: 'Siapa Evan?', text: 'siapa evan' },
    { label: 'Skill Evan',  text: 'skill evan' },
    { label: 'Proyeknya',   text: 'proyek evan' },
    { label: 'Kontak',      text: 'kontak' }
  ];

  function renderQuickReplies(wrap, container, inputEl) {
    wrap.innerHTML = '';
    QUICK_REPLIES.forEach(function (q) {
      var btn = document.createElement('button');
      btn.className = 'siesta-quick';
      btn.textContent = q.label;
      btn.addEventListener('click', function () {
        handleUserInput(q.text, container);
        wrap.style.display = 'none'; // sembunyi setelah dipakai
      });
      wrap.appendChild(btn);
    });
  }

  /* ── Handle send ── */
  function handleUserInput(text, container) {
    if (!text.trim()) return;
    addMessage(container, text, 'user');
    var reply = findResponse(text);
    botReply(container, reply);
  }

  /* ── Init widget behavior ── */
  function initWidget() {
    var bubble   = document.getElementById('siestaBubble');
    var win      = document.getElementById('siestaWindow');
    var messages = document.getElementById('siestaMessages');
    var quick    = document.getElementById('siestaQuick');
    var input    = document.getElementById('siestaInput');
    var send     = document.getElementById('siestaSend');
    var notif    = document.getElementById('siestaNotif');

    function toggleOpen() {
      _isOpen = !_isOpen;
      bubble.classList.toggle('open', _isOpen);
      win.classList.toggle('open', _isOpen);
      if (notif) notif.style.display = 'none';

      if (_isOpen && !_hasGreeted) {
        _hasGreeted = true;
        setTimeout(function () {
          botReply(messages, greetingResponse());
          renderQuickReplies(quick, messages, input);
        }, 300);
      }
      if (_isOpen) setTimeout(function () { input.focus(); }, 320);
    }

    bubble.addEventListener('click', toggleOpen);

    function trySend() {
      var val = input.value;
      if (!val.trim()) return;
      handleUserInput(val, messages);
      input.value = '';
      quick.style.display = 'none';
    }

    send.addEventListener('click', trySend);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') trySend();
    });

    // Auto show notif dot setelah beberapa detik (menarik perhatian pertama kali)
    setTimeout(function () {
      if (!_isOpen && notif) notif.style.display = 'block';
    }, 2500);
  }

  /* ── Load CSS otomatis kalau belum ada ── */
  function ensureCSS() {
    if (document.getElementById('siesta-css-link')) return;
    var thisScript = document.currentScript || (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();
    var base = thisScript && thisScript.src
      ? thisScript.src.replace(/siesta\.js.*$/, '')
      : '';
    var link = document.createElement('link');
    link.id  = 'siesta-css-link';
    link.rel = 'stylesheet';
    link.href = base + 'siesta.css';
    document.head.appendChild(link);
  }

  /* ── Bootstrap ── */
  function boot() {
    ensureCSS();
    buildWidget();
    initWidget();
    loadKnowledge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
