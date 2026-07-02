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
      '  <span class="siesta-chat-icon"><img src="/shared/icon/asisten.webp" alt="Siesta" /></span>',
      '  <svg class="siesta-close-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      '</button>',

      '<div class="siesta-window" id="siestaWindow" role="dialog" aria-label="Chat dengan Siesta">',
      '  <div class="siesta-header">',
      '    <div class="siesta-avatar"><img src="/shared/icon/asisten.webp" alt="Siesta" /></div>',
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
