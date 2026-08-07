/* ==========================================================================
   AB Holding — redesign 2026
   Vanilla JS, no dependencies, no build step. Progressive enhancement only:
   with JS disabled every page is still fully readable and navigable.
   ========================================================================== */

(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- utils */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ------------------------------------------------------- sticky header */

  var header = $('[data-header]');
  if (header) {
    var stuck = false;
    var onScroll = function () {
      var next = window.scrollY > 8;
      if (next !== stuck) {
        stuck = next;
        header.classList.toggle('is-stuck', stuck);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------- mobile nav */

  var navToggle = $('[data-nav-toggle]');
  var nav = $('[data-nav]');
  if (navToggle && nav) {
    var closeNav = function () {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      nav.classList.toggle('is-open', !open);
      navToggle.setAttribute('aria-expanded', String(!open));
    });
    // close on link click, Escape, or resize back to desktop
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { closeNav(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        closeNav();
        navToggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) { closeNav(); }
    });
  }

  /* ------------------------------------------------------- scroll reveal */

  var revealables = $$('.reveal');
  if (revealables.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealables.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      document.documentElement.classList.add('reveal-ready');
      revealables.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.6) { el.classList.add('is-visible'); }
        else { revealObserver.observe(el); }
      });
    }
  }

  /* ------------------------------------------------------- count-up stats */

  /* data-count holds the numeric target; the element's existing text is the
     rendered template, with {n} marking where the number goes. This keeps
     prefixes/suffixes (EUR, M, +) intact and correct without JS parsing them. */

  /* Group thousands with a space, EXCEPT for years: a value marked
     data-plain renders as "2011", never "2 011". */
  function formatNumber(n, plain) {
    if (plain) { return String(n); }
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, String.fromCharCode(160));
  }

  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) { return; }
    var template = el.getAttribute('data-template') || '{n}';
    var plain = el.hasAttribute('data-plain');
    var duration = 1400;
    var start = null;

    if (reduceMotion) {
      el.textContent = template.replace('{n}', formatNumber(target, plain));
      return;
    }

    function frame(ts) {
      if (start === null) { start = ts; }
      var p = Math.min((ts - start) / duration, 1);
      // easeOutExpo
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      var value = Math.round(target * eased);
      el.textContent = template.replace('{n}', formatNumber(value, plain));
      if (p < 1) { requestAnimationFrame(frame); }
    }
    requestAnimationFrame(frame);
  }

  var counters = $$('[data-count]');
  if (counters.length) {
    // Seed with the final value so a no-IO / no-JS-frame browser still shows truth
    counters.forEach(function (el) {
      var t = el.getAttribute('data-template') || '{n}';
      el.textContent = t.replace('{n}', formatNumber(parseFloat(el.getAttribute('data-count')) || 0, el.hasAttribute('data-plain')));
    });

    if (!reduceMotion && 'IntersectionObserver' in window) {
      var countObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            countObserver.unobserve(entry.target);
            var t = entry.target.getAttribute('data-template') || '{n}';
            entry.target.textContent = t.replace('{n}', '0');
            runCount(entry.target);
          }
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { countObserver.observe(el); });
    }
  }

  /* ------------------------------------------------------- filter chips */

  /* Used by companies.html (sector) and news.html (company tag).
     Chips carry data-filter; items carry data-tags (space separated). */

  $$('[data-filter-group]').forEach(function (group) {
    var targetSel = group.getAttribute('data-filter-target');
    var items = $$(targetSel);
    var emptyEl = group.getAttribute('data-filter-empty')
      ? $(group.getAttribute('data-filter-empty'))
      : null;
    var liveEl = group.getAttribute('data-filter-live')
      ? $(group.getAttribute('data-filter-live'))
      : null;

    function apply(value) {
      var shown = 0;
      items.forEach(function (item) {
        var tags = (item.getAttribute('data-tags') || '').split(/\s+/);
        var match = value === 'all' || tags.indexOf(value) !== -1;
        item.classList.toggle('is-filtered-out', !match);
        // Any filtering interaction reveals matching cards outright, so a
        // match can never stay stranded behind the "show more" pager.
        if (match) { item.removeAttribute('hidden'); }
        if (match) { shown++; }
      });
      // everything is now revealed, so the pager has nothing left to do
      var pager = document.querySelector('[data-load-more]');
      if (pager) { pager.hidden = true; }
      if (emptyEl) { emptyEl.hidden = shown !== 0; }
      if (liveEl) {
        liveEl.textContent = shown === 1
          ? '1 ieraksts'
          : shown + ' ieraksti';
      }
      return shown;
    }

    group.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (!chip || !group.contains(chip)) { return; }
      $$('[data-filter]', group).forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === chip));
      });
      apply(chip.getAttribute('data-filter'));
    });
  });

  /* ------------------------------------------------------- load more */

  $$('[data-load-more]').forEach(function (btn) {
    var listSel = btn.getAttribute('data-load-more');
    var step = parseInt(btn.getAttribute('data-step'), 10) || 9;

    function hiddenItems() {
      return $$(listSel).filter(function (el) { return el.hasAttribute('hidden'); });
    }

    // Reveal nothing on load; the markup ships the first page visible.
    btn.addEventListener('click', function () {
      var batch = hiddenItems().slice(0, step);
      batch.forEach(function (el) { el.removeAttribute('hidden'); });
      if (batch.length) {
        // move focus to the first newly-revealed card for keyboard users
        var focusable = batch[0].querySelector('a, button');
        if (focusable) { focusable.focus({ preventScroll: true }); }
      }
      if (!hiddenItems().length) {
        btn.hidden = true;
      }
    });

    if (!hiddenItems().length) { btn.hidden = true; }
  });

  /* ------------------------------------------------------- current year */

  $$('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

}());


/* ── video lightbox ─────────────────────────────────────────── */
(function () {
  // the dialog markup sits at the end of <body>, after this script tag,
  // so resolve it lazily on first use rather than at parse time
  var box = null, frame = null;
  function els() {
    if (!box) { box = document.getElementById('vbox'); }
    if (!frame) { frame = document.getElementById('vbox-frame'); }
    return box && frame;
  }
  var lastFocus = null;

  function open(id) {
    if (!els()) return;
    frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&rel=0&modestbranding=1" title="Video" allow="accelerometer; autoplay; ' +
      'encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    box.hidden = false;
    document.body.classList.add('vbox-open');
    var btn = box.querySelector('.vbox__close');
    if (btn) btn.focus();
  }

  function close() {
    if (!els()) return;
    box.hidden = true;
    frame.innerHTML = '';                 // stops playback
    document.body.classList.remove('vbox-open');
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-video]');
    if (trigger) {
      e.preventDefault();
      lastFocus = trigger;
      open(trigger.getAttribute('data-video'));
      return;
    }
    if (e.target.closest('[data-vbox-close]')) { close(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && els() && !box.hidden) { close(); }
  });
})();
