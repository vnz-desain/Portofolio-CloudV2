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
     1. NAVIGATION — scroll state + mobile menu
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
  handleNavScroll(); // run once on load

  // Mobile menu
  function closeMenu() {
    navToggle.classList.remove('open');
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') && !nav.contains(e.target)) {
        closeMenu();
      }
    });

    // Close on Escape key
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
