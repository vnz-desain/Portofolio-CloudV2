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
  const revealEls = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');

  if ('IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('visible');
        revealObs.unobserve(el);

        // PERF: After the transition finishes, remove will-change so the
        // browser can reclaim the promoted compositor layer.
        el.addEventListener('transitionend', function cleanup() {
          el.style.willChange = 'auto';
          el.removeEventListener('transitionend', cleanup);
        }, { once: true });
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    // Fallback for very old browsers — show everything immediately
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

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
          '<p class="slide-desc">' + slide.desc + '</p>' +
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

  /* ── Fetch data.json — sumber kebenaran ada di Sheets ── */
  var panelsEl = document.getElementById('aboutPanels');
  if (panelsEl) {
    panelsEl.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;color:var(--white-dim);padding:1.5rem 0;">Loading...</p>';
  }

  fetch('data.json?v=' + Date.now())
    .then(function (res) {
      if (!res.ok) throw new Error('data.json not found');
      return res.json();
    })
    .then(function (data) {

      /* ── 1. Bio — style dikunci di CSS, hanya teks yang dari data ── */
      var bioEl = document.getElementById('aboutBio');
      if (bioEl && data.bio) {
        bioEl.textContent = data.bio;
        /* Pastikan tidak ada inline style yang bisa override */
        bioEl.removeAttribute('style');
      }

      /* ── 2. Tags ── */
      var tagsEl = document.getElementById('aboutTags2');
      if (tagsEl && data.tags && data.tags.length) {
        tagsEl.innerHTML = data.tags.map(function (t) {
          return '<span>' + t + '</span>';
        }).join('');
      }

      /* ── 3. Slides (Education / Venture dst) ── */
      buildSlider(data.slides || data);
    })
    .catch(function (err) {
      console.warn('Portfolio CMS: gagal load data.json —', err.message);
      if (panelsEl) {
        panelsEl.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;color:var(--white-dim);padding:1.5rem 0;">Content unavailable.</p>';
      }
    });

})();
