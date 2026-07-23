// Word for Word — skeleton interactivity

// This file is shared verbatim across every page, including generated
// article pages one folder deep (articles/<slug>.html — see
// templates/_header.html and scripts/build_articles.py). A hardcoded
// "assets/images/..." path resolves relative to the CURRENT PAGE's own
// URL, not to this file's location, so it 404s from a subdirectory. Any
// asset path this file builds up itself (not already written into the
// page's own HTML) needs this prefix.
const ASSET_BASE = location.pathname.includes("/articles/") ? "../" : "";

// How far the hero has to scroll out of view (as a fraction of its own
// height) before it's treated as "left" for scroll-linked reset purposes.
// Shared between initIntroReveal() (seeding the hero asterisk's initial
// visibility on the intro/scroll handoff) and initHeroEyebrowExit() (the
// ongoing scroll-linked reset) — both need to agree on the same
// definition of "visible," or the seeded value on handoff could
// contradict what the ongoing check computes moments later.
const HERO_EXIT_THRESHOLD = 0.95;

// Only ever true when index.html's own inline <head> script (right after
// __pageLoadStart) found the one-shot sessionStorage flag set — meaning
// this navigation came from clicking the "Overview" nav link (see
// initOverviewSkipsSplash() below), not a fresh reload or the logo
// (initLogoSecretEntry() below). That script already added
// html.skip-intro-splash synchronously, hiding the splash before first
// paint (see style.css) — this constant just lets initIntroReveal() know
// to also shift the HERO's own entrance earlier, instead of it still
// waiting out the (now invisible) splash's multi-second head start.
const SKIP_INTRO_SPLASH = document.documentElement.classList.contains("skip-intro-splash");
// Subtracted from every --intro-delay AND the final anchor timeout in
// initIntroReveal(), on top of the normal elapsed-time correction —
// chosen so the EARLIEST --intro-delay in index.html (3220ms, the
// title's first word) lands at a small, still-deliberate ~100ms instead
// of 0. The whole staggered choreography (title -> eyebrows -> header)
// shifts as one block, preserving its existing relative timing exactly,
// just starting right away instead of after the splash.
const SKIP_INTRO_SPLASH_OFFSET_MS = SKIP_INTRO_SPLASH ? 3120 : 0;

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
  initIntroSplashHold();
  initIntroScrollLock();
  initHeroAsteriskPosition();
  initRevealOnScroll();
  initMosaicReveal();
  initSplitCtaReveal();
  initHeroEyebrowExit();
  initMarqueeAsterisks();
  initMarqueeCentering();
  initCustomCursor();
  initRoleTapReveal();
  initFeaturedCarousel();
  initCarouselReveal();
  initLogoSecretEntry();
  initOverviewSkipsSplash();
  initPublicationsDropdown();
});

// Manages .nav__dropdown-is-open on .site-header via real JS state (a
// grace-period timer), rather than a live CSS :has(...:hover) condition
// — see .nav__dropdown-hover-zone's own CSS comment for exactly why a
// pure-CSS condition doesn't work here: the hover zone needs its own
// pointer-events to already be "auto" the instant the cursor leaves the
// trigger heading toward it, but a :has(trigger:hover) condition (which
// pointer-events would have to be keyed off) reverts to false in that
// SAME instant, since it's recomputed live on every mousemove — verified
// via Playwright (instrumenting pointer-events and :hover directly frame
// by frame) that this produces a real window where NEITHER element can
// be hovered, reported as the dropdown "jittering" as it starts to open.
// mouseenter on the trigger sets the class (and, in the same synchronous
// step, the zone's pointer-events) BEFORE the cursor ever needs to reach
// the zone; a real elapsed-time grace period (not a same-tick CSS
// recomputation) is what decides when it later reverts, so a fast-
// moving cursor crossing between the two never finds a moment where
// neither is hoverable.
function initPublicationsDropdown() {
  const trigger = document.querySelector(".nav__item--publications");
  const header = document.querySelector(".site-header");
  const hoverZone = document.querySelector(".nav__dropdown-hover-zone");
  if (!trigger || !header || !hoverZone) return;

  // Matches the CSS close-curve's own no-longer-needed 160ms debounce
  // (removed from CSS — this timer replaces it, see that rule's comment).
  const CLOSE_GRACE_MS = 160;
  let closeTimer = null;

  const open = () => {
    clearTimeout(closeTimer);
    header.classList.add("nav__dropdown-is-open");
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      header.classList.remove("nav__dropdown-is-open");
    }, CLOSE_GRACE_MS);
  };

  // .nav__dropdown itself (the real, clickable links) doesn't need its
  // own listeners — it's a DOM descendant of `trigger`, and
  // mouseenter/mouseleave (unlike mouseover/mouseout) only fire when the
  // cursor truly enters/exits an element INCLUDING all its descendants,
  // so moving into the dropdown's own links never fires trigger's
  // mouseleave in the first place.
  for (const el of [trigger, hoverZone]) {
    el.addEventListener("mouseenter", open);
    el.addEventListener("mouseleave", scheduleClose);
  }
}

// Unadvertised entry point to the Decap CMS admin panel for club members —
// triple-clicking the nav logo opens it in a new tab, instead of the
// logo's own single-click "go home" behavior. Every click is intercepted
// (not just the 3rd) rather than relying on the native click event's own
// `detail` count: letting the 1st click's default <a href> navigation
// fire immediately would leave the current page before a 2nd/3rd click
// could ever be counted, especially on any page other than the homepage
// itself. Reimplementing "go home" ourselves after a short window with
// fewer than 3 clicks keeps ordinary single/double clicks behaving
// exactly as before.
function initLogoSecretEntry() {
  const logo = document.querySelector(".nav__logo");
  if (!logo) return;

  const homeHref = logo.getAttribute("href");
  const CLICK_WINDOW_MS = 500;
  let clickCount = 0;
  let resetTimer = null;

  logo.addEventListener("click", (e) => {
    e.preventDefault();
    clickCount++;
    clearTimeout(resetTimer);

    if (clickCount >= 3) {
      clickCount = 0;
      window.open(`${ASSET_BASE}admin/`, "_blank");
      return;
    }

    resetTimer = setTimeout(() => {
      clickCount = 0;
      window.location.href = homeHref;
    }, CLICK_WINDOW_MS);
  });
}

// The "Overview" nav link (always the first .nav__links item — see
// templates/_header.html) is the ONE way of reaching index.html that
// should skip the intro splash, per explicit request — a fresh reload
// or clicking the logo (initLogoSecretEntry() above) should still play
// it. Since every navigation here is a real full page load (no client-
// side routing), the only way to signal "skip it" across that reload is
// a one-shot sessionStorage flag, read and immediately cleared by
// index.html's own inline <head> script — see that script + the
// html.skip-intro-splash rules in style.css for the other half of this.
function initOverviewSkipsSplash() {
  const overviewLink = document.querySelector(".nav__links > li:first-child > a");
  if (!overviewLink) return;
  overviewLink.addEventListener("click", () => {
    sessionStorage.setItem("wfw-skip-intro-splash", "1");
  });
}

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
//
// Operates on each track's own child TEXT NODES only (not
// track.textContent as a whole) — every track now has real element
// children (.marquee-banner__word--* spans, one per face; see index.html
// and scripts/build_articles.py's buildMarqueeCycle()) sitting between
// the "*" separators, and collapsing to textContent would flatten them
// to plain text, destroying their font overrides.
const MARQUEE_ASTERISK_SIZE = 14; // MUST match .marquee-asterisk img's height in style.css
function initMarqueeAsterisks() {
  const tracks = document.querySelectorAll(".marquee-banner__track");
  for (const track of tracks) {
    // Snapshot first — inserting/removing nodes while iterating the live
    // childNodes list would skip or repeat entries.
    for (const node of Array.from(track.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || !node.data.includes("*")) continue;
      const parts = node.data.split("*");
      for (let i = 0; i < parts.length; i++) {
        track.insertBefore(document.createTextNode(parts[i]), node);
        if (i < parts.length - 1) {
          const span = document.createElement("span");
          span.className = "marquee-asterisk";
          const img = document.createElement("img");
          img.src = `${ASSET_BASE}assets/images/Brown asterisk.png`;
          img.alt = "";
          span.appendChild(img);
          track.insertBefore(span, node);
          alignAsteriskToCapHeight(span, MARQUEE_ASTERISK_SIZE, track);
        }
      }
      track.removeChild(node);
    }
  }
}

// text-align:center does NOT symmetric-center an overflowing
// .marquee-banner__track the way it might look like it should — that
// only holds for a line that FITS inside its container. Once the line
// is wider than the container (true of every marquee strip site-wide:
// white-space:nowrap + far more repeated words than fit any real
// viewport, by design), confirmed empirically (a standalone test case,
// same CSS) that it instead renders flush against the box's own left
// edge with the entire overflow spilling out to the right, not split
// evenly across both sides. Corrected the same way positionHeroAsterisk
// handles its own metric mismatch: measure each track's real rendered
// position, then nudge with a corrective transform, rather than trust a
// CSS assumption that doesn't hold here.
//
// Targets the MIDDLE Freight occurrence by index, not "whichever is
// nearest the viewport's center" (an earlier version) — proximity-based
// picking could land on an occurrence near either end of the repeating
// sequence depending on viewport width, leaving too few full cycles
// buffering ONE side and exposing the sequence's hard start/end as a
// visible gap (confirmed empirically at several widths). The middle
// occurrence always has the same number of full cycles on both sides
// regardless of viewport width, and centers just as exactly — every
// occurrence within one track is the identical word, so which specific
// one lands at dead-center is invisible to the eye.
function centerMarqueeTrack(track) {
  // Reset before measuring — otherwise a stale correction from a
  // previous run (e.g. before a resize) would be baked into this run's
  // own measurement, compounding instead of replacing it.
  track.style.transform = "none";
  const capsSpans = track.querySelectorAll(".marquee-banner__word--caps");
  if (!capsSpans.length) return;
  const target = capsSpans[Math.floor(capsSpans.length / 2)];
  const rect = target.getBoundingClientRect();
  const center = (rect.left + rect.right) / 2;
  const delta = window.innerWidth / 2 - center;
  track.style.transform = `translateX(${delta}px)`;
}

function centerMarqueeTracks() {
  for (const track of document.querySelectorAll(".marquee-banner__track")) {
    centerMarqueeTrack(track);
  }
}

function initMarqueeCentering() {
  centerMarqueeTracks();
  // Re-measure once the real webfonts (Freight/Instrument/Kapakana) are
  // actually in — same fallback-vs-real-font reflow reasoning as
  // positionHeroAsterisk.
  document.fonts.ready.then(centerMarqueeTracks);
  window.addEventListener("resize", centerMarqueeTracks);
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
  if (!introEls.length) {
    // Secondary pages (articles, publications listing, etc.) have no
    // homepage intro sequence to choreograph against — nothing to wait
    // for, so body.intro-finished should be set immediately rather than
    // left unset forever. Plenty of sitewide CSS (e.g. the Publications
    // dropdown's own height transition) is gated on this class.
    document.body.classList.add("intro-finished");
    return;
  }

  // The hero asterisk (.hero__wordmark-asterisk-wrap) also carries an
  // --intro-delay, read by its own CSS `animation-delay` instead of the
  // shared .intro-reveal/is-visible transition mechanism — but its clock
  // starts ticking from page parse time, uncorrected, while every
  // .intro-reveal element's delay below gets the SAME elapsed time
  // subtracted off before its transition even starts. Left uncorrected,
  // the asterisk would still pop in on schedule (page-parse-time +
  // 4630ms) even on a slow load where the correction below pushes the
  // title's own reveal later than that — i.e. exactly "asterisk visible
  // while the title is still animating in." It gets the SAME elapsed-time
  // subtraction as every .intro-reveal element below, via its own
  // (separate) list — deliberately NOT merged into introEls: is-visible
  // gets added to introEls a few lines down, and the generic .is-visible
  // { opacity: 1 } rule would immediately win the cascade over this
  // element's opacity:0 base rule (same specificity, later in the
  // stylesheet) for the entire animation-delay window before its own
  // `animation` is even running to override it back — i.e. visible from
  // frame 1, never actually playing its pop-in. Correcting only its
  // --intro-delay, without ever touching its classList, avoids that.
  const asteriskWrap = document.querySelector(".hero__wordmark-asterisk-wrap");
  const timedEls = asteriskWrap ? [...introEls, asteriskWrap] : Array.from(introEls);

  // + SKIP_INTRO_SPLASH_OFFSET_MS: 0 normally (no-op); when the splash
  // itself was skipped, this folds the "start earlier" shift into the
  // SAME subtraction already used for real elapsed-load-time correction
  // below (and into the final anchor timeout further down, which reuses
  // this same `elapsed`), rather than needing a second code path.
  const elapsed = Date.now() - (window.__pageLoadStart || Date.now()) + SKIP_INTRO_SPLASH_OFFSET_MS;
  for (const el of timedEls) {
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
      asteriskVisible = Math.max(0, -rect.top) / rect.height < HERO_EXIT_THRESHOLD;
    }
    document.body.classList.add("intro-finished");
    // initHeroEyebrowExit() listens for this to do its FIRST sync of the
    // hero asterisk specifically — see that function for why.
    document.dispatchEvent(new CustomEvent("introfinished", { detail: { asteriskVisible } }));
  }, Math.max(0, 6650 - elapsed));
}

// Keeps the intro splash lingering on its final "00" logo screen until
// the page is ACTUALLY ready, instead of sliding away on a fixed
// 2480ms timer regardless — that fixed timer is what let a slow
// connection show the splash (and the hero's own CSS-driven asterisk)
// finish right on schedule while the JS-driven main content
// (initIntroReveal()'s title/eyebrows/nav, gated on DOMContentLoaded)
// was still stuck invisible behind it, so the splash cleared onto a
// still-blank page. Waits for the LATER of two things:
//   1. The original minimum visual time (2480ms, elapsed-corrected the
//      same way every other intro timing on this page is) — so on a
//      normal connection this behaves EXACTLY as before, no added
//      delay.
//   2. Real readiness: fonts finished loading (avoids revealing the
//      title in a fallback font and then visibly swapping the instant
//      the splash clears) — capped at a hard 8s timeout so a
//      genuinely broken/never-loading resource can't hold the splash
//      forever.
// DOMContentLoaded itself isn't part of the readiness race here: this
// function only runs from inside that event's own handler, so by
// construction it's already true by the time this code executes.
function initIntroSplashHold() {
  const splash = document.querySelector(".intro-splash");
  // Already force-hidden by the html.skip-intro-splash CSS rule (see
  // style.css) — no point racing fonts/timers to reveal a splash that's
  // permanently opacity:0 either way.
  if (!splash || SKIP_INTRO_SPLASH) return;

  const MIN_VISUAL_MS = 2480; // matches the slide-away delay this replaces
  const READY_TIMEOUT_MS = 8000;

  const elapsed = Date.now() - (window.__pageLoadStart || Date.now());
  const minVisualTime = new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, MIN_VISUAL_MS - elapsed));
  });
  const readiness = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT_MS)),
  ]);

  Promise.all([minVisualTime, readiness]).then(() => {
    splash.classList.add("is-ready-to-slide");
  });
}

// Removes html.intro-scroll-locked (see style.css) once the splash has
// ACTUALLY finished sliding away — not a fixed guess at a duration, so
// this stays correct even if any of the intro's own timings change
// later. The grey layer (.intro-splash-layer--grey) is the last of the
// 3 stacked full-screen layers to clear (see the HTML/CSS comments
// above the splash for the brown/grey "rapidfire cascade" order), so
// its own slide finishing is the exact moment the real page is fully
// uncovered and safe to scroll again. No-op if the splash was skipped
// entirely (see SKIP_INTRO_SPLASH above) — nothing was ever locked to
// unlock, since the html.intro-scroll-locked class is only added in the
// first place when NOT skipping (see index.html's own inline <head>
// script).
function initIntroScrollLock() {
  if (SKIP_INTRO_SPLASH) return;
  const greyLayer = document.querySelector(".intro-splash-layer--grey");
  if (!greyLayer) return;
  greyLayer.addEventListener(
    "animationend",
    () => {
      document.documentElement.classList.remove("intro-scroll-locked");
    },
    { once: true }
  );
}

// Pins the hero asterisk to the actual top-right corner of the "d" in
// the second "Word" (measured via .hero__wordmark-d-anchor, a plain
// marker span around just that letter), instead of the CSS fallback
// (top: 50%; right: -13%, a %-of-.hero__wordmark-wrap position). That
// CSS-only position can't track the glyph reliably: .hero__wordmark-wrap's
// width and the word's own font-size are two INDEPENDENT clamp()s with
// different viewport breakpoints (1000/1727px vs 700/1293px), so they're
// only proportional to each other in the narrow band where both happen
// to be unclamped at once — outside it, one is pinned while the other
// keeps scaling, and the asterisk drifts off the "d" by tens of px.
// Measuring the real glyph sidesteps that mismatch entirely.
// Vertical translate component of an element's OWN current transform —
// read-only, no mutation. Used to recover the PERMANENT design nudges
// (see positionHeroAsterisk) without ever touching a live element's
// class/transition state.
function getTranslateY(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  return new DOMMatrix(t).m42;
}

// Walks the offsetParent chain from `el` up to (not including) `ancestor`,
// summing offsetTop/offsetLeft — el's LAYOUT position relative to
// ancestor, with every `transform` anywhere in between completely
// ignored (offsetTop/Left are pre-transform layout values; transform is
// purely a paint-time effect and never factors into them, including an
// element's OWN transform).
function offsetRelativeTo(el, ancestor) {
  let top = 0;
  let left = 0;
  for (let node = el; node && node !== ancestor; node = node.offsetParent) {
    top += node.offsetTop;
    left += node.offsetLeft;
  }
  return { top, left };
}

function positionHeroAsterisk() {
  const wrap = document.querySelector(".hero__wordmark-wrap");
  const anchor = document.querySelector(".hero__wordmark-d-anchor");
  const asteriskWrap = document.querySelector(".hero__wordmark-asterisk-wrap");
  if (!wrap || !anchor || !asteriskWrap) return;

  // offsetTop/Left (not getBoundingClientRect) for the anchor: the "d"'s
  // own ancestor (.hero__title-exit) carries a scroll-linked
  // translateY(-100px) exit transform, live only while scrolled away —
  // getBoundingClientRect bakes that in if measured at the wrong moment
  // (confirmed live: a 100px vertical error that then just sits there,
  // since nothing re-measures on scroll alone). An earlier attempt fixed
  // this by temporarily forcing that ancestor into its resting state
  // (toggling classes + transition:none) before reading — but that
  // MUTATES the live element, and doing so while its own class-triggered
  // reveal transition hadn't started yet (still inside its
  // transition-delay countdown) or was mid-flight forced it to snap
  // instantly to its target instead of resuming — confirmed live: it
  // permanently broke the word's intended 3700ms-delayed slide-in
  // entrance, since the interrupted transition has nothing left to
  // finish once restored. offsetTop/Left is read-only and sidesteps
  // the whole problem: it ignores every transform up the chain
  // (including that exit one) with zero risk of touching anything live.
  //
  // Ignoring ALL transforms also drops the PERMANENT design nudges
  // sitting in the same ancestor chain (.hero__wordmark-placeholder's
  // translateY(-10px), .hero__wordmark-word--2's translateY(-3px) —
  // both always-on, no class toggle involved, so reading them via
  // getComputedStyle is safe: a plain read, no mutation, can't interfere
  // with anything's timeline). Added back explicitly below. Neither of
  // these transforms is horizontal, so LEFT was never affected by any
  // of this — anchor.offsetWidth/offsetLeft is used as-is.
  const anchorOffset = offsetRelativeTo(anchor, wrap);
  const placeholder = document.querySelector(".hero__wordmark-placeholder");
  const word2 = document.querySelector(".hero__wordmark-word--2");
  const permanentNudgeY =
    (placeholder ? getTranslateY(placeholder) : 0) + (word2 ? getTranslateY(word2) : 0);
  const anchorTop = anchorOffset.top + permanentNudgeY;
  const anchorRight = anchorOffset.left + anchor.offsetWidth;

  // asteriskWrap's own size still needs offsetWidth/Height, not
  // getBoundingClientRect — its `transform` briefly holds a scale/rotate
  // mid-flight during its pop-in and its scroll-triggered respin (see
  // .is-respinning below), and a rotated getBoundingClientRect returns
  // the enlarged axis-aligned box of that rotation, not its plain size.
  const asteriskWidth = asteriskWrap.offsetWidth;
  const asteriskHeight = asteriskWrap.offsetHeight;

  // Centers the asterisk box ON the "d"'s top-right corner point (not
  // flush against it) — reads as the asterisk straddling the corner,
  // matching how it originally sat when the two clamp()s above happened
  // to briefly agree. Right-nudge bumped repeatedly per explicit
  // follow-up feedback: +2 -> +4 -> +5 -> +6. Down-nudge bumped
  // repeatedly per explicit follow-up feedback: +5 -> +20 -> +35 -> +34
  // (1px up).
  asteriskWrap.style.top = `${anchorTop - asteriskHeight / 2 + 34}px`;
  asteriskWrap.style.left = `${anchorRight - asteriskWidth / 2 + 6}px`;
  asteriskWrap.style.right = "auto";
}

function initHeroAsteriskPosition() {
  const wrap = document.querySelector(".hero__wordmark-wrap");
  const anchor = document.querySelector(".hero__wordmark-d-anchor");
  positionHeroAsterisk();
  // Re-measure once the real web font is actually in — same fallback-vs-
  // real-font reflow reasoning as initNavHighlight()'s placeIndicator.
  document.fonts.ready.then(positionHeroAsterisk);
  // Both a ResizeObserver AND the window "resize" event — deliberately
  // redundant (positionHeroAsterisk is cheap and idempotent, so firing
  // twice for the same change is harmless). Neither alone covers every
  // case: ResizeObserver reacts to the OBSERVED element's own box
  // changing size, which is smoother than "resize" during a continuous
  // drag (that event is coarsely throttled by the browser) — but
  // .hero__wordmark-wrap's width (clamp(220px, 22vw, 380px)) sits
  // clamped flat at its 220px minimum for any viewport under 1000px,
  // so ResizeObserver watching just the wrap never fires again anywhere
  // in that whole range even though the word's font-size
  // (clamp(104px, 14.85vw, 192px), a DIFFERENT breakpoint, 700px) is
  // still actively changing size in part of it — confirmed live: a
  // single 900px->700px resize left the asterisk stuck at its stale
  // 900px position, since the wrap's own box genuinely never resized.
  // Observing the anchor covers that (its box does change with
  // font-size), and "resize" covers it unconditionally regardless of
  // which element's box happens to change.
  if (window.ResizeObserver && wrap) {
    const ro = new ResizeObserver(positionHeroAsterisk);
    ro.observe(wrap);
    if (anchor) ro.observe(anchor);
  }
  window.addEventListener("resize", positionHeroAsterisk);
}

// Highlights the nav link for the page currently loaded (each link is a
// real separate page, not a same-page section) with a static underline
// under that link only.
function initNavHighlight() {
  const navLinks = Array.from(document.querySelectorAll(".nav__links a"));
  const indicator = document.querySelector(".nav__indicator");
  if (!navLinks.length || !indicator) return;

  const currentFile = location.pathname.split("/").pop() || "index.html";
  // Article pages live under articles/<slug>.html, which never matches a
  // literal nav href — fall back to highlighting "Publications*" for
  // those rather than the default first-link fallback below.
  const isArticlePage = location.pathname.includes("/articles/");
  const activeLink =
    navLinks.find((link) => link.getAttribute("href") === currentFile) ||
    // Article pages' own nav links carry a "../" prefix (see BASE in
    // scripts/build_articles.py), so this can't be a strict equality
    // check against "publications.html" the way currentFile's match
    // above is.
    (isArticlePage && navLinks.find((link) => link.getAttribute("href").endsWith("publications.html"))) ||
    navLinks[0];
  activeLink.classList.add("is-active");

  // getBoundingClientRect() (viewport-relative, then subtracted against
  // the indicator's own container) rather than offsetLeft/offsetWidth —
  // offsetLeft is relative to the nearest POSITIONED ancestor, which
  // silently changes per-link: .nav__item--publications has its own
  // position:relative (needed as .nav__dropdown's containing block, see
  // that HTML comment), making IT the offsetParent for "Publications*"
  // specifically, while every other link's offsetParent stays whatever
  // it was before — so offsetLeft measured 0 (relative to that link's
  // own now-positioned <li>) instead of its true position in the bar,
  // placing the indicator at the wrong spot only when Publications was
  // the active link. getBoundingClientRect() is immune to this: it's
  // real rendered geometry, independent of the offsetParent chain.
  const placeIndicator = () => {
    const containerRect = indicator.parentElement.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    indicator.style.left = `${linkRect.left - containerRect.left}px`;
    indicator.style.width = `${linkRect.width}px`;
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
// Lenis loads with the `async` attribute (see index.html) specifically
// so a slow/blocked request to its CDN can't delay DOMContentLoaded (and
// therefore the whole intro reveal) the way a plain blocking <script>
// would — but that means it can genuinely still be in flight by the
// time this runs. The inline `onload` on that <script> tag dispatches
// "lenisready" once it actually arrives; retry once instead of just
// giving up on smooth-scroll for the rest of the session.
function initLuxuryScroll() {
  if (typeof Lenis === "undefined") {
    window.addEventListener("lenisready", initLuxuryScroll, { once: true });
    return;
  }

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
  // .split-cta__illustration-tile (not .split-cta itself — see the CSS
  // comment above this same selector list) is what gives section 3's
  // illustration box its tile-by-tile cascade: 4 tiles sharing one
  // parent, same stagger math as any other square-grid.
  const staggeredTargets = document.querySelectorAll(
    ".square, .split-cta__illustration-tile, .image-mosaic__mask, .featured-carousel__mask, .quote-block, .publication-card"
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
      // Guarded with contains() now — calling classList.add()/remove()
      // for a token that's already (not) present still fires a genuine
      // MutationObserver "attributes" mutation, even though the
      // resulting class string is unchanged (a real, surprising browser
      // behavior, not a spec violation on our part). This ran
      // UNCONDITIONALLY on every scroll frame for every tracked target,
      // so anything watching one of these elements' class via
      // MutationObserver (see initSplitCtaReveal()) was getting fired
      // dozens of times per second for the ENTIRE duration of active
      // scrolling, not once when visibility genuinely changed —
      // confirmed via direct instrumentation: a single continuous
      // scroll produced ~80 redundant callbacks in 1.4s, each one
      // cancelling and rescheduling initSplitCtaReveal()'s pending
      // reveal, so it could only ever fire once scrolling had been
      // fully still for a longer stretch than its own delay — read as
      // "waits for the whole section to finish, then a big pause."
      if (inView) {
        if (!el.classList.contains("is-visible")) el.classList.add("is-visible");
      } else if (farAway) {
        if (el.classList.contains("is-visible")) el.classList.remove("is-visible");
      }
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

  // Tracks whether the hero was ever scrolled out of view BEFORE the
  // intro sequence's own ~6.65s timeline finishes — a real scenario,
  // not just a dev-testing one: plenty of people scroll well before a
  // page-load animation is done. Without this, a user who scrolls down
  // and back up to the hero DURING that window sees the asterisk just
  // silently sitting there fully visible once intro-finished fires —
  // the "introfinished" handler below deliberately SNAPS straight to
  // the computed visibility with no transition/respin at all (see its
  // own comment: reading layout mid-flight there caused a worse bug,
  // a visible invisible-then-refade flash). That shortcut is correct
  // for the common case (never left the hero at all), but wrong for
  // "scrolled away and came back before intro finished" — which is
  // exactly a hidden->visible transition and deserves the same
  // reveal+respin every OTHER re-entry gets. This flag is what lets the
  // handler tell those two cases apart.
  let scrolledAwayBeforeReady = false;
  const preReadyScrollCheck = () => {
    if (asteriskReady) {
      window.removeEventListener("scroll", preReadyScrollCheck);
      return;
    }
    const rect = hero.getBoundingClientRect();
    if (Math.max(0, -rect.top) / rect.height >= HERO_EXIT_THRESHOLD) scrolledAwayBeforeReady = true;
  };
  const check = () => {
    const rect = hero.getBoundingClientRect();
    const outFraction = Math.max(0, -rect.top) / rect.height;
    const visible = outFraction < HERO_EXIT_THRESHOLD;
    for (const el of alwaysEls) el.classList.toggle("is-visible", visible);
    if (asterisk && asteriskReady) {
      asterisk.classList.toggle("is-visible", visible);
      if (visible && !asteriskWasVisible && !reduceMotion) {
        asterisk.classList.remove("is-respinning");
        void asterisk.offsetWidth;
        asterisk.classList.add("is-respinning");
      } else if (!visible) {
        // .is-respinning's own rule (body.intro-finished
        // .hero__wordmark-asterisk-wrap.is-respinning) is equal-but-later
        // specificity than the :not(.is-visible) hide rule below it in
        // style.css, so leaving it on through a hidden phase makes it WIN
        // the cascade — its animation's forwards-filled opacity:1 then
        // permanently overrides the hide rule's opacity:0. Confirmed
        // live: after the very first respin ever plays, scrolling away
        // again left the asterisk stuck fully visible, forever, since
        // nothing ever removed this class on exit. It's a one-shot
        // flourish anyway — nothing needs it to survive past this point.
        asterisk.classList.remove("is-respinning");
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
  window.addEventListener("scroll", preReadyScrollCheck, { passive: true });
  document.addEventListener(
    "introfinished",
    (e) => {
      asteriskReady = true;
      const visible = e.detail.asteriskVisible;
      if (asterisk) {
        if (scrolledAwayBeforeReady && visible && !reduceMotion) {
          // Genuinely a hidden->visible transition (scrolled away and
          // back before intro finished) — give it the same reveal+respin
          // treatment as every other re-entry, instead of silently
          // snapping straight to visible.
          asterisk.classList.remove("is-respinning");
          asterisk.classList.add("is-visible");
          void asterisk.offsetWidth;
          asterisk.classList.add("is-respinning");
        } else {
          asterisk.classList.toggle("is-visible", visible);
        }
      }
      asteriskWasVisible = visible;
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

// Similar chain to initMosaicReveal() (masks finish -> scrim ->
// captions), applied to section 3, but the first handoff fires EARLY
// rather than waiting for the whole group to finish: the artwork starts
// sliding up + fading in the moment the 3rd tile BEGINS its own fade
// (not once all 4 tiles are done) — "transitionstart" is what catches
// that moment, since it only fires once the tile's own --reveal-delay
// has elapsed and its opacity transition actually starts running, vs.
// "transitionend" which would wait for it to finish. Once the artwork's
// OWN transition finishes, that triggers the 4 text lines to cascade in
// — this second handoff still waits for a finish, not a start, since
// there's nothing after it in the chain to get a head start on. Only the
// tiles are scroll-tracked (see initRevealOnScroll()'s targets); the
// artwork and text lines exist purely to be chained to.
// Deterministic timing, NOT transition events: an earlier version
// triggered the illustration off the trigger tile's own "transitionstart"
// and the text lines off the illustration's "transitionend." That read
// as "everything comes in too late" in practice — transitionstart in
// particular has spotty real-world support (long history of Safari only
// reliably firing transitionend, not transitionrun/transitionstart), so
// the illustration was very likely never getting its intended early
// trigger at all and was instead always falling through to a 1.5s-late
// safety-net timer, with text lagging even further behind that as a
// result. Reading the tile's own --reveal-delay (set deterministically
// by initRevealOnScroll()'s stagger math) and scheduling off plain
// setTimeout instead removes the dependency on any transition event
// firing at all — the illustration now starts EXACTLY when tile 3's own
// fade begins, and the text lines EXACTLY 450ms later (matching
// .split-cta__illustration's own opacity/transform transition duration),
// on every browser, every time.
const SPLIT_CTA_ILLUSTRATION_TRANSITION_MS = 450;
// Big asterisk pops in first, small one chases it — same succession the
// user asked for, using the hero wordmark's own pop-in keyframes
// (hero-asterisk-intro) rather than a new animation.
const SPLIT_CTA_ASTERISK_STAGGER_MS = 180;
function initSplitCtaReveal() {
  const section = document.querySelector(".split-cta");
  if (!section) return;

  const tiles = section.querySelectorAll(".split-cta__illustration-tile");
  const illustration = section.querySelector(".split-cta__illustration");
  const textLines = section.querySelectorAll(".split-cta__text-line");
  const asteriskLarge = section.querySelector(".split-cta__illustration-asterisk-wrap--large");
  const asteriskSmall = section.querySelector(".split-cta__illustration-asterisk-wrap--small");
  if (!tiles.length || !illustration) return;

  const revealIllustration = () => illustration.classList.add("is-visible");
  const revealTextLines = () => {
    for (const line of textLines) line.classList.add("is-visible");
  };
  let asteriskTimer = null;
  const revealAsterisks = () => {
    if (asteriskLarge) asteriskLarge.classList.add("is-visible");
    asteriskTimer = setTimeout(() => {
      if (asteriskSmall) asteriskSmall.classList.add("is-visible");
    }, SPLIT_CTA_ASTERISK_STAGGER_MS);
  };
  const hideAll = () => {
    illustration.classList.remove("is-visible");
    for (const line of textLines) line.classList.remove("is-visible");
    if (asteriskLarge) asteriskLarge.classList.remove("is-visible");
    if (asteriskSmall) asteriskSmall.classList.remove("is-visible");
  };

  // Settled back on tile 3 (index 2) after trying tiles 1/2 — with a
  // real, gradual scroll (not an instant jump), the 4 tiles don't
  // actually reveal in one synced batch the way a synthetic test
  // suggested; each crosses its own reveal threshold at a different
  // moment as the page scrolls. Explicitly wanted: the illustration
  // should start at the same moment tile 3 itself starts (not once the
  // whole grid has already finished), with the text lines still coming
  // last in the chain.
  const triggerTile = tiles[2] || tiles[tiles.length - 1];
  let showTimer = null;
  let textTimer = null;

  // Kept bidirectional (not a one-shot MutationObserver that disconnects
  // after its first fire, as an earlier version did) — the tile itself
  // is scroll-reset by initRevealOnScroll() like every other tile
  // (scrolling far enough away removes its own is-visible so scrolling
  // back re-triggers it), but this function used to only ever listen
  // for the FIRST time that happened, so the illustration/text stayed
  // visible forever afterward regardless of scroll position. Now this
  // mirrors the tile's own state every time it changes, either
  // direction, matching how every other reveal on this page resets.
  // Tracks the last state this function actually acted on — defense in
  // depth alongside the checkAll() fix (see initRevealOnScroll()): even
  // with that fix, this guards against ever re-scheduling/re-hiding for
  // a mutation that didn't represent a genuine visibility change, rather
  // than trusting every MutationObserver callback to mean exactly that.
  let lastKnownVisible = null;
  const sync = () => {
    const nowVisible = triggerTile.classList.contains("is-visible");
    if (nowVisible === lastKnownVisible) return;
    lastKnownVisible = nowVisible;

    clearTimeout(showTimer);
    clearTimeout(textTimer);
    clearTimeout(asteriskTimer);
    if (nowVisible) {
      const delay = parseFloat(triggerTile.style.getPropertyValue("--reveal-delay")) || 0;
      showTimer = setTimeout(() => {
        // Double rAF (same idiom initIntroReveal() already uses, same
        // reason) guarantees the illustration's initial opacity:0 state
        // has genuinely been painted at least once before flipping to
        // is-visible. Needed now specifically because trigger delay can
        // be 0 (see triggerTile above) — a setTimeout(fn, 0) alone isn't
        // guaranteed to land after a real paint, so the browser can
        // coalesce "set opacity:0" and "set opacity:1" into the same
        // frame and skip the transition outright, popping straight to
        // the end state with no visible animation at all.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            revealIllustration();
            revealAsterisks();
            textTimer = setTimeout(revealTextLines, SPLIT_CTA_ILLUSTRATION_TRANSITION_MS);
          });
        });
      }, delay);
    } else {
      hideAll();
    }
  };

  sync();
  const observer = new MutationObserver(sync);
  observer.observe(triggerTile, { attributes: true, attributeFilter: ["class"] });
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
  glyph.src = `${ASSET_BASE}assets/images/Asterisk - Default.png`;
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

// Builds a plain, always-fully-visible stand-in for a slide, for the
// loop-continuity clones below — NOT a blind cloneNode(true). The real
// .featured-carousel__slide--first carries one-time reveal machinery (8
// mask tiles, mosaic-reveal classes on its scrim) that only ever gets
// wired up ONCE, on the ORIGINAL element, by initCarouselReveal(); a
// naive clone of it would carry the SAME masks/mosaic-reveal classes
// but with nothing driving them, so it'd sit permanently in whatever
// pre-reveal (masked-over, invisible scrim) state it happened to be
// cloned in — exactly wrong for something that needs to always look
// identical to the finished slide. Every OTHER real slide already has
// no reveal machinery at all (see the HTML comment above the carousel),
// so this just mirrors that same plain shape regardless of which slide
// it's standing in for. No title/edition/number here — those live on
// the one shared caption outside the track now (see initFeaturedCarousel()),
// carried forward via the source slide's own data-title/data-edition/
// data-number attributes instead of a cloned element.
function buildCarouselLoopClone(sourceSlide) {
  const clone = document.createElement("div");
  clone.className = "featured-carousel__slide";
  clone.setAttribute("aria-hidden", "true");
  clone.dataset.title = sourceSlide.dataset.title ?? "";
  clone.dataset.edition = sourceSlide.dataset.edition ?? "";
  clone.dataset.number = sourceSlide.dataset.number ?? "";
  clone.dataset.articleUrl = sourceSlide.dataset.articleUrl ?? "#";

  const photo = sourceSlide.querySelector(".featured-carousel__photo");
  const placeholder = sourceSlide.querySelector(".featured-carousel__photo-placeholder");
  if (photo) {
    const img = document.createElement("img");
    img.className = "featured-carousel__photo";
    img.src = photo.src;
    img.alt = "";
    clone.appendChild(img);
  } else if (placeholder) {
    const div = document.createElement("div");
    div.className = "featured-carousel__photo-placeholder";
    div.setAttribute("aria-hidden", "true");
    clone.appendChild(div);
  }

  const scrim = document.createElement("div");
  scrim.className = "featured-carousel__scrim";
  scrim.setAttribute("aria-hidden", "true");
  clone.appendChild(scrim);

  const hoverTiles = document.createElement("div");
  hoverTiles.className = "featured-carousel__hover-tiles";
  for (let i = 0; i < 8; i++) {
    const tile = document.createElement("div");
    tile.className = "featured-carousel__hover-tile";
    tile.setAttribute("aria-hidden", "true");
    hoverTiles.appendChild(tile);
  }
  clone.appendChild(hoverTiles);

  return clone;
}

// Section 4's carousel: prev/next move .featured-carousel__track by one
// slide-width via transform. A truly infinite loop, not just wrapping
// the index — clicking "next" on the last real slide used to jump
// straight back to translateX(0), a visible reverse slide all the way
// across the track. Instead, a clone of the first slide is appended
// after the last (and a clone of the last is prepended before the
// first), so continuing past either end slides CONTINUOUSLY into that
// clone — visually identical to the real slide it's a copy of — and
// only once that motion finishes does it snap (transition:none, no
// visible jump) back to the real slide sitting in the same spot,
// closing the loop invisibly.
function initFeaturedCarousel() {
  const track = document.querySelector(".featured-carousel__track");
  const prevBtn = document.querySelector(".featured-carousel__nav--prev");
  const nextBtn = document.querySelector(".featured-carousel__nav--next");
  if (!track || !prevBtn || !nextBtn) return;

  const carousel = document.querySelector(".featured-carousel");
  const captionTitle = document.querySelector(".featured-carousel__title");
  const captionEdition = document.querySelector(".featured-carousel__edition");
  const captionNumber = document.querySelector(".featured-carousel__number");

  const realSlides = Array.from(track.children);
  const realCount = realSlides.length;
  if (realCount < 2) return;

  track.appendChild(buildCarouselLoopClone(realSlides[0]));
  track.insertBefore(buildCarouselLoopClone(realSlides[realCount - 1]), track.firstChild);

  // CSS's own width:400%/flex:0 0 25% are sized for exactly 4 real
  // slides (a sane fallback if this script ever failed to run) — now
  // that there are 2 more (the clones), both need to match the ACTUAL
  // total instead.
  const totalSlides = realCount + 2;
  track.style.width = `${totalSlides * 100}%`;
  for (const slide of track.children) {
    slide.style.flex = `0 0 ${100 / totalSlides}%`;
  }

  // Index 1 (not 0) — the prepended clone occupies slot 0, so the real
  // first slide starts at slot 1.
  let index = 1;

  const render = (animate) => {
    track.style.transition = animate ? "" : "none";
    track.style.transform = `translateX(-${index * (100 / totalSlides)}%)`;
    if (!animate) {
      // Forces the browser to actually apply transition:none before the
      // NEXT render() call re-enables it — otherwise the snap itself
      // could get caught by the real transition and animate visibly,
      // exactly the reverse-slide this exists to avoid.
      track.getBoundingClientRect();
    }
  };
  render(false);

  // The shared caption (see the HTML comment above the carousel)
  // crossfades its own text to match whichever slide is now active —
  // completely decoupled from the track's transform transition, so it
  // fades in place instead of physically sliding past with the image.
  // 500ms, not some shorter value, to actually MATCH the real opacity
  // transition duration these elements get from .mosaic-reveal--slide in
  // style.css (they carry that class too, for the one-time scroll
  // reveal) — swapping text any earlier than the fade-out's own real
  // duration means it happens mid-fade, at partial opacity, which reads
  // as a jarring flash-swap rather than a clean crossfade.
  const CAPTION_FADE_MS = 500;
  const applyCaption = (slide) => {
    if (captionTitle) {
      captionTitle.textContent = slide.dataset.title ?? "";
      // Edition's own href (-> publications.html) is static and set once
      // in the HTML — only the title's target changes per-slide.
      captionTitle.href = slide.dataset.articleUrl || "#";
    }
    if (captionEdition) captionEdition.textContent = slide.dataset.edition ?? "";
    if (captionNumber) captionNumber.textContent = slide.dataset.number ?? "";
  };
  applyCaption(track.children[index]);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const crossfadeCaptionTo = (slide) => {
    if (!carousel || reduceMotion) {
      applyCaption(slide);
      return;
    }
    carousel.classList.add("is-caption-fading");
    window.setTimeout(() => {
      applyCaption(slide);
      carousel.classList.remove("is-caption-fading");
    }, CAPTION_FADE_MS);
  };

  // Clicking faster than the track's own 0.6s transform transition used
  // to let `index` overshoot its valid 0..totalSlides-1 range: retargeting
  // an in-flight CSS transition to a new value never fires transitionend
  // for the interrupted one, so the wraparound-snap logic below could go
  // multiple clicks without ever running. Once `index` overshot,
  // track.children[index] was undefined, which crashed crossfadeCaptionTo
  // mid-fade and left the caption permanently stuck at opacity:0 (see the
  // is-caption-fading rule) — the "goes blank" bug. Ignoring nav clicks
  // until the current transition actually settles keeps `index` always
  // valid, which fixes the caption bug at its root instead of just
  // guarding around a bad index.
  let isAnimating = false;

  track.addEventListener("transitionend", (e) => {
    if (e.propertyName !== "transform") return;
    if (index === totalSlides - 1) {
      index = 1;
      render(false);
    } else if (index === 0) {
      index = realCount;
      render(false);
    }
    isAnimating = false;
  });

  prevBtn.addEventListener("click", () => {
    if (isAnimating) return;
    isAnimating = true;
    index -= 1;
    render(true);
    crossfadeCaptionTo(track.children[index]);
  });
  nextBtn.addEventListener("click", () => {
    if (isAnimating) return;
    isAnimating = true;
    index += 1;
    render(true);
    crossfadeCaptionTo(track.children[index]);
  });
}

// Same 3-step reveal chain as initMosaicReveal() (masks finish -> scrim
// fades in -> caption fades in), just extended with the 2 nav buttons
// as a 4th thing that reveals alongside the title/edition — all 3 wait
// on the SAME scrim transitionend, not chained to each other, since
// there's no ordering between them that matters. Only wired up for
// .featured-carousel__slide--first: the other 3 slides have no masks/
// scrim.mosaic-reveal to chain from (see the HTML comment above the
// carousel) since they're never scrolled into view, only clicked into.
const CAROUSEL_SCRIM_TRIGGER_MASK_COUNT = 4;
function initCarouselReveal() {
  const slide = document.querySelector(".featured-carousel__slide--first");
  if (!slide) return;

  const masks = slide.querySelectorAll(".featured-carousel__mask");
  const scrim = slide.querySelector(".featured-carousel__scrim");
  // Title/edition/number now live outside any slide (see the HTML
  // comment above the carousel) — queried at the document level, not
  // scoped to `slide`, since they're no longer its descendants.
  const rest = [
    ...document.querySelectorAll(".featured-carousel__title, .featured-carousel__edition, .featured-carousel__number"),
    ...document.querySelectorAll(".featured-carousel__nav"),
  ];
  if (!masks.length || !scrim) return;

  // Was masks.length (waits for all 8) — per explicit request, the
  // words/gradient should start appearing once HALF the tiles (4) have
  // revealed, not the last one, so they feel woven into the tile
  // cascade instead of arriving as an afterthought once it's all done.
  const triggerCount = Math.min(CAROUSEL_SCRIM_TRIGGER_MASK_COUNT, masks.length);
  let doneCount = 0;
  for (const mask of masks) {
    mask.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName !== "opacity") return;
        doneCount += 1;
        if (doneCount < triggerCount) return;
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
