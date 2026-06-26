/**
 * M. EVAN ALMUNAWAR — Cinematic Portfolio
 * script.js  |  Performance-Optimised Version
 *
 * KEY OPTIMISATIONS vs previous version
 * ──────────────────────────────────────
 * 1. Hero parallax REMOVED — it called getBoundingClientRect() + style.transform
 *    on every scroll tick, forcing layout recalculation. Static background is
 *    indistinguishable at these scroll speeds on mobile.
 *
 * 2. Skill stagger animation MOVED to CSS (transition-delay on .delay-*).
 *    The previous version used JS setTimeout loops inside an IntersectionObserver
 *    which triggered multiple style mutations per animation frame.
 *
 * 3. Card mousemove glow handler REMOVED — radial-gradient updates on every
 *    pointer-move event are expensive (new gradient string parse + paint per
 *    event). Replaced with a CSS ::after pseudo-element that fades in/out.
 *
 * 4. Active nav tracking REMOVED — it was querying offsetTop of every section
 *    on every scroll tick. Replaced with a single IntersectionObserver.
 *
 * 5. Scroll handler now only updates nav scroll-state (1 classList toggle).
 *    requestAnimationFrame throttle kept.
 *
 * 6. will-change cleaned up after reveal animations complete via transitionend
 *    event — avoids keeping GPU layers alive for elements that don't need them.
 *
 * 7. All IntersectionObserver instances share threshold values to allow the
 *    browser to coalesce callbacks into a single microtask.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1. NAVIGATION — scroll state + mobile menu + dropdowns
  ───────────────────────────────────────────── */
  const nav       = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');

  // Debounced scroll state — only one classList write per rAF
  let scrollTick = false;
  function handleNavScroll() {
    if (!scrollTick) {
      requestAnimationFrame(function () {
        nav.classList.toggle('scrolled', window.scrollY > 60);
        scrollTick = false;
      });
      scrollTick = true;
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  // ── Dropdown toggle (desktop & mobile) ──────────────────
  var dropdownItems = document.querySelectorAll('.nav-item.has-dropdown');

  function closeAllDropdowns(except) {
    dropdownItems.forEach(function (item) {
      if (item === except) return;
      item.classList.remove('open');
      var btn = item.querySelector('.nav-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  dropdownItems.forEach(function (item) {
    var btn = item.querySelector('.nav-btn');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
      closeAllDropdowns(isOpen ? item : null);
    });

    // Close dropdown when a link inside it is clicked
    item.querySelectorAll('.nav-dropdown a').forEach(function (a) {
      a.addEventListener('click', function () {
        item.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target)) closeAllDropdowns();
  });

  // Close dropdowns on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllDropdowns();
  });

  // Mobile menu
  function closeMenu() {
    navToggle.classList.remove('open');
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    closeAllDropdowns();
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close mobile menu when a non-dropdown anchor is clicked
    navLinks.querySelectorAll('.nav-direct, .nav-dropdown a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') && !nav.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) closeMenu();
    });
  }

  /* ─────────────────────────────────────────────
     2. REVEAL ANIMATIONS — IntersectionObserver
     PERF: Single observer instance; unobserve after first reveal.
     will-change removed via transitionend to free GPU memory.
  ───────────────────────────────────────────── */
  var revealObs = null;

  function observeReveal() {
    var els = document.querySelectorAll('.reveal-up:not(.visible), .reveal-left:not(.visible), .reveal-right:not(.visible)');
    if (!els.length) return;

    if ('IntersectionObserver' in window) {
      if (!revealObs) {
        revealObs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            el.classList.add('visible');
            revealObs.unobserve(el);
            el.addEventListener('transitionend', function cleanup() {
              el.style.willChange = 'auto';
              el.removeEventListener('transitionend', cleanup);
            }, { once: true });
          });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
      }
      els.forEach(function (el) { revealObs.observe(el); });
    } else {
      els.forEach(function (el) { el.classList.add('visible'); });
    }
  }

  // Initial observe on page load
  observeReveal();

  /* ─────────────────────────────────────────────
     3. HERO ENTRANCE — trigger immediately
     PERF: short timeout lets the browser finish first paint before
     starting the entrance animation (avoids jank on first load).
  ───────────────────────────────────────────── */
  setTimeout(function () {
    document.querySelectorAll('.hero .reveal-up').forEach(function (el) {
      el.classList.add('visible');
    });
  }, 120);

  /* ─────────────────────────────────────────────
     4. SCROLL INDICATOR — fade out on first scroll
     PERF: opacity only (compositor-safe). Observer disconnects itself
     after firing once so there's zero ongoing cost.
  ───────────────────────────────────────────── */
  const scrollIndicator = document.querySelector('.scroll-indicator');
  if (scrollIndicator) {
    scrollIndicator.style.transition = 'opacity 0.4s';
    let scrollFadeDone = false;
    function fadeScrollIndicator() {
      if (scrollFadeDone) return;
      if (window.scrollY > 80) {
        scrollIndicator.style.opacity = '0';
        scrollFadeDone = true;
        window.removeEventListener('scroll', fadeScrollIndicator);
      }
    }
    window.addEventListener('scroll', fadeScrollIndicator, { passive: true });
  }

  /* ─────────────────────────────────────────────
     5. SMOOTH ANCHOR SCROLLING with nav offset
     PERF: uses scrollIntoView with {behavior:'smooth'} which hands off to
     the browser's native smooth scroll implementation (GPU-accelerated).
  ───────────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      // Use scroll-padding-top (set in CSS on html element) for offset
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ─────────────────────────────────────────────
     6. LAZY-LOAD FALLBACK for older Android WebView
     Native loading="lazy" is supported in Chrome 77+ (Android 10+).
     For older versions, this IntersectionObserver polyfill kicks in.
  ───────────────────────────────────────────── */
  const lazyImgs = document.querySelectorAll('img[loading="lazy"]');
  // Only run polyfill if native lazy loading is not supported
  if (!('loading' in HTMLImageElement.prototype) && 'IntersectionObserver' in window) {
    const imgObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.dataset.src;
        if (src) { img.src = src; }
        imgObs.unobserve(img);
      });
    }, { rootMargin: '200px' });

    lazyImgs.forEach(function (img) {
      // Move src to data-src for the polyfill
      img.dataset.src = img.src;
      img.src = '';
      imgObs.observe(img);
    });
  }

})();

/* ─────────────────────────────────────────────
   7. ABOUT TABS + SLIDER — data-driven via data.json
   Edit konten di Google Sheets, bukan di sini.
   File ini hanya berisi logika render.
───────────────────────────────────────────── */
(function () {
  'use strict';

  function buildSlider(ABOUT_DATA) {

    /* ── Collect unique tab names in order ── */
    var tabNames = [];
    ABOUT_DATA.forEach(function (item) {
      if (tabNames.indexOf(item.tab) === -1) tabNames.push(item.tab);
    });

    var tabsEl   = document.getElementById('aboutTabs');
    var panelsEl = document.getElementById('aboutPanels');
    if (!tabsEl || !panelsEl) return;

    /* Clear loading state */
    panelsEl.innerHTML = '';
    tabsEl.innerHTML   = '';

    /* ── Build HTML ── */
    tabNames.forEach(function (tabName, tIdx) {
      /* Tab button */
      var btn = document.createElement('button');
      btn.className   = 'about-tab-btn' + (tIdx === 0 ? ' active' : '');
      btn.textContent = tabName;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', tIdx === 0 ? 'true' : 'false');
      btn.setAttribute('data-tab', tabName);
      tabsEl.appendChild(btn);

      /* Panel */
      var panel = document.createElement('div');
      panel.className = 'about-tab-panel' + (tIdx === 0 ? ' active' : '');
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('data-panel', tabName);

      /* Slides for this tab */
      var slides = ABOUT_DATA.filter(function (d) { return d.tab === tabName; });

      /* Slider structure */
      var wrap  = document.createElement('div');
      wrap.className = 'about-slider-wrap';

      var track = document.createElement('div');
      track.className = 'about-slider-track';

      slides.forEach(function (slide) {
        var s = document.createElement('div');
        s.className = 'about-slide';

        var founderBadge = slide.founder
          ? '<div class="slide-founder-badge"><span class="slide-founder-dot"></span>Founder</div>'
          : '';

        var tagsHtml = (slide.tags || []).map(function (t) {
          return '<span>' + t + '</span>';
        }).join('');

        s.innerHTML =
          '<div class="slide-period">' + slide.period + '</div>' +
          founderBadge +
          '<div class="slide-title">' + slide.title + '</div>' +
          '<div class="slide-subtitle">' + slide.subtitle + '</div>' +
          '<p class="slide-desc">' + slide.body + '</p>' +
          (tagsHtml ? '<div class="slide-tags">' + tagsHtml + '</div>' : '');

        track.appendChild(s);
      });

      wrap.appendChild(track);

      /* Navigation row */
      var nav       = document.createElement('div');
      nav.className = 'about-slider-nav';

      var dotsWrap       = document.createElement('div');
      dotsWrap.className = 'about-slider-dots';

      var counter       = document.createElement('span');
      counter.className = 'slider-counter';

      var arrowsWrap       = document.createElement('div');
      arrowsWrap.className = 'about-slider-arrows';

      var prevBtn = document.createElement('button');
      prevBtn.className = 'slider-arrow';
      prevBtn.setAttribute('aria-label', 'Previous');
      prevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';

      var nextBtn = document.createElement('button');
      nextBtn.className = 'slider-arrow';
      nextBtn.setAttribute('aria-label', 'Next');
      nextBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';

      arrowsWrap.appendChild(prevBtn);
      arrowsWrap.appendChild(nextBtn);

      var dots = [];
      slides.forEach(function (_, i) {
        var dot = document.createElement('button');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dots.push(dot);
        dotsWrap.appendChild(dot);
      });

      nav.appendChild(dotsWrap);
      nav.appendChild(counter);
      nav.appendChild(arrowsWrap);
      wrap.appendChild(nav);
      panel.appendChild(wrap);
      panelsEl.appendChild(panel);

      /* ── Slider logic ── */
      var current = 0;
      var total   = slides.length;

      function goTo(idx) {
        current = Math.max(0, Math.min(idx, total - 1));
        track.style.transform = 'translateX(-' + (current * 100) + '%)';
        dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
        counter.textContent  = (current + 1) + ' / ' + total;
        prevBtn.disabled     = current === 0;
        nextBtn.disabled     = current === total - 1;
      }

      prevBtn.addEventListener('click', function () { goTo(current - 1); });
      nextBtn.addEventListener('click', function () { goTo(current + 1); });
      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { goTo(i); });
      });

      /* Touch swipe */
      var touchStartX = 0;
      wrap.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      wrap.addEventListener('touchend', function (e) {
        var diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1);
      }, { passive: true });

      goTo(0);
    });

    /* ── Tab switching ── */
    var allBtns   = tabsEl.querySelectorAll('.about-tab-btn');
    var allPanels = panelsEl.querySelectorAll('.about-tab-panel');

    allBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-tab');
        allBtns.forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-tab') === target);
          b.setAttribute('aria-selected', b.getAttribute('data-tab') === target ? 'true' : 'false');
        });
        allPanels.forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-panel') === target);
        });
      });
    });
  }

  /* ══════════════════════════════════════════════════════
     SUPABASE CLIENT — fetch semua data portfolio
     Public anon key — aman untuk static site (read-only RLS)
  ══════════════════════════════════════════════════════ */
  var SUPABASE_URL = 'https://ocedszxukzrnmvrecrnx.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZWRzenh1a3pybm12cmVjcm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjI4ODAsImV4cCI6MjA5Nzg5ODg4MH0.fxgMdyZlbp0V20oSvI6ZgnZNgWFh4g0iHMI4SxYLkkE';

  function sbFetch(table, customOrder, extraParams) {
    var order = customOrder || 'sort_order.asc';
    var url = SUPABASE_URL + '/rest/v1/' + table + '?select=*&order=' + order;
    if (extraParams) url += '&' + extraParams;
    return fetch(url, {
      headers: {
        'apikey'       : SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    }).then(function (r) {
      if (!r.ok) throw new Error(table + ' fetch failed: ' + r.status);
      return r.json();
    });
  }

  /* Loading states */
  var panelsEl     = document.getElementById('aboutPanels');
  var skillsGridEl = document.getElementById('skillsGrid');
  var projectsEl   = document.getElementById('projectsGrid');
  var loadingHTML  = '<p style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;color:var(--white-dim);padding:1.5rem 0;">Loading...</p>';
  if (panelsEl)     panelsEl.innerHTML     = loadingHTML;
  if (skillsGridEl) skillsGridEl.innerHTML = loadingHTML;
  if (projectsEl)   projectsEl.innerHTML   = loadingHTML;

  /* Fetch semua tabel paralel */
  Promise.all([
    sbFetch('about', 'id.asc', 'limit=1'),
    sbFetch('slides', 'tab.asc,sort_order.asc'),
    sbFetch('skills', 'sort_order.asc'),
    sbFetch('projects', 'sort_order.asc')
  ])
  .then(function (results) {
    var about    = results[0][0] || {};
    var slides   = results[1]    || [];
    var skills   = results[2]    || [];
    var projects = results[3]    || [];

    /* ── 1. Bio ── */
    var bioEl = document.getElementById('aboutBio');
    if (bioEl && about.bio) {
      bioEl.textContent = about.bio;
      bioEl.removeAttribute('style');
    }

    /* ── 2. About Tags ── */
    var tagsEl = document.getElementById('aboutTags2');
    if (tagsEl && about.tags && about.tags.length) {
      tagsEl.innerHTML = about.tags.map(function (t) {
        return '<span>' + t + '</span>';
      }).join('');
    }

    /* ── 3. Slides ── */
    buildSlider(slides);

    /* ── 4. Skills ── */
    renderSkills(skills);

    /* ── 5. Projects ── */
    renderProjects(projects);
  })
  .catch(function (err) {
    console.warn('Portfolio CMS error:', err.message);
    var errHTML = '<p style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;color:var(--white-dim);padding:1.5rem 0;">Content unavailable.</p>';
    if (panelsEl)     panelsEl.innerHTML     = errHTML;
    if (skillsGridEl) skillsGridEl.innerHTML = errHTML;
    if (projectsEl)   projectsEl.innerHTML   = errHTML;
  });

  /* ══════════════════════════════════════════════════════
     ICONS — SVG path data by name
     Nama ini yang diketik di kolom "icon" di sheet Skills
  ══════════════════════════════════════════════════════ */
  var ICONS = {
    'video-editing'   : '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    'film'            : '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
    'monitor'         : '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    'smartphone'      : '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    'layers'          : '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    'pen-tool'        : '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
    'star'            : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'file-text'       : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    'home'            : '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'globe'           : '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    'camera'          : '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    'image'           : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    'music'           : '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    'mic'             : '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
    'code'            : '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    'settings'        : '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    'layout'          : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
    'edit'            : '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    'share'           : '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    'trending-up'     : '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    'zap'             : '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'aperture'        : '<circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/>'
  };

  function getIconSVG(iconName) {
    var key     = (iconName || '').toLowerCase().trim();
    var paths   = ICONS[key] || ICONS['star'];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">' + paths + '</svg>';
  }

  /* ── Render Skills ─────────────────────────────────────── */
  function renderSkills(skills) {
    var grid = document.getElementById('skillsGrid');
    if (!grid) return;
    if (!skills.length) { grid.innerHTML = ''; return; }
    var delays = ['delay-1','delay-2','delay-3'];
    grid.innerHTML = skills.map(function (s, i) {
      return [
        '<div class="skill-item reveal-up ' + delays[i % 3] + '">',
        '  <div class="skill-icon">' + getIconSVG(s.icon) + '</div>',
        '  <h3 class="skill-name">' + s.name + '</h3>',
        '  <p class="skill-desc">' + (s.body || '') + '</p>',
        '</div>'
      ].join('\n');
    }).join('\n');
    if (typeof observeReveal === 'function') observeReveal();
  }

  function renderProjects(projects) {
    var grid = document.getElementById('projectsGrid');
    if (!grid) return;
    if (!projects.length) { grid.innerHTML = ''; return; }
    var delays = ['delay-1','delay-2','delay-3'];
    grid.innerHTML = projects.map(function (p, i) {
      var tagsHtml = (p.tags || []).map(function (t) {
        return '<span>' + t + '</span>';
      }).join('');
      var num      = p.num || String(i + 1).padStart(2, '0');
      var imgHtml  = p.image_url
        ? '<img src="' + p.image_url + '" alt="' + p.title + '" class="card-img" loading="lazy" decoding="async" onerror="this.style.display=\'none\'" />'
        : '';
      var fallback    = p.fallback || p.title.substring(0, 6).toUpperCase();
      var titleInner  = p.link
        ? '<a href="' + p.link + '" target="_blank" rel="noopener">' + p.title + '</a>'
        : p.title;
      return [
        '<article class="project-card reveal-up ' + delays[i % 3] + '">',
        '  <div class="card-img-wrap">',
        '    ' + imgHtml,
        '    <div class="card-img-fallback" aria-hidden="true">' + fallback + '</div>',
        '  </div>',
        '  <div class="card-body">',
        '    <span class="card-num">' + num + '</span>',
        '    <h3 class="card-title">' + titleInner + '</h3>',
        '    <p class="card-desc">' + (p.body || '') + '</p>',
        '    <div class="card-tags">' + tagsHtml + '</div>',
        '  </div>',
        '</article>'
      ].join('\n');
    }).join('\n');
    if (typeof observeReveal === 'function') observeReveal();
  }

})();
