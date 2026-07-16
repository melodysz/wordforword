// Word for Word — skeleton interactivity

document.addEventListener("DOMContentLoaded", () => {
  initNavHighlight();
  initLuxuryScroll();
  initRevealOnScroll();
});

// Highlights the nav link matching the section currently in view.
function initNavHighlight() {
  const navLinks = Array.from(document.querySelectorAll(".nav__links a"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = `#${entry.target.id}`;
        for (const link of navLinks) {
          link.classList.toggle("is-active", link.getAttribute("href") === id);
        }
      }
    },
    { rootMargin: "-40% 0px -50% 0px" }
  );

  for (const section of sections) observer.observe(section);
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

// Fades + rises each square / card / block into place as it enters the
// viewport, with a slight per-column stagger inside each grid row.
function initRevealOnScroll() {
  const targets = document.querySelectorAll(
    ".square, .feature-banner, .quote-block, .publication-card, .partners__logo, .intro-line, .split-cta"
  );
  if (!targets.length) return;

  for (const el of targets) {
    el.classList.add("reveal");
    const grid = el.closest(".square-grid--4col");
    if (grid) {
      const index = Array.from(grid.children).indexOf(el);
      el.style.setProperty("--reveal-delay", `${(index % 4) * 70}ms`);
    }
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );

  for (const el of targets) observer.observe(el);
}
