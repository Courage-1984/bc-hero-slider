/**
 * BC Hero Slider — nav, autoplay + progress (scaleX), lazy warm-up, parallax, glitch transition
 * Depends on: section.bc-hero#bc-hero (id optional; root passed to init)
 * Prev/next: buttons use [data-bc-hero="prev"|"next"] (classes e.g. .bc-hero__nav-btn are cosmetic for CSS).
 */
(function () {
  "use strict";

  var SEL_ROOT = ".bc-hero";
  var SEL_SLIDE = ".bc-hero__slide";
  var SEL_PREV = '[data-bc-hero="prev"]';
  var SEL_NEXT = '[data-bc-hero="next"]';
  var SEL_CURRENT = "[data-bc-current]";
  var SEL_TOTAL = "[data-bc-total]";
  var SEL_GLOBE = ".bc-hero__globe-wrap";
  var SEL_PERSON = ".bc-hero__person-wrap";
  var SEL_PROGRESS = ".bc-hero__progress-fill";

  var AUTOPLAY_MS = 6000;
  /** Must match `.bc-hero { --bc-glitch-dur }` in bc-hero-slider.css (1.2s → 1200) */
  var TRANS_MS = 1200;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function init(root) {
    if (!root || root.dataset.bcHeroInit === "1") return;
    root.dataset.bcHeroInit = "1";

    var slides = root.querySelectorAll(SEL_SLIDE);
    var total = slides.length;
    if (!total) return;

    var prevBtn = root.querySelector(SEL_PREV);
    var nextBtn = root.querySelector(SEL_NEXT);
    var elCurrent = root.querySelector(SEL_CURRENT);
    var elTotal = root.querySelector(SEL_TOTAL);
    var elProgress = root.querySelector(SEL_PROGRESS);

    var idx = 0;
    for (var i = 0; i < total; i++) {
      if (slides[i].classList.contains("is-active")) {
        idx = i;
        break;
      }
    }

    var transitioning = false;

    var deadline = 0;
    var rafLoop = null;

    if (elTotal) elTotal.textContent = pad2(total);

    for (var a = 0; a < total; a++) {
      slides[a].setAttribute(
        "aria-hidden",
        slides[a].classList.contains("is-active") ? "false" : "true"
      );
    }

    function updateCounter() {
      if (elCurrent) elCurrent.textContent = pad2(idx + 1);
    }

    function warmSlideImages(slide) {
      if (!slide || slide.dataset.bcWarmed === "1") return;
      slide.dataset.bcWarmed = "1";
      var imgs = slide.querySelectorAll('img[loading="lazy"]');
      for (var j = 0; j < imgs.length; j++) {
        var img = imgs[j];
        if (img.complete) continue;
        try {
          img.loading = "eager";
        } catch (e) {}
        if (img.dataset.src) {
          img.src = img.dataset.src;
        }
      }
    }

    function nowMs() {
      return typeof performance !== "undefined" ? performance.now() : Date.now();
    }

    function armAutoplayCycle() {
      deadline = nowMs() + AUTOPLAY_MS;
    }

    function tickAutoplay() {
      if (total < 2) return;

      var now = nowMs();
      var rem;

      rem = Math.max(0, deadline - now);

      if (elProgress) {
        var prog = 1 - rem / AUTOPLAY_MS;
        if (prog < 0) prog = 0;
        if (prog > 1) prog = 1;
        elProgress.style.transform = "scaleX(" + prog.toFixed(4) + ")";
      }

      if (!transitioning && now >= deadline) {
        go(1);
      }

      rafLoop = window.requestAnimationFrame(tickAutoplay);
    }

    function startAutoplayLoop() {
      if (rafLoop != null || total < 2) return;
      armAutoplayCycle();
      rafLoop = window.requestAnimationFrame(tickAutoplay);
    }

    function go(delta) {
      if (transitioning || total < 2) return;
      var next = (idx + delta + total) % total;
      if (next === idx) return;

      if (elProgress) elProgress.style.transform = "scaleX(0)";

      warmSlideImages(slides[next]);

      transitioning = true;
      root.classList.add("is-transitioning");

      var curEl = slides[idx];
      var nextEl = slides[next];

      curEl.classList.remove("is-active");
      curEl.classList.add("is-exiting");

      nextEl.classList.remove("is-exiting");
      nextEl.classList.add("is-entering");

      function cleanup() {
        curEl.classList.remove("is-exiting");
        nextEl.classList.remove("is-entering");

        curEl.setAttribute("aria-hidden", "true");
        nextEl.setAttribute("aria-hidden", "false");
        nextEl.classList.add("is-active");
        idx = next;
        updateCounter();
        transitioning = false;
        root.classList.remove("is-transitioning");
        armAutoplayCycle();
      }

      window.setTimeout(cleanup, TRANS_MS);
    }

    function onPrev() {
      go(-1);
    }
    function onNext() {
      go(1);
    }

    if (prevBtn) prevBtn.addEventListener("click", onPrev);
    if (nextBtn) nextBtn.addEventListener("click", onNext);

    updateCounter();
    startAutoplayLoop();

    /* Lazy warm-up for non-active slides after load (does not block first paint) */
    function idle(fn) {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(fn, { timeout: 2500 });
      } else {
        window.setTimeout(fn, 400);
      }
    }
    idle(function () {
      for (var s = 0; s < total; s++) {
        if (!slides[s].classList.contains("is-active")) warmSlideImages(slides[s]);
      }
    });

    /* Parallax — rAF-throttled; targets layers on the active (or entering) slide */
    var reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
      var maxG = parseFloat(getComputedStyle(root).getPropertyValue("--bc-parallax-globe")) || 18;
      var maxP = parseFloat(getComputedStyle(root).getPropertyValue("--bc-parallax-person")) || 12;

      var raf = null;
      var nx = 0;
      var ny = 0;

      function parallaxSlideEl() {
        return (
          root.querySelector(SEL_SLIDE + ".is-entering") ||
          root.querySelector(SEL_SLIDE + ".is-active")
        );
      }

      function applyParallax() {
        raf = null;
        var slideEl = parallaxSlideEl();
        var globe = slideEl && slideEl.querySelector(SEL_GLOBE);
        var person = slideEl && slideEl.querySelector(SEL_PERSON);
        if (!globe || !person) return;
        /* Cursor right (+nx): person shifts left, globe shifts right */
        var px = -nx * maxP;
        /* Keep person hard-anchored to bottom; horizontal-only parallax */
        var py = 0;
        var gx = nx * maxG;
        var gy = ny * maxG * 0.55;
        person.style.setProperty("--bc-px", px.toFixed(2) + "px");
        person.style.setProperty("--bc-py", py.toFixed(2) + "px");
        globe.style.setProperty("--bc-gx", gx.toFixed(2) + "px");
        globe.style.setProperty("--bc-gy", gy.toFixed(2) + "px");
      }

      function onMove(ev) {
        var rect = root.getBoundingClientRect();
        var cx = rect.left + rect.width * 0.5;
        var cy = rect.top + rect.height * 0.5;
        nx = (ev.clientX - cx) / (rect.width * 0.5);
        ny = (ev.clientY - cy) / (rect.height * 0.5);
        nx = Math.max(-1, Math.min(1, nx));
        ny = Math.max(-1, Math.min(1, ny));
        if (raf == null) raf = window.requestAnimationFrame(applyParallax);
      }

      root.addEventListener("mousemove", onMove, { passive: true });
      root.addEventListener(
        "mouseleave",
        function () {
          nx = 0;
          ny = 0;
          if (raf == null) raf = window.requestAnimationFrame(applyParallax);
        },
        { passive: true }
      );
    }
  }

  function boot() {
    var nodes = document.querySelectorAll(SEL_ROOT);
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
