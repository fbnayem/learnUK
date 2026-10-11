# Learn UK website: verification report

**Build:** 10 October 2026, `dist/` from `node src/build.mjs`
**Brief:** v2.1 (`/mnt/project-files/brief/learn-uk-website-brief.md`)

## What was used

| Item | Detail |
|---|---|
| Browser engine | Chromium 141 (headless), driven by Playwright 1.56 |
| WebGL in tests | SwiftShader (software). Real GPUs were **not** available. |
| Device emulation | Playwright profiles for Pixel 7 and iPhone 13 (viewport, touch, user agent only; Chromium engine) |
| Accessibility scan | axe-core 4.x, rule sets wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice |
| Performance | Lighthouse 13.5.0, default mobile profile (Moto G Power emulation, simulated slow 4G, 4× CPU slowdown) and desktop preset, against a local static server with no compression |
| Test script | `tests/verify.mjs` (results in `reports/results.json`) |

## Automated checks: 24 of 24 passed

| Check | Result | Detail |
|---|---|---|
| No horizontal overflow on 8 pages × 9 widths | Pass |  |
| No horizontal overflow with 200% text size at 320 and 375px | Pass |  |
| No horizontal overflow at 200% browser zoom (1280px window) | Pass |  |
| Desktop with WebGL gets the enhanced tier and loads 3D | Pass | tier=enhanced, 3D requests=1 |
| Globe pause control is visible and toggles | Pass | true/false |
| WebGL context loss shows the static visual automatically | Pass | false/static/1/false |
| Capable phone (Pixel 7 emulation) gets the simplified tier | Pass | tier=simplified, reason=capable-phone, 3D requests=1 |
| Reduced motion gets the static tier and never downloads 3D | Pass | tier=static, 3D requests=0 |
| Data saver gets the static tier and never downloads 3D | Pass | tier=static, 3D requests=0 |
| Low-end device gets the static tier and never downloads 3D | Pass | tier=static, 3D requests=0 |
| Software WebGL (SwiftShader) gets the static tier and never downloads 3D | Pass | static/software-renderer, 3D requests=0 |
| No WebGL: static tier, fallback image shown, 3D never downloaded | Pass | tier=static, image loaded=true, 3D requests=0 |
| Headline, search and consultation button work before 3D loads | Pass | h1 opacity=1, CTA visible=true, search → "2 courses found" in 1383ms |
| Study dropdown opens with keyboard, Escape closes and returns focus | Pass |  |
| FAQ expands and collapses by mouse and keyboard | Pass |  |
| Course filters: URL prefill, live search, empty state and clear | Pass | 4 courses found → 2 courses found → empty=true → 36 courses found |
| Application journey highlights the step in view | Pass | active step index=3 |
| No script errors or console errors during interaction tests | Pass |  |
| Mobile menu opens by touch, makes page inert, closes with Escape | Pass |  |
| Touch targets at least 44×44 px (excluding inline text links) | Pass |  |
| Enquiry by keyboard: error summary, field links, validation, success state | Pass | summary focused=true, errors=5, bad email caught=true, success={"shown":true,"focus":"H2","name":"Amina"} |
| Enquiry by touch (Pixel 7 emulation) reaches the success state | Pass | visual viewport 839px |
| axe-core: no WCAG 2.2 AA or best-practice violations (8 pages, desktop and mobile) | Pass |  |
| Cumulative layout shift on home load ≤ 0.1 (lab) | Pass | CLS=0.0000 |

Widths tested for overflow: 320, 375, 390, 540, 768, 1024, 1200, 1440 and 1920 px on all 8 pages. Enlarged text was simulated by setting the root font size to 200%; browser zoom by a 640 px viewport at 2× pixel density.

**About the 3D tier tests.** The test machine renders WebGL in software, and the site correctly treats software rendering as a slow device (static tier). To test the tier rules a real GPU would hit, the desktop and Pixel 7 tests report a hardware renderer name to the page; the "Software WebGL" test checks the real behaviour on this machine.

## Lighthouse (lab)

| Page | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| index.html (mobile) | 99 | 100 | 100 | 100 | 1.5 s | 2.1 s | 0 ms | 0 |
| universities.html (mobile) | 99 | 100 | 100 | 100 | 1.7 s | 2.0 s | 0 ms | 0 |
| courses.html (mobile) | 98 | 100 | 100 | 100 | 1.8 s | 2.1 s | 0 ms | 0 |
| application-journey.html (mobile) | 99 | 100 | 100 | 100 | 1.5 s | 1.9 s | 0 ms | 0 |
| services.html (mobile) | 99 | 100 | 100 | 100 | 1.5 s | 1.8 s | 0 ms | 0 |
| about.html (mobile) | 99 | 100 | 100 | 100 | 1.5 s | 1.9 s | 0 ms | 0.016 |
| faqs.html (mobile) | 99 | 100 | 100 | 100 | 1.5 s | 1.8 s | 0 ms | 0.018 |
| contact.html (mobile) | 99 | 100 | 100 | 100 | 1.4 s | 1.8 s | 0 ms | 0 |
| index.html (desktop) | 100 | 100 | 100 | 100 | 0.4 s | 0.5 s | 0 ms | 0 |

Target was mobile performance ≥ 90: met on every page in this lab run. Caveat: because Lighthouse's headless Chrome uses software WebGL here, the home page was measured on the **static tier**. The cost of the real-time 3D scene on real phones and desktops is therefore **not** in these numbers. It loads only after the page's `load` event and an idle period, its module is split out (148 KB gzipped), and it is built in small steps that yield to the main thread, so it should not affect LCP or CLS, but INP and long tasks on real mid-range phones need checking on devices.

Real-user targets (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile) cannot be measured until the site has real traffic.

## Brief requirements and how they are met

- **Hero usable before 3D:** headline, search and consultation button are plain HTML and are never animated or hidden; tested with the 3D request held back for 8 seconds.
- **Three tiers chosen before download:** `chooseTier()` in `src/js/main.js` runs before any 3D request. Static for reduced motion, data saver, 2G/3G, no WebGL, software WebGL, low memory or few CPU cores; simplified for touch-first or small-screen devices and limited memory; enhanced for capable desktops. Override with `?tier=static|simplified|enhanced` for testing.
- **Static render is the placeholder:** the AVIF/WebP/PNG render of the same scene shows until the live canvas has rendered six frames, then cross-fades.
- **Fallbacks:** WebGL context loss, a failed load, or slow frames (render call over 22 ms, or rAF median over 45 ms) remove the canvas and leave the static render.
- **Pausing:** rendering stops when the hero is off screen or the tab is hidden; a visible "Pause animation" button controls the globe.
- **Motion:** one approach (CSS transitions plus small IntersectionObserver and Web Animations helpers). Card tilt only on mouse devices. Cross-document View Transitions for page changes where supported (Chrome, Edge, Safari 18.2+); other browsers navigate normally. All motion reduced under `prefers-reduced-motion`.
- **Mobile:** safe-area insets, `svh` units with `vh` fallback, 44 px targets, mobile menu that makes the page inert while open, landscape layout for short screens.

## Not verified

- **Real Safari (macOS and iOS), Firefox, Edge and Samsung Internet.** Only Chromium was available; WebKit and Firefox Playwright builds are not installed here. Safari-specific items (sticky header with backdrop blur, `svh` units, form zoom, View Transitions) are untested.
- **Real devices and real GPUs.** The live 3D scene was only seen through software rendering. Frame rate, battery and heat on real phones are unknown.
- **The simplified tier on a real phone,** including whether the frame-time guard is too strict or too loose.
- **Screen readers** (VoiceOver, TalkBack, NVDA). axe-core passes, but no manual screen reader pass was done.
- **On-screen keyboard behaviour** on real phones (the form uses standard inputs, `autocomplete`, `inputmode` and scroll padding, but this needs a real device).
- **Enlarged system text** on iOS/Android (only simulated with a 200% root font size).
- **Production hosting:** compression, caching headers and a CDN were not set up; Lighthouse ran without gzip/brotli.

## Placeholders to replace before launch

- University and course data (`src/data/*.json`) is sample data. Names are real UK universities; course lists, fees and intakes are illustrative and labelled as such on the site.
- Photo slots (dashed panels marked "Photo slot") need authentic photography, lit from the upper left to match the 3D scene.
- Student testimonials, team profiles, About copy, contact email (`hello@learnuk.example`), privacy policy and terms.
- The enquiry form validates and shows a success state but **sends nothing**. It needs a destination (email service, CRM or form backend).
- Visa wording on the Services and FAQ pages should be checked against Learn UK's regulatory position on immigration advice.
