/**
 * BC Contact Slider — nav, autoplay + progress, lazy warm-up, light parallax
 * Depends on: section.bc-contact
 * Prev/next: [data-bc-contact="prev"|"next"]
 */
(function () {
  "use strict";

  var SEL_ROOT = ".bc-contact";
  var SEL_SLIDE = ".bc-contact__slide";
  var SEL_PREV = '[data-bc-contact="prev"]';
  var SEL_NEXT = '[data-bc-contact="next"]';
  var SEL_CURRENT = "[data-bc-current]";
  var SEL_TOTAL = "[data-bc-total]";
  var SEL_PROGRESS = ".bc-contact__progress-fill";
  var SEL_VISUAL = ".bc-contact__visual";

  var AUTOPLAY_MS = 6000;
  /** Keep in sync with --bc-contact-fade in CSS (0.45s → 450) */
  var TRANS_MS = 450;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function init(root) {
    if (!root || root.dataset.bcContactInit === "1") return;
    root.dataset.bcContactInit = "1";

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
      var rem = Math.max(0, deadline - now);

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

      var curEl = slides[idx];
      var nextEl = slides[next];

      curEl.classList.remove("is-active");
      curEl.setAttribute("aria-hidden", "true");

      nextEl.classList.add("is-active");
      nextEl.setAttribute("aria-hidden", "false");
      idx = next;
      updateCounter();

      window.setTimeout(function () {
        transitioning = false;
        armAutoplayCycle();
      }, TRANS_MS);
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { go(1); });

    updateCounter();
    startAutoplayLoop();

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

    /* Light parallax on active visual stack */
    var reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
      var maxP = parseFloat(getComputedStyle(root).getPropertyValue("--bc-contact-parallax")) || 10;
      var raf = null;
      var nx = 0;
      var ny = 0;

      function applyParallax() {
        raf = null;
        var slideEl = slides[idx];
        var visual = slideEl && slideEl.querySelector(SEL_VISUAL);
        if (!visual) return;
        visual.style.transform =
          "translate3d(" +
          (nx * maxP).toFixed(2) +
          "px," +
          (ny * maxP * 0.45).toFixed(2) +
          "px,0)";
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
