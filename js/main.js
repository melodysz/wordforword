// Word for Word — skeleton interactivity

// Always land at the top on a refresh/reload — without this, the browser's
// own scroll-restoration silently re-applies whatever scroll position was
// last recorded for this page before any of our JS (Lenis, reveal
// observers) gets a chance to run, which reads as "refreshing dropped me
// back in the middle of the page" instead of a clean reload. Setting this
// BEFORE DOMContentLoaded is what actually pre-empts the browser's own
// restore.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

document.addEventListener("DOMContentLoaded", () => {
  window.scrollTo(0, 0);
  initNavHighlight();
  initLuxuryScroll();
  initIntroReveal();
  initRevealOnScroll();
  initMosaicReveal();
  initHeroEyebrowExit();
  initMarqueeAsterisks();
  initCustomCursor();
});

// Builds a small SVG asterisk "object" — used for both the marquee
// separators and the custom cursor. Deliberately NOT a plain text
// character, and deliberately NOT centered via a hardcoded correction
// ratio either (an earlier version nudged it by a fixed "9% of
// font-size", measured once in one dev environment — that's fragile:
// it silently depends on the exact font metrics that happen to be
// active when it was measured, which can differ if the web font hasn't
// finished loading yet, or renders with different hinting in a
// different browser/OS, etc. correctASteriskCentering() below instead
// measures the ACTUAL rendered glyph via getBBox(), on the real page,
// after fonts are confirmed loaded — correct by construction regardless
// of environment, not by assumption.
//
// The viewBox size is DERIVED from fontSize (not a fixed number the
// caller has to separately remember to match via CSS) — an earlier
// version hardcoded viewBox to "0 0 32 32" while the CSS sized the
// element differently (28px, or 0.7em elsewhere), silently scaling the
// whole glyph down by that mismatch ratio. Setting width/height
// attributes directly on the <svg>, equal to the viewBox, makes the
// box's intrinsic rendered size self-consistent — no CSS width/height
// should be added for this element anywhere it's used.
function makeAsteriskSVG(fontSize) {
  const NS = "http://www.w3.org/2000/svg";
  const box = fontSize * 1.3; // margin so the glyph's arms aren't clipped
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${box} ${box}`);
  svg.setAttribute("width", box);
  svg.setAttribute("height", box);
  svg.setAttribute("aria-hidden", "true");
  const text = document.createElementNS(NS, "text");
  text.setAttribute("x", box / 2);
  text.setAttribute("y", box / 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("font-size", `${fontSize}`);
  text.textContent = "*";
  svg.appendChild(text);
  return svg;
}

// Call once the SVG from makeAsteriskSVG() is actually attached to the
// live document — measures the glyph's TRUE rendered bounding box and
// nudges it (dx/dy) so its ink center, not just its nominal x/y anchor
// point, lands exactly on the box's center. Waits for document.fonts
// .ready first: measuring before the web font swaps in would bake in a
// correction for the FALLBACK font's metrics instead, which silently
// breaks again the instant the real font loads in and the glyph's
// actual shape changes underneath the (by-then-wrong) correction.
function correctAsteriskCentering(svg) {
  const text = svg.querySelector("text");
  const box = parseFloat(svg.getAttribute("width"));
  document.fonts.ready.then(() => {
    try {
      const bbox = text.getBBox();
      const dx = box / 2 - (bbox.x + bbox.width / 2);
      const dy = box / 2 - (bbox.y + bbox.height / 2);
      text.setAttribute("dx", `${dx}`);
      text.setAttribute("dy", `${dy}`);
    } catch (e) {
      // getBBox() can throw if the element isn't actually rendered yet
      // (e.g. a display:none ancestor) — leave it at its default
      // (uncorrected but still roughly-centered) position.
    }
  });
}

// vertical-align: middle centers an inline-block box against the
// font's X-HEIGHT (baseline + half the lowercase-letter height) — not
// its cap-height. The marquee text is all-caps, so a viewer reads
// "centered" as "centered against the capital letters," and x-height
// sits measurably below cap-height for any font. That gap is exactly
// why a vertical-align:middle asterisk still reads as "too low" no
// matter how precisely its own ink is centered within its own SVG box
// (correctAsteriskCentering fixes THAT, separate problem, one level in)
// — the box's POSITION on the line was still wrong. Fixed here by
// abandoning vertical-align's keyword-based guess entirely: measure the
// track's actual rendered cap-height via canvas (real ink metrics, not
// an assumed ratio — same reasoning as correctAsteriskCentering using
// getBBox instead of a hardcoded percentage), then shift the glyph by
// exactly the difference between where vertical-align: baseline
// naturally puts its center (box/2 above the baseline) and where the
// capital letters' own visual center actually sits (capHeight/2 above
// the baseline).
function alignAsteriskToCapHeight(span, svg, track) {
  const box = parseFloat(svg.getAttribute("height"));
  document.fonts.ready.then(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    const trackStyle = getComputedStyle(track);
    ctx.font = trackStyle.font || `${trackStyle.fontSize} ${trackStyle.fontFamily}`;
    const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
    const shift = box / 2 - capHeight / 2;
    span.style.transform = `translateY(${shift}px)`;
  });
}

// Replaces the plain "*" characters in each marquee strip with the same
// precisely-centered SVG object (see makeAsteriskSVG above) instead of
// a bare text glyph — splitting on the literal "*" preserves the
// surrounding &nbsp; spacing already baked into the HTML (it survives
// as plain U+00A0 characters in the split text nodes).
function initMarqueeAsterisks() {
  const tracks = document.querySelectorAll(".marquee-banner__track");
  for (const track of tracks) {
    const parts = track.textContent.split("*");
    track.textContent = "";
    for (let i = 0; i < parts.length; i++) {
      track.appendChild(document.createTextNode(parts[i]));
      if (i < parts.length - 1) {
        const span = document.createElement("span");
        span.className = "marquee-asterisk";
        const svg = makeAsteriskSVG(28);
        span.appendChild(svg);
        track.appendChild(span);
        correctAsteriskCentering(svg);
        alignAsteriskToCapHeight(span, svg, track);
      }
    }
  }
}

// Plays the one-time load-in sequence (title -> eyebrows -> nav), driven
// entirely by --intro-delay set per element in the HTML. Double rAF
// ensures the initial opacity:0 state is painted first, so this actually
// transitions instead of jumping straight to visible.
//
// Also marks <body> once the whole sequence is genuinely done — see
// .hero__eyebrow-line's CSS: its scroll-linked exit state is scoped to
// body.intro-finished specifically so a fast scroll early on can't
// collide with the eyebrow lines' own intro entrance (both are "not
// .is-visible yet", but need different resting transforms — sliding up
// FROM below to arrive, vs. sliding further up to exit). CRITICAL: this
// timeout must fire AFTER the LATEST --intro-delay + its own
// transition-duration anywhere on the page finishes — currently the
// eyebrow lines themselves (4870ms delay + 1.6s slide-slow = 6470ms).
// Firing this too early cuts that transition off mid-flight (changing
// transition-delay while a transition is still running effectively
// breaks it), which looked like "the eyebrows don't move at all" when
// this was hardcoded to 5000ms. Update this number if those delays
// change again.
function initIntroReveal() {
  const introEls = document.querySelectorAll(".intro-reveal");
  if (!introEls.length) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const el of introEls) el.classList.add("is-visible");
    });
  });

  setTimeout(() => {
    // Compute the hero asterisk's correct visibility BEFORE touching any
    // classes, and pass it along on the event instead of letting the
    // listener re-derive it. getBoundingClientRect() forces a
    // synchronous reflow — calling it AFTER body.intro-finished is added
    // but BEFORE the asterisk's own is-visible is toggled would let the
    // browser "see" and record a genuine (if momentary) in-between state
    // — finished, but not yet visible — as the CSS transition's actual
    // starting point. That's exactly what caused the hero asterisk to
    // visibly snap invisible and re-fade-in right as the intro finished,
    // even though the end state never numerically changed: reading
    // layout here, before either class changes, and letting the
    // listener apply the already-known answer with no layout reads of
    // its own, means there's no reflow wedged between the two class
    // mutations for the browser to treat as a real transition.
    const hero = document.querySelector(".hero");
    let asteriskVisible = true;
    if (hero) {
      const rect = hero.getBoundingClientRect();
      asteriskVisible = Math.max(0, -rect.top) / rect.height < 0.05;
    }
    document.body.classList.add("intro-finished");
    // initHeroEyebrowExit() listens for this to do its FIRST sync of the
    // hero asterisk specifically — see that function for why.
    document.dispatchEvent(new CustomEvent("introfinished", { detail: { asteriskVisible } }));
  }, 6650);
}

// Highlights the nav link for the page currently loaded (each link is a
// real separate page, not a same-page section) with a static underline
// under that link only.
function initNavHighlight() {
  const navLinks = Array.from(document.querySelectorAll(".nav__links a"));
  const indicator = document.querySelector(".nav__indicator");
  if (!navLinks.length || !indicator) return;

  const currentFile = location.pathname.split("/").pop() || "index.html";
  const activeLink =
    navLinks.find((link) => link.getAttribute("href") === currentFile) || navLinks[0];
  activeLink.classList.add("is-active");

  const placeIndicator = () => {
    indicator.style.left = `${activeLink.offsetLeft}px`;
    indicator.style.width = `${activeLink.offsetWidth}px`;
  };

  placeIndicator();
  window.addEventListener("resize", placeIndicator);
}

// Replaces native scroll with Lenis smoothing — a light per-frame lerp
// that takes the edge off native scroll without the floaty, animate-to-
// target feel that duration/easing-based smoothing gives on continuous
// wheel input. Falls back to native scroll silently if the CDN script
// didn't load.
function initLuxuryScroll() {
  if (typeof Lenis === "undefined") return;

  const lenis = new Lenis({
    lerp: 0.18, // higher = snappier/closer to native, lower = smoother/heavier
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  for (const link of anchorLinks) {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1, easing: (t) => 1 - (1 - t) ** 3 });
    });
  }
}

// Fades each square / card / block / image-mask into place as it enters
// the viewport (pure opacity, no motion), with a pronounced stagger —
// each subsequent sibling waits noticeably longer, for a slow, dramatic,
// floaty cascade rather than a quick uniform fade-in.
//
// Observation is deferred until the user's first scroll: the intro
// sequence should own the initial load, so main content must never
// fade in just because it happened to already be in the viewport on
// page load — only once the user actually scrolls.
//
// Resets (never "done for good"): scrolling a tile far enough away —
// above OR below the viewport, regardless of whether it's already
// been seen — resets it, so scrolling back re-triggers the fade-in.
//
// Computed directly from getBoundingClientRect() on scroll (rAF-
// throttled) rather than IntersectionObserver — an earlier
// IntersectionObserver-based version occasionally left a tile that
// was clearly on-screen without "is-visible", which direct
// computation avoids entirely by re-deriving the correct state every
// frame instead of relying on the browser's own (batched, not
// necessarily per-frame) intersection notifications. Also makes the
// reset buffer easy to reason about in plain pixels: a tile only
// resets once it's a full viewport-height past whichever edge it
// exited — comfortably lenient, not "reset the instant it's offscreen."
function initRevealOnScroll() {
  const targets = document.querySelectorAll(
    ".square, .image-mosaic__mask, .feature-banner, .quote-block, .publication-card, .partners__logo, .split-cta"
  );
  if (!targets.length) return;

  // Stagger is normalized to a shared TOTAL cascade span per group
  // (600ms end-to-end, divided across that group's own sibling count)
  // rather than a flat per-item ms — a flat value doesn't generalize:
  // section 1's squares span 4 GRID ROWS, so most of their "tile by
  // tile" cascade already comes from tiles at different rows entering
  // the viewport at genuinely different scroll moments, seconds apart;
  // the footer (3 cells) and partner logos (3 logos) are single ROWS,
  // so all siblings enter the viewport in the exact same instant — the
  // artificial per-item delay is the ONLY thing that can stagger them
  // at all. A flat 40-100ms/step gave section 1's 10+ siblings a full
  // second of spread while giving these 3-item rows almost none —
  // reported as the footer/partners "acting like one long rectangle"
  // instead of tiles. Normalizing to a fixed total span means EVERY
  // group gets a comparably obvious cascade regardless of how many
  // siblings it has.
  const CASCADE_SPAN_MS = 600;
  for (const el of targets) {
    const siblings = Array.from(el.parentElement.children);
    const index = siblings.indexOf(el);
    const step = siblings.length > 1 ? CASCADE_SPAN_MS / (siblings.length - 1) : 0;
    el.style.setProperty("--reveal-delay", `${Math.round(index * step)}ms`);
  }

  // Override: .site-footer__center sits in the footer's DOM order
  // alongside the 4 real squares (checker, dark, dark, checker), so the
  // generic per-parent stagger above treats it as just one more sibling
  // in that same 0..600ms spread. Start it at the SAME delay as the 3rd
  // square (index 2) — the content should already be under way by the
  // time that square begins, not wait for the whole sequence to finish.
  const footerCenter = document.querySelector(".site-footer__center");
  if (footerCenter) {
    const footerSquares = document.querySelectorAll(".site-footer .square:not(.site-footer__center)");
    const thirdSquare = footerSquares[2];
    const thirdSquareDelay = thirdSquare ? parseFloat(thirdSquare.style.getPropertyValue("--reveal-delay")) || 0 : 0;
    footerCenter.style.setProperty("--reveal-delay", `${thirdSquareDelay}ms`);
  }

  let ticking = false;
  const checkAll = () => {
    const vh = window.innerHeight;
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      const inView = rect.top < vh * 0.9 && rect.bottom > vh * 0.1;
      const farAway = rect.bottom < -vh * 1.5 || rect.top > vh * 2.5;
      if (inView) el.classList.add("is-visible");
      else if (farAway) el.classList.remove("is-visible");
    }
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(checkAll);
  };
  window.addEventListener(
    "scroll",
    () => {
      checkAll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    },
    { once: true, passive: true }
  );
}

// The hero eyebrow lines, the "Word for Word" title pieces, AND the hero
// asterisk all key off the SAME shared trigger — the HERO SECTION's own
// bounding rect, 5% of its height scrolled out of view — rather than each
// element's individual position, so everything crosses the threshold at
// exactly the same scroll amount and exits/returns as one unit. What
// makes the eyebrow lines specifically read as "line by line" instead of
// one paragraph-block moving at once is purely CSS: the 2nd line in each
// eyebrow block carries a small extra transition-delay (see the
// nth-child rule under body.intro-finished .hero__eyebrow-line in the
// CSS), so line 1 is visibly already moving before line 2 starts — the
// title/asterisk have no such stagger (see .hero__title-exit and
// .hero__wordmark-asterisk-wrap in the CSS). Scrolling back up past that
// same 5% point brings everything back, same stagger in reverse. See
// body.intro-finished .hero__eyebrow-line / .hero__title-exit /
// .hero__wordmark-asterisk-wrap in the CSS for why this only takes
// effect once the page-load intro has genuinely finished.
//
// The eyebrow lines and title pieces are toggled EAGERLY (check() runs
// immediately, not deferred to the user's first scroll like
// initRevealOnScroll()'s targets) — safe for them because their entrance
// is a CSS *transition* (opacity/transform + transition-delay), which
// respects its own delay regardless of when "is-visible" gets toggled.
//
// The hero asterisk is toggled SEPARATELY, and ONLY once
// body.intro-finished is actually set — not before. Its entrance is a
// CSS *animation* (hero-asterisk-intro), and animations only take effect
// once their own delay elapses; before that, the element's appearance
// falls back to plain (non-animation) rules. Toggling "is-visible" on it
// early would make the page's generic, unscoped ".is-visible { opacity:
// 1 }" rule win that fallback (equal specificity, later in the
// cascade) — showing the asterisk fully in-place from frame one instead
// of hidden and waiting to pop in, which is exactly the "starts out
// already in place instead of sliding up and fading in" regression an
// earlier, eager-for-everything version of this function caused. Not
// toggling it AT ALL, on the other hand, reproduces the ORIGINAL bug
// ("asterisk disappears after it spins in") — body.intro-finished
// .hero__wordmark-asterisk-wrap:not(.is-visible) would match an element
// that had simply never been checked.
//
// The FIRST asterisk sync doesn't call check() itself — it applies the
// visibility value initIntroReveal() already computed and passed on the
// "introfinished" event's detail, rather than re-deriving it here via
// another getBoundingClientRect() call. Doing that read here (after
// body.intro-finished is already set) would reintroduce a forced-
// reflow hazard: the browser would "see" and record a genuine —
// finished, but not-yet-visible — in-between state as the transition's
// real starting point, which is exactly what caused the asterisk to
// visibly snap invisible and re-fade-in right at the intro/scroll-exit
// handoff even though the end state never numerically changed.
function initHeroEyebrowExit() {
  const hero = document.querySelector(".hero");
  const alwaysEls = document.querySelectorAll(".hero__eyebrow-line, .hero__title-exit");
  const asterisk = document.querySelector(".hero__wordmark-asterisk-wrap");
  if (!hero || (!alwaysEls.length && !asterisk)) return;

  let ticking = false;
  let asteriskReady = false;
  const check = () => {
    const rect = hero.getBoundingClientRect();
    const outFraction = Math.max(0, -rect.top) / rect.height;
    const visible = outFraction < 0.05;
    for (const el of alwaysEls) el.classList.toggle("is-visible", visible);
    if (asterisk && asteriskReady) {
      asterisk.classList.toggle("is-visible", visible);
    }
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(check);
  };

  check();
  document.addEventListener(
    "introfinished",
    (e) => {
      asteriskReady = true;
      if (asterisk) asterisk.classList.toggle("is-visible", e.detail.asteriskVisible);
    },
    { once: true }
  );
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

// Chains the image-mosaic's scrim + caption reveal onto the mask tiles
// actually finishing, rather than a guessed delay: the mosaic spans 3
// grid rows and can easily be taller than the viewport, so the 6 masks
// (already handled individually by initRevealOnScroll's own observer)
// don't all enter view at once — how long "all tiles done" takes depends
// on how fast/far the user scrolls, not a fixed number of milliseconds
// from the first one appearing. Listening for each mask's own
// transitionend is what makes "once all tiles fade in" true regardless.
function initMosaicReveal() {
  const mosaics = document.querySelectorAll(".image-mosaic");
  if (!mosaics.length) return;

  const PAUSE_MS = 150; // "a slight delay" between each handoff

  for (const mosaic of mosaics) {
    const masks = mosaic.querySelectorAll(".image-mosaic__mask");
    const scrim = mosaic.querySelector(".image-mosaic__scrim");
    const captions = mosaic.querySelectorAll(".image-mosaic__caption");
    if (!masks.length || !scrim) continue;

    let doneCount = 0;
    for (const mask of masks) {
      mask.addEventListener(
        "transitionend",
        (e) => {
          if (e.propertyName !== "opacity") return;
          doneCount += 1;
          if (doneCount < masks.length) return;
          setTimeout(() => scrim.classList.add("is-visible"), PAUSE_MS);
        },
        { once: true }
      );
    }

    scrim.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName !== "opacity") return;
        setTimeout(() => {
          for (const cap of captions) cap.classList.add("is-visible");
        }, PAUSE_MS);
      },
      { once: true }
    );
  }
}

// Custom cursor decoration: a small Instrument Serif asterisk that
// trails the REAL cursor (which stays visible — this doesn't replace
// it) with a floaty, lagging "drag", attached near the tail end of the
// pointer rather than sitting on top of the tip. Split into a wrap
// (real cursor position, via a lerp'd translate set directly in the
// rAF loop below) + inner glyph (the continuous hero-asterisk-spin
// animation) for the same reason the hero asterisk and square-corner
// asterisks are split the same way: a CSS `animation` that touches
// `transform` fully REPLACES an element's own transform rather than
// composing with it, so putting the position translate and the spin on
// the SAME element would fight each other. Skipped entirely under
// prefers-reduced-motion (this is a constantly-spinning, constantly-
// moving decoration attached to the user's own pointer — exactly the
// kind of motion that setting is meant to suppress) and on touch/coarse
// pointers (no real mouse to trail).
function initCustomCursor() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const wrap = document.createElement("div");
  wrap.className = "custom-cursor-wrap";
  wrap.setAttribute("aria-hidden", "true");
  // Separate layer between wrap (position + hover scale) and the glyph
  // (continuous spin): holds only the one-shot, re-triggerable click-burst
  // spin, for the same reason position/spin/burst can't share one element
  // — each is its own `animation`/JS-driven `transform`, and those replace
  // rather than compose when stacked on a single element.
  const burst = document.createElement("div");
  burst.className = "custom-cursor-burst";
  // Diagnostic swap: reuse the hero's own asterisk artwork (a plain PNG,
  // rotated via the same hero-asterisk-spin animation it already uses in
  // the hero) instead of the SVG-text glyph built by makeAsteriskSVG.
  // If this still orbits while trailing the cursor, that isolates the
  // cause to the position-lag itself rather than anything specific to
  // the SVG/text centering path.
  const ASTERISK_SRC_DARK_BG = "assets/images/Asterisk - Default, Cream.png";
  const ASTERISK_SRC_LIGHT_BG = "assets/images/Asterisk - Default.png";
  const glyph = document.createElement("img");
  glyph.src = ASTERISK_SRC_LIGHT_BG;
  glyph.alt = "";
  glyph.className = "custom-cursor-asterisk";
  burst.appendChild(glyph);
  wrap.appendChild(burst);
  document.body.appendChild(wrap);

  // Offset toward the tail end of a standard pointer (which points up-
  // left, tip at the exact mouse position) — down-right of the cursor,
  // not on top of it. Small — this should read as ATTACHED to the
  // cursor, not floating off near it. Genuinely small, too: the
  // translate(-50%,-50%) below makes (curX+OFFSET_X, curY+OFFSET_Y) the
  // WRAP'S OWN CENTER, not its top-left corner — without that, this
  // offset would need to separately account for half the glyph's own
  // (now much bigger) size just to keep the visible asterisk close to
  // the cursor, and silently drift further away every time the glyph's
  // size changes.
  const OFFSET_X = 10;
  const OFFSET_Y = 10;
  // Lower = more lag/"drag" before catching up to the real cursor.
  const LERP = 0.4;

  // rgb() strings for the palette's 2 light colors — cream (page/nav
  // background) and tan (checker/square backgrounds) — everything else
  // (dark, grey, red) counts as a dark/saturated backdrop needing the
  // tan asterisk instead of the red one for contrast.
  const LIGHT_BG_RGB = ["rgb(249, 245, 236)", "rgb(241, 215, 188)"];

  function srcForPoint(x, y) {
    let node = document.elementFromPoint(x, y);
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        return LIGHT_BG_RGB.includes(bg) ? ASTERISK_SRC_LIGHT_BG : ASTERISK_SRC_DARK_BG;
      }
      node = node.parentElement;
    }
    // Fell through to <html> with no solid background found anywhere —
    // the page's own background (cream) is what's actually showing.
    return ASTERISK_SRC_LIGHT_BG;
  }

  // Real, actually-clickable elements only — not decorative hover targets
  // like .diamond-cta or .square, which already use cursor: default.
  function isClickablePoint(x, y) {
    const node = document.elementFromPoint(x, y);
    return !!(node && node.closest("a[href], button"));
  }

  const HOVER_SCALE = 1.5;
  const SCALE_LERP = 0.25;

  let mouseX = -100;
  let mouseY = -100;
  let curX = -100;
  let curY = -100;
  let started = false;
  let targetScale = 1;
  let curScale = 1;

  window.addEventListener(
    "mousemove",
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!started) {
        curX = mouseX;
        curY = mouseY;
        started = true;
      }
      const wantedSrc = srcForPoint(e.clientX, e.clientY);
      if (!glyph.src.endsWith(wantedSrc)) glyph.src = wantedSrc;
      targetScale = isClickablePoint(e.clientX, e.clientY) ? HOVER_SCALE : 1;
    },
    { passive: true }
  );

  // Quick extra spin on click, layered on the burst element so it composes
  // with (rather than fights) the glyph's own continuous spin underneath.
  // Removing then re-adding the class forces a reflow in between, which
  // restarts the CSS animation from scratch on every click, including
  // rapid repeat clicks.
  window.addEventListener(
    "click",
    () => {
      burst.classList.remove("is-bursting");
      void burst.offsetWidth;
      burst.classList.add("is-bursting");
    },
    { passive: true }
  );

  function raf() {
    curX += (mouseX - curX) * LERP;
    curY += (mouseY - curY) * LERP;
    curScale += (targetScale - curScale) * SCALE_LERP;
    wrap.style.transform = `translate(${curX + OFFSET_X}px, ${curY + OFFSET_Y}px) translate(-50%, -50%) scale(${curScale})`;
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}
