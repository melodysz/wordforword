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
  initRoleTapReveal();
  initSocialCarousel();
  initCarouselReveal();
});

// vertical-align: middle centers an inline-block box against the
// font's X-HEIGHT (baseline + half the lowercase-letter height) — not
// its cap-height. The marquee text is all-caps, so a viewer reads
// "centered" as "centered against the capital letters," and x-height
// sits measurably below cap-height for any font. That gap is exactly
// why a vertical-align:middle asterisk reads as "too low" no matter how
// well-centered the glyph itself is within its own box — the box's
// POSITION on the line was the wrong thing. Fixed by abandoning
// vertical-align's keyword-based guess entirely: measure the track's
// actual rendered cap-height via canvas (real ink metrics, not an
// assumed ratio), then shift the glyph by exactly the difference
// between where vertical-align: baseline naturally puts its center
// (boxHeight/2 above the baseline) and where the capital letters' own
// visual center actually sits (capHeight/2 above the baseline).
function alignAsteriskToCapHeight(span, boxHeight, track) {
  document.fonts.ready.then(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    const trackStyle = getComputedStyle(track);
    ctx.font = trackStyle.font || `${trackStyle.fontSize} ${trackStyle.fontFamily}`;
    const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
    const shift = boxHeight / 2 - capHeight / 2;
    span.style.transform = `translateY(${shift}px)`;
  });
}

// Replaces the plain "*" characters in each marquee strip with the
// brown asterisk artwork (assets/images/Brown asterisk.png) instead of
// a bare text glyph or an SVG-built one — a plain raster image sidesteps
// font-metric/line-height quirks (baseline, x-height, glyph ink
// centering) entirely, leaving only the one real remaining problem
// (the box's vertical POSITION within the line), handled by
// alignAsteriskToCapHeight above. Splitting on the literal "*" preserves
// the surrounding &nbsp; spacing already baked into the HTML (it
// survives as plain U+00A0 characters in the split text nodes).
const MARQUEE_ASTERISK_SIZE = 18;
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
        const img = document.createElement("img");
        img.src = "assets/images/Brown asterisk.png";
        img.alt = "";
        span.appendChild(img);
        track.appendChild(span);
        alignAsteriskToCapHeight(span, MARQUEE_ASTERISK_SIZE, track);
      }
    }
  }
}

// Plays the one-time load-in sequence (title -> eyebrows -> nav), driven
// entirely by --intro-delay set per element in the HTML. Double rAF
// ensures the initial opacity:0 state is painted first, so this actually
// transitions instead of jumping straight to visible.
//
// Every --intro-delay is corrected here for time already spent waiting
// on external resources (Google Fonts, the Lenis CDN script — see the
// bare <script> at the very top of <head>) before this function even
// got to run: this function itself only runs on DOMContentLoaded, which
// doesn't fire until every blocking script — including that 3rd-party
// one — has finished loading. On a warm/cached load that's near-
// instant, so it's invisible; on a cold first load (no cached DNS/TLS
// to those hosts yet) it can take real time, and without this
// correction that entire delay gets ADDED on top of each element's
// already-intended --intro-delay, even though the splash's own
// CSS-only timeline (driven by animation-delay, not JS/DOMContentLoaded)
// finishes on schedule regardless — the hero title would then visibly
// lag the now-long-gone splash. Subtracting the elapsed time keeps every
// element anchored to real wall-clock time since navigation start
// instead of "whenever DOMContentLoaded happened to fire."
//
// (A first-paint-anchored version of this correction was tried instead
// of DOMContentLoaded, reasoning that DOMContentLoaded overcounts the
// script-fetch time paint never waited on — but that's backwards: the
// countdown this sets up can only ever start counting once THIS
// FUNCTION runs, which is itself gated by DOMContentLoaded regardless
// of what value gets written to --intro-delay. Anchoring the
// subtraction to paint time instead left the full original delay in
// place on top of a still-late DOMContentLoaded, measurably reproducing
// the ORIGINAL too-late bug on the same slow-Lenis test this comment
// block's fix was verified against — reverted back to DOMContentLoaded
// for that reason.)
//
// Also marks <body> once the whole sequence is genuinely done — see
// .hero__eyebrow-line's CSS: its scroll-linked exit state is scoped to
// body.intro-finished specifically so a fast scroll early on can't
// collide with the eyebrow lines' own intro entrance (both are "not
// .is-visible yet", but need different resting transforms — sliding up
// FROM below to arrive, vs. sliding further up to exit). CRITICAL: this
// timeout must fire AFTER the LATEST --intro-delay + its own
// transition-duration anywhere on the page finishes — currently the
// eyebrow lines themselves (4870ms delay + 1.6s slide-slow = 6470ms,
// +180ms buffer = 6650ms). Firing this too early cuts that transition
// off mid-flight (changing transition-delay while a transition is still
// running effectively breaks it), which looked like "the eyebrows don't
// move at all" when this was hardcoded to 5000ms. Update this number if
// those delays change again — it gets the same elapsed-time correction
// as everything else above.
function initIntroReveal() {
  const introEls = document.querySelectorAll(".intro-reveal");
  if (!introEls.length) return;

  const elapsed = Date.now() - (window.__pageLoadStart || Date.now());
  for (const el of introEls) {
    const original = parseFloat(el.style.getPropertyValue("--intro-delay")) || 0;
    el.style.setProperty("--intro-delay", `${Math.max(0, original - elapsed)}ms`);
  }

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
  }, Math.max(0, 6650 - elapsed));
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
  // Re-measure once the real web font (Freight, a local file, not
  // preloaded) is actually in — if it's still showing its fallback at
  // the point this function first runs, the link measures at the
  // FALLBACK font's width, and the indicator gets sized/positioned to
  // match that. Once Freight swaps in moments later, the link reflows
  // to its real (usually narrower) width, but nothing re-measures the
  // indicator, leaving it visibly off — intermittently, since whether
  // the swap has already happened by the time this runs depends on
  // font-cache state, same root cause as the earlier cold-load timing
  // bug elsewhere in this file.
  document.fonts.ready.then(placeIndicator);
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
  const staggeredTargets = document.querySelectorAll(
    ".square, .image-mosaic__mask, .social-carousel__mask, .quote-block, .publication-card, .split-cta"
  );
  // .partners reveals as ONE unit (slide up + fade, like the hero
  // elements — see .mosaic-reveal/.mosaic-reveal--slide on it in
  // index.html) instead of tile-by-tile per logo, so it's tracked
  // separately: it still needs checkAll() below to toggle its
  // visibility, but must NEVER get a --reveal-delay from the stagger
  // loop (that's what caused the old per-logo cascade).
  const singleUnitTargets = document.querySelectorAll(".partners");
  const targets = [...staggeredTargets, ...singleUnitTargets];
  if (!targets.length) return;

  // Stagger is normalized to a shared TOTAL cascade span per group
  // (600ms end-to-end, divided across that group's own sibling count)
  // rather than a flat per-item ms — a flat value doesn't generalize:
  // section 1's squares span 4 GRID ROWS, so most of their "tile by
  // tile" cascade already comes from tiles at different rows entering
  // the viewport at genuinely different scroll moments, seconds apart;
  // the footer (3 cells) is a single ROW, so all siblings enter the
  // viewport in the exact same instant — the artificial per-item delay
  // is the ONLY thing that can stagger them at all. A flat 40-100ms/step
  // gave section 1's 10+ siblings a full second of spread while giving
  // a 3-item row almost none — reported as the footer "acting like one
  // long rectangle" instead of tiles. Normalizing to a fixed total span
  // means every group gets a comparably obvious cascade regardless of
  // how many siblings it has.
  const CASCADE_SPAN_MS = 600;
  for (const el of staggeredTargets) {
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

  // Gates the respin-on-reset flourish below, not just the resting
  // opacity/transform: prefers-reduced-motion already forces
  // .hero__wordmark-asterisk-wrap's animation to none in CSS (see
  // style.css), but .is-respinning's selector is MORE specific than
  // that override (3 classes vs. 1), so it would still win and
  // re-enable the spin if left to CSS alone. Simplest fix is to never
  // add the class in the first place, same as every other
  // motion-gated feature on this page.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let ticking = false;
  let asteriskReady = false;
  // Tracks the asterisk's PREVIOUS visibility so the respin below only
  // fires on an actual hidden->visible transition (scrolling back up
  // into the hero after having scrolled away) — not on every scroll
  // tick while it's already sitting visible. Seeded properly once
  // asteriskReady flips true (see the "introfinished" listener below),
  // not here — before that point the asterisk isn't being toggled at
  // all yet, so there's no real "previous" state to track.
  let asteriskWasVisible = false;
  const check = () => {
    const rect = hero.getBoundingClientRect();
    const outFraction = Math.max(0, -rect.top) / rect.height;
    const visible = outFraction < 0.05;
    for (const el of alwaysEls) el.classList.toggle("is-visible", visible);
    if (asterisk && asteriskReady) {
      asterisk.classList.toggle("is-visible", visible);
      if (visible && !asteriskWasVisible && !reduceMotion) {
        asterisk.classList.remove("is-respinning");
        void asterisk.offsetWidth;
        asterisk.classList.add("is-respinning");
      }
      asteriskWasVisible = visible;
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
      asteriskWasVisible = e.detail.asteriskVisible;
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

  const PAUSE_MS = 0; // was a deliberate 150ms "beat" between handoffs — removed so the caption ("Read our latest issue!") triggers as soon as its prerequisite genuinely finishes, not later

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
  // Reuses the hero's own asterisk artwork (a plain PNG, rotated via
  // the same hero-asterisk-spin animation the hero itself uses) rather
  // than building a glyph from an SVG <text> element. Contrast against
  // whatever background it's over comes from mix-blend-mode (see CSS),
  // not a JS-driven src swap between 2 fixed color variants — the swap
  // approach needed elementFromPoint + a background-color allowlist on
  // every mousemove, and the transition between the 2 fixed colors was
  // an abrupt, discrete jump rather than a true per-pixel contrast fix.
  const glyph = document.createElement("img");
  glyph.src = "assets/images/Asterisk - Default.png";
  glyph.alt = "";
  glyph.className = "custom-cursor-asterisk";
  wrap.appendChild(glyph);
  document.body.appendChild(wrap);

  // Offset toward the tail end of a standard pointer (which points up-
  // left, tip at the exact mouse position) — down-right of the cursor,
  // just barely overlapping it rather than sitting right underneath.
  // The translate(-50%,-50%) below makes (curX+OFFSET_X, curY+OFFSET_Y)
  // the WRAP'S OWN CENTER, not its top-left corner — without that, this
  // offset would need to separately account for half the glyph's own
  // size just to keep the visible asterisk positioned consistently, and
  // silently drift further away every time the glyph's size changes.
  const OFFSET_X = 20;
  const OFFSET_Y = 24;
  // Lower = more lag/"drag" before catching up to the real cursor.
  // Was bumped to 0.4 earlier to fight a perceived "orbiting" during
  // circular mouse motion — that turned out to be a red herring (the
  // user confirmed live it wasn't actually visible), and the real bug
  // was the glyph.src reassignment thrashing every mousemove event
  // elsewhere in this function (now fixed), which was starving this
  // rAF loop of frames and made the lag look like it had disappeared
  // entirely. Reverted to the original, intentionally floaty value.
  const LERP = 0.14;

  // Real, actually-clickable elements only — not decorative hover targets
  // like .diamond-cta or .square, which already use cursor: default.
  function isClickablePoint(x, y) {
    const node = document.elementFromPoint(x, y);
    return !!node?.closest("a[href], button");
  }

  const HOVER_SCALE = 1.5;
  const SCALE_LERP = 0.25;

  // Spin speed reacts to how fast the REAL mouse is moving (not the
  // lagged follower position — that would add a second delay on top of
  // this one and feel sluggish to react). BASE_DEG_PER_SEC matches the
  // old fixed "8s per rotation" CSS animation this replaces. A fast flick
  // adds up to MAX_BOOST_DEG_PER_SEC on top of that, smoothed by
  // SPIN_LERP so it eases in on a flick and back out again once the
  // mouse slows — the same lerp-toward-a-target pattern already used for
  // position and hover-scale above, just applied to angular speed.
  const BASE_DEG_PER_SEC = 45;
  const SPEED_TO_BOOST = 0.15; // extra deg/sec of spin per px/sec of mouse speed
  const MAX_BOOST_DEG_PER_SEC = 650;
  const SPIN_LERP = 0.35;
  // At 18px, while ALSO chasing a fast-moving cursor, a pure rotation-
  // speed difference isn't perceivable on its own (confirmed: isolated
  // and enlarged, 45deg/sec vs 650deg/sec is obviously different; on
  // the real small, moving glyph it wasn't). Pairing the spin-up with a
  // size pulse — reusing angularSpeed, already smoothed by SPIN_LERP
  // above, as the single source of truth for "how sped up right now" —
  // makes the reaction to speed unmistakable at actual cursor size.
  const SPEED_SCALE_BOOST = 0.6; // extra scale at max angular boost

  // Click burst: adds straight into the SAME per-frame angular-speed
  // system as the mouse-flick boost above, instead of a separately
  // `animation`-driven layer with its own fixed duration — that older
  // approach (a CSS keyframe on a separate wrapper div) had a hard stop
  // the instant the animation ended, which read as an abrupt cut rather
  // than settling into the constant spin. clickBoost instead lerps
  // toward 0 every frame, same as everything else here, so it has no
  // "end" to be abrupt about — it just asymptotically fades into
  // whatever angularSpeed already is.
  const CLICK_BOOST_DEG_PER_SEC = 3600; // instantaneous spike per click
  const CLICK_BOOST_LERP = 0.08; // lower = longer tail before it's imperceptible

  let mouseX = -100;
  let mouseY = -100;
  let curX = -100;
  let curY = -100;
  let started = false;
  let targetScale = 1;
  let curScale = 1;
  let prevMouseX = mouseX;
  let prevMouseY = mouseY;
  let angularSpeed = BASE_DEG_PER_SEC;
  let clickBoost = 0;
  let rotationDeg = 0;
  let lastFrameTime = null;

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
      targetScale = isClickablePoint(e.clientX, e.clientY) ? HOVER_SCALE : 1;
    },
    { passive: true }
  );

  // Additive (not reset) — a rapid double-click stacks a second spike on
  // top of whatever's left of the first instead of restarting it, so
  // repeat clicks feel like they're compounding rather than each one
  // clipping the last.
  window.addEventListener(
    "click",
    () => {
      clickBoost += CLICK_BOOST_DEG_PER_SEC;
    },
    { passive: true }
  );

  function raf(time) {
    if (lastFrameTime === null) lastFrameTime = time;
    const dt = (time - lastFrameTime) / 1000;
    lastFrameTime = time;

    const mouseSpeed = dt > 0 ? Math.hypot(mouseX - prevMouseX, mouseY - prevMouseY) / dt : 0;
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    const targetAngularSpeed = BASE_DEG_PER_SEC + Math.min(mouseSpeed * SPEED_TO_BOOST, MAX_BOOST_DEG_PER_SEC);
    angularSpeed += (targetAngularSpeed - angularSpeed) * SPIN_LERP;
    clickBoost += (0 - clickBoost) * CLICK_BOOST_LERP;
    rotationDeg = (rotationDeg + (angularSpeed + clickBoost) * dt) % 360;
    const speedScale = 1 + ((angularSpeed - BASE_DEG_PER_SEC) / MAX_BOOST_DEG_PER_SEC) * SPEED_SCALE_BOOST;
    glyph.style.transform = `rotate(${rotationDeg}deg) scale(${speedScale})`;

    curX += (mouseX - curX) * LERP;
    curY += (mouseY - curY) * LERP;
    curScale += (targetScale - curScale) * SCALE_LERP;
    wrap.style.transform = `translate(${curX + OFFSET_X}px, ${curY + OFFSET_Y}px) translate(-50%, -50%) scale(${curScale})`;
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// Roles grid (Interviewer/Columnist/Editor/Designer) reveals its
// description on :hover in CSS — no help at all on a device with no
// real hover. Gated to hover-incapable devices only (same feature
// query initCustomCursor() uses, just negated): on a real mouse, hover
// already does this, and layering a click toggle on top there too
// would let a tap-then-move-away leave a tile stuck open. Listens on
// the whole tile, not just .square__role-tap-btn (that's purely a
// visual "tap me" affordance, styled in style.css) — a bigger touch
// target than a 32px diamond, and any tap inside the tile (including
// the button itself) bubbles up to this one listener.
function initRoleTapReveal() {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const tiles = document.querySelectorAll(".square--role-reveal");
  for (const tile of tiles) {
    tile.addEventListener("click", () => {
      tile.classList.toggle("is-tapped");
    });
  }
}

// Section 4's carousel: prev/next just move .social-carousel__track by
// one slide-width via transform, wrapping past either end instead of
// stopping — modulo (index + slideCount) % slideCount handles both
// directions in one expression (JS's own % can return negative for a
// negative left-hand side, e.g. -1 % 4 === -1, not 3 — adding
// slideCount first keeps it always positive before the real mod).
function initSocialCarousel() {
  const track = document.querySelector(".social-carousel__track");
  const prevBtn = document.querySelector(".social-carousel__nav--prev");
  const nextBtn = document.querySelector(".social-carousel__nav--next");
  if (!track || !prevBtn || !nextBtn) return;

  const slideCount = track.children.length;
  let index = 0;

  const render = () => {
    track.style.transform = `translateX(-${index * (100 / slideCount)}%)`;
  };

  prevBtn.addEventListener("click", () => {
    index = (index - 1 + slideCount) % slideCount;
    render();
  });
  nextBtn.addEventListener("click", () => {
    index = (index + 1) % slideCount;
    render();
  });
}

// Same 3-step reveal chain as initMosaicReveal() (masks finish -> scrim
// fades in -> caption fades in), just extended with the 2 nav buttons
// as a 4th thing that reveals alongside the title/edition — all 3 wait
// on the SAME scrim transitionend, not chained to each other, since
// there's no ordering between them that matters. Only wired up for
// .social-carousel__slide--first: the other 3 slides have no masks/
// scrim.mosaic-reveal to chain from (see the HTML comment above the
// carousel) since they're never scrolled into view, only clicked into.
function initCarouselReveal() {
  const slide = document.querySelector(".social-carousel__slide--first");
  if (!slide) return;

  const masks = slide.querySelectorAll(".social-carousel__mask");
  const scrim = slide.querySelector(".social-carousel__scrim");
  const rest = [
    ...slide.querySelectorAll(".social-carousel__title, .social-carousel__edition"),
    ...document.querySelectorAll(".social-carousel__nav"),
  ];
  if (!masks.length || !scrim) return;

  let doneCount = 0;
  for (const mask of masks) {
    mask.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName !== "opacity") return;
        doneCount += 1;
        if (doneCount < masks.length) return;
        scrim.classList.add("is-visible");
      },
      { once: true }
    );
  }

  scrim.addEventListener(
    "transitionend",
    (e) => {
      if (e.propertyName !== "opacity") return;
      for (const el of rest) el.classList.add("is-visible");
    },
    { once: true }
  );
}
