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

  /* ── Karakter Siesta (dipakai di bubble & avatar header) ── */
  var SIESTA_CHAR_SVG =
    '<svg class="siesta-char-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><clipPath id="siestaClip"><circle cx="50" cy="50" r="48"/></clipPath>' +
    '<linearGradient id="siestaBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0%" stop-color="#0f1f3d"/><stop offset="100%" stop-color="#162447"/></linearGradient></defs>' +
    '<circle cx="50" cy="50" r="48" fill="url(#siestaBg)"/>' +
    '<g clip-path="url(#siestaClip)">' +
    '<circle cx="50" cy="50" r="41" fill="none" stroke="#4fc3f7" stroke-width="1.1" opacity="0.55"/>' +
    '<circle cx="50" cy="50" r="37" fill="none" stroke="#4fc3f7" stroke-width="0.6" opacity="0.35"/>' +
    '<path d="M12 34 A 40 40 0 0 1 34 12" fill="none" stroke="#7ee0ff" stroke-width="1.4" opacity="0.5" stroke-linecap="round"/>' +
    '<path d="M66 88 A 40 40 0 0 1 88 66" fill="none" stroke="#4fc3f7" stroke-width="1.4" opacity="0.4" stroke-linecap="round"/>' +
    '<path d="M31 72 C31 58 39 47 50 47 C61 47 69 58 69 72 L69 92 L31 92 Z" fill="#2b3648"/>' +
    '<path d="M45 62 L45 74 L41 78 L38 92 L31 92 L31 72 C31 66 33 60 37 56 Z" fill="#242e3d"/>' +
    '<path d="M55 62 L55 74 L59 78 L62 92 L69 92 L69 72 C69 66 67 60 63 56 Z" fill="#242e3d"/>' +
    '<path d="M47 58 L50 78 L53 58 Z" fill="#1a212c"/>' +
    '<path d="M46.5 58 L53.5 58 L52 64 L48 64 Z" fill="#3a4658"/>' +
    '<ellipse cx="50" cy="38" rx="17" ry="18" fill="#f5e4d3"/>' +
    '<path d="M35 34 C35 20 42 10 50 10 C58 10 65 20 65 34 C65 30 62 27 58 27 C55 27 54 24 50 24 C46 24 45 27 42 27 C38 27 35 30 35 34 Z" fill="#d7dee6"/>' +
    '<path d="M33 33 C33 24 39 15 47 12 C43 17 41 24 42 30 C38 29 35 30 33 33 Z" fill="#c3cdd8"/>' +
    '<path d="M67 33 C67 24 61 15 53 12 C57 17 59 24 58 30 C62 29 65 30 67 33 Z" fill="#c3cdd8"/>' +
    '<circle cx="43.5" cy="39" r="3.1" fill="#2f7fd6"/><circle cx="56.5" cy="39" r="3.1" fill="#2f7fd6"/>' +
    '<circle cx="44.3" cy="38" r="0.9" fill="#ffffff"/><circle cx="57.3" cy="38" r="0.9" fill="#ffffff"/>' +
    '<path d="M39 35 Q43.5 32 48 35" fill="none" stroke="#a8899a" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>' +
    '<path d="M52 35 Q56.5 32 61 35" fill="none" stroke="#a8899a" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>' +
    '<ellipse cx="38" cy="43" rx="2.6" ry="1.8" fill="#f5b8b0" opacity="0.55"/><ellipse cx="62" cy="43" rx="2.6" ry="1.8" fill="#f5b8b0" opacity="0.55"/>' +
    '<path d="M47 46 Q50 48 53 46" fill="none" stroke="#3a4a5c" stroke-width="0.9" stroke-linecap="round" opacity="0.7"/>' +
    '<path d="M33 26 C33 14 40 6 50 6 C60 6 67 14 67 26 C67 20 63 16 58 17 C55 12 45 12 42 17 C37 16 33 20 33 26 Z" fill="#e3e8ee"/>' +
    '<path d="M33 26 C33 19 36 14 40 12 C36 17 35 23 36 28 C34 28 33 27 33 26 Z" fill="#c3cdd8"/>' +
    '</g><circle cx="50" cy="50" r="48" fill="none" stroke="#4fc3f7" stroke-width="1.5" opacity="0.7"/></svg>';

  /* ── Fetch knowledge ── */
  function loadKnowledge() {
    return fetch(SB_URL + '/rest/v1/bot_knowledge?select=*&order=sort_order.asc', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON }
    })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) { _knowledge = data; })
      .catch(function (err) { console.error('[Siesta] Gagal load knowledge:', err); _knowledge = []; });
  }

  /* ── Matcher: cari knowledge yang keyword-nya match ── */
  function findResponse(input) {
    var text = input.toLowerCase().trim();
    var best = null;
    var bestScore = 0;

    for (var i = 0; i < _knowledge.length; i++) {
      var item = _knowledge[i];
      if (item.category === 'fallback') continue;
      var kws = item.keywords || [];
      for (var j = 0; j < kws.length; j++) {
        var kw = kws[j].toLowerCase();
        if (!kw) continue;
        if (text.indexOf(kw) !== -1) {
          var score = kw.length; // keyword lebih panjang & spesifik menang
          if (score > bestScore) { bestScore = score; best = item; }
        }
      }
    }

    if (best) return best.response;

    var fb = _knowledge.find(function (k) { return k.category === 'fallback'; });
    return fb ? fb.response : 'Maaf, Evan belum memberitahu saya mengenai hal itu, jadi saya belum bisa menjawab.';
  }

  function greetingResponse() {
    var g = _knowledge.find(function (k) { return k.category === 'greeting'; });
    return g ? g.response : 'Halo... Aku Siesta 🌙 Kalau penasaran tentang Evan, tinggal tanya aku aja yah.';
  }

  /* ── Build DOM ── */
  function buildWidget() {
    var root = document.createElement('div');
    root.className = 'siesta-root';
    root.innerHTML = [
      '<button class="siesta-bubble" id="siestaBubble" aria-label="Buka chat Siesta">',
      '  <span class="siesta-notif" id="siestaNotif"></span>',
      '  <span class="siesta-chat-icon">' + SIESTA_CHAR_SVG + '</span>',
      '  <svg class="siesta-close-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      '</button>',

      '<div class="siesta-window" id="siestaWindow" role="dialog" aria-label="Chat dengan Siesta">',
      '  <div class="siesta-header">',
      '    <div class="siesta-avatar">' + SIESTA_CHAR_SVG + '</div>',
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
