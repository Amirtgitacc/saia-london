# Home 3D Pinned Journey — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `home.html` as one continuous, pinned, scroll-driven 3D journey — a single sticky mat that unrolls then stays open while seven content bands reveal over it — then releases the pin into a flat editorial tail.

**Architecture:** Port `js/journey.js`'s scroll spine (damped `p`, camera keyframes, `[data-band]` reveals, `deform`) into a new `js/home-journey.js`, but with `js/home3d.js`'s **light cream studio** lighting. Reuse `js/mat-core.js` unchanged. Markup is shaped so it ports cleanly to a Shopify Liquid theme later.

**Tech Stack:** Vanilla HTML/CSS/JS, Three.js (`vendor/three.min.js`), the SAÏA mat engine (`js/mat-core.js`). No build step, no framework, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-20-home-3d-redesign-design.md`

## Global Constraints

Every task implicitly includes all of these:

- **Dependency-free vanilla.** No GSAP, no Locomotive, no npm packages. Hand-roll like `journey.js`.
- **Brand:** mats are **HIRE ONLY — never "buy"/"for sale"**. £8.50/mat · 2-day hire · min 10 · extra day £1.50/mat · 60+ → reduced quote · NW3 pickup · WhatsApp Cristina 07444 611 914. Mat: 68 × 185 cm × 4 mm, black, natural rubber + PU, non-slip, retail £79 (**reference only**).
- **Voice:** warm, female-led, unpretentious, **British English**. English-only.
- **Palette:** cream `#F5F1E8`, stone `#E9E6DF`, ink `#2B2620`, ink-soft `#6B6358`, line `#DAD4C8`, accent terracotta `#B8624A`. Display serif **Cormorant Garamond**; body serif **Libre Baskerville** (home's existing body font). Don't remove existing UI elements unless this plan says to.
- **Copy:** verbatim from saialondon.com (in the spec / handover). No invented headlines.
- **Shopify portability (mandatory acceptance criteria, all tasks):**
  1. No hardcoded asset URLs in JS — read `window.SAIA_ASSETS.{matGlb,matTexture,matFlatPng}` (literal `'assets/…'` fallback).
  2. Section-shaped markup — journey self-contained in `#top`; each tail item a top-level `<section>`.
  3. One swappable hire entry point — every hire CTA calls `window.SAIA.startHire()`; no scattered checkout logic.
  4. Configurable concierge endpoint — read `window.SAIA_CONFIG.conciergeEndpoint` (fallback `http://localhost:8787/api/concierge`).
  5. Liquid-safe content — no raw `{{`/`{%` in text; flat `assets/` filenames.
- **Verify** (no test runner; this is not a git repo): each task ends with `node --check` on changed JS, a `curl` page smoke, and **you viewing it in the browser**. Run the static server once: `python3 -m http.server 8000` (the page `fetch()`es the `.glb`; `file://` won't work). Open http://localhost:8000/home.html.
- **Light studio, not dark.** Transparent renderer (`alpha:true`), hemisphere + soft warm key, PCF soft shadow, `ShadowMaterial` contact shadow. Never Journey's dark day-arc.

---

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `home.html` | Page markup: boot config, header/nav, `#top` journey (canvas + PNG + 7 bands), flat tail, concierge, home `<style>` (band layout + `.is-static` fallback) | Rewrite |
| `js/home-journey.js` | The 3D controller — light studio, mat unroll-then-open, camera keyframes, band reveals, damped scroll, fallback trigger | Create |
| `js/home.js` | Mobile nav drawer + Option-B concierge + `window.SAIA.startHire()`; **parallax `tick()` removed**; concierge endpoint from config | Modify |
| `js/home3d.js` | Old hero-only controller | Retire (drop its `<script>` tag; leave file on disk) |
| `js/mat-core.js` | Mat engine | Reuse unchanged |

---

### Task 1: Scaffold — boot config, journey engine, Band 1 hero, home.js trim

Produces a page that loads with no console errors, shows the mat unrolling on scroll in a light cream studio with the hero band, keeps the existing tail (testimonials/press/footer) and concierge, and wires the static-fallback class + `startHire()`.

**Files:**
- Modify: `home.html` (full rewrite — keep header/announcement/mobile-drawer/concierge/footer/testimonials/press blocks verbatim from the current file; replace hero + mid sections with the journey region)
- Create: `js/home-journey.js`
- Modify: `js/home.js`

**Interfaces:**
- Produces (consumed by Tasks 2–4):
  - DOM: `#homeRoot` (root wrapper, gets `.is-static`), `#top` (≈700vh), `.home-sticky` (sticky 100vh), `#homeCanvas`, `#homeMat` (PNG), `#stage`, `#homeBar` (rail fill), `#homeHint`.
  - Each band = `<div data-band="A,B"><div class="band-inner"> …content… </div></div>` inside `#stage`. Outer = absolute layout layer; `.band-inner` = the element JS translates on reveal.
  - JS globals: `window.SAIA_ASSETS`, `window.SAIA_CONFIG`, `window.SAIA.startHire()`.
  - `js/home-journey.js`: `frames[]` (7 camera keyframes), `deformFor(p)` (0→1 by `UNROLL_END=0.22`, then clamps at 1), `MAT_LENGTH=4.3`.

- [ ] **Step 1: Create `js/home-journey.js`**

```js
/* ============================================================
   SAÏA — Home: pinned scroll-driven 3D journey
   One sticky mat (real saia-mat.glb) unrolls then STAYS OPEN in
   a LIGHT cream studio while [data-band] chapters reveal across
   the scroll. Ports journey.js's spine + home3d.js's airy light.
   Reuses window.SAIA.mat. Asset URLs come from window.SAIA_ASSETS
   so the page ports cleanly to a Shopify Liquid theme.
   Mobile / prefers-reduced-motion → .is-static fallback (no WebGL).
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});
  const THREE = window.THREE;
  const mat = NS.mat;
  const ASSETS = window.SAIA_ASSETS || {};
  const GLB_URL = ASSETS.matGlb || 'assets/saia-mat.glb';
  const TEX_URL = ASSETS.matTexture || 'assets/saia-mat-texture.png';

  const root = document.getElementById('homeRoot');
  const wrap = document.getElementById('top');
  const canvas = document.getElementById('homeCanvas');
  const stage = document.getElementById('stage');
  const rail = document.getElementById('homeBar');
  const hint = document.getElementById('homeHint');

  function goStatic() { if (root) root.classList.add('is-static'); }

  if (!wrap || !canvas || !THREE || !mat) { goStatic(); return; }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 767px)').matches;
  if (reduce || small) { goStatic(); return; }   // keep the flat PNG, skip WebGL

  const bandEls = stage ? Array.prototype.slice.call(stage.querySelectorAll('[data-band]')) : [];

  /* ---- state ---- */
  let renderer, scene, camera, group, meshMaterial, floor, key, hemi;
  const ctx = {};
  let current = 0, target = 0, lastD = null, clock, visible = true;

  /* ---- TUNABLES (iterate live on view) ---- */
  const MAT_LENGTH = 4.3;
  const UNROLL_END = 0.22;          // mat flat by this p of #top, then stays open

  /* camera keyframes (flat mat lies toward +Z; group.rotation.y = π/2) */
  const frames = [
    { p: 0.00, px: 0.55, py: 1.95, pz: 3.65, tx: 0.30, ty: 0.18, tz: 1.05 }, // 1 hero — coil close
    { p: 0.20, px: 0.30, py: 2.15, pz: 4.20, tx: 0.05, ty: 0.02, tz: 1.95 }, // 2 present open mat
    { p: 0.38, px: 0.00, py: 3.30, pz: 2.30, tx: 0.00, ty: 0.00, tz: 2.60 }, // 3 elevated plan view
    { p: 0.52, px: 1.10, py: 2.10, pz: 4.60, tx: 0.10, ty: 0.00, tz: 2.20 }, // 4 pull back 3/4
    { p: 0.66, px: 1.60, py: 1.40, pz: 4.90, tx: 0.00, ty: 0.05, tz: 2.30 }, // 5 wide & low
    { p: 0.80, px: -0.30, py: 0.95, pz: 3.20, tx: 0.10, ty: 0.03, tz: 2.60 }, // 6 raking close-up
    { p: 1.00, px: 0.45, py: 2.10, pz: 4.10, tx: 0.10, ty: 0.04, tz: 1.95 }, // 7 settle, serene
  ];
  function camAt(p) {
    let lo = frames[0], hi = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) { if (p >= frames[i].p && p <= frames[i + 1].p) { lo = frames[i]; hi = frames[i + 1]; break; } }
    const span = (hi.p - lo.p) || 1; let t = (p - lo.p) / span; t = t * t * (3 - 2 * t);
    const L = (a, b) => a + (b - a) * t;
    camera.position.set(L(lo.px, hi.px), L(lo.py, hi.py), L(lo.pz, hi.pz));
    camera.lookAt(L(lo.tx, hi.tx), L(lo.ty, hi.ty), L(lo.tz, hi.tz));
  }
  function deformFor(p) { return Math.min(1, Math.max(0, p / UNROLL_END)); } // 0→1 then clamps at 1

  function updateTarget() {
    const total = wrap.offsetHeight - window.innerHeight;
    const scrolled = -wrap.getBoundingClientRect().top;
    target = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
  }
  function onResize() {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function bands(p) {
    for (const e of bandEls) {
      const parts = (e.getAttribute('data-band') || '0,1').split(',').map(Number);
      const a = parts[0], b = parts[1];
      const f = Math.min(0.055, (b - a) * 0.4);
      const kin = a <= 0.001 ? 1 : Math.min(1, Math.max(0, (p - a) / f));
      const kout = b >= 0.999 ? 1 : Math.min(1, Math.max(0, (b - p) / f));
      let k = Math.min(kin, kout); if (p < a - 0.001 || p > b + 0.001) k = 0;
      e.style.opacity = k.toFixed(3);
      const inner = e.firstElementChild;
      if (inner) inner.style.transform = 'translateY(' + ((1 - k) * 24).toFixed(1) + 'px)';
      e.style.pointerEvents = k > 0.5 ? 'auto' : 'none';
    }
  }

  function paint(p) {
    const d = deformFor(p);
    if (lastD == null || Math.abs(d - lastD) > 0.0015) { mat.deform(ctx, d); lastD = d; }
    camAt(p);
    renderer.render(scene, camera);
    if (rail) rail.style.height = (p * 100).toFixed(1) + '%';
    if (hint) hint.style.opacity = (1 - Math.min(1, p / 0.04)).toFixed(3);
    bands(p);
  }

  function init(glb) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();                       // transparent — composites over the cream page
    scene.environment = mat.makeEnv(renderer);
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

    /* light cream studio (airy, not Journey's moody day-arc) */
    hemi = new THREE.HemisphereLight(0xffffff, 0xEDE6D8, 0.9); scene.add(hemi);
    key = new THREE.DirectionalLight(0xfff6ec, 2.0); key.position.set(-2.0, 5.0, 3.2); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.5; key.shadow.camera.far = 22;
    key.shadow.camera.left = -3.5; key.shadow.camera.right = 3.5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.radius = 9; key.shadow.bias = -0.0004; scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(3.2, 2.0, -2.2); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(2.4, 2.2, 5.0); scene.add(fill);

    group = new THREE.Group(); group.rotation.y = Math.PI / 2; scene.add(group);

    ctx.length = MAT_LENGTH;
    const geo = mat.buildGeometry(glb, ctx.length);
    ctx.geometry = geo; ctx.basePositions = geo.attributes.position.array.slice(0);
    geo.computeBoundingBox(); ctx.minL = geo.boundingBox.min.x;
    ctx.thickness = Math.max(ctx.length * 0.012, 0.04); ctx.R0 = ctx.thickness * 1.15;

    const normalTex = mat.makeNormalMap();
    const colorMap = glb ? mat.loadColorMap(TEX_URL) : normalTex;
    meshMaterial = new THREE.MeshPhysicalMaterial({
      map: colorMap, color: new THREE.Color('#ffffff'), normalMap: normalTex,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, metalness: 0.0,
      envMapIntensity: 0.22, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, meshMaterial);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);

    /* soft contact shadow on transparent ground → mat "floats" on the page */
    floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

    mat.deform(ctx, 0); lastD = 0; onResize(); updateTarget(); paint(0);
    canvas.style.transition = 'opacity .8s ease'; canvas.style.opacity = '1';

    clock = new THREE.Clock();
    const loop = () => {
      if (visible) {
        updateTarget();
        current = THREE.MathUtils.damp(current, target, 4.5, clock.getDelta());
        if (Math.abs(current - target) < 0.0002) current = target;
        paint(current);
      } else { clock.getDelta(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('resize', onResize);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0 }).observe(wrap);
    }
  }

  mat.loadGlb(GLB_URL).then(init).catch((e) => {
    console.warn('[home-journey] GLB load failed → static fallback', e);
    goStatic();
  });
})();
```

- [ ] **Step 2: Verify the new file parses**

Run: `node --check "js/home-journey.js"`
Expected: no output, exit 0.

- [ ] **Step 3: Rewrite `home.html`**

Keep these blocks **verbatim from the current `home.html`**: `<head>` (lines 3–21), the desktop header, the mobile header, the `#mobileDrawer`, the concierge widget (the whole `position:fixed; right:24px; bottom:24px` block), the testimonials `<section>`, the press `<section>`, and the `<footer>`. Replace everything else with the structure below. Wrap the entire page body in `<div id="homeRoot">`. Final `<body>`:

```html
<body>
<!-- SAÏA boot config — the ONE place URLs/endpoints live (becomes Liquid on Shopify) -->
<script>
  window.SAIA = window.SAIA || {};
  window.SAIA_ASSETS = {
    matGlb:     'assets/saia-mat.glb',
    matTexture: 'assets/saia-mat-texture.png',
    matFlatPng: 'assets/mat-flat.png'
  };
  window.SAIA_CONFIG = { conciergeEndpoint: 'http://localhost:8787/api/concierge' };
</script>

<div id="homeRoot" style="background:#F5F1E8; color:#2B2620; font-family:'Libre Baskerville',Georgia,serif; overflow-x:hidden; position:relative;">

  <!-- announcement bar — KEEP verbatim from current home.html -->
  <!-- desktop header — KEEP verbatim -->
  <!-- mobile header + #mobileDrawer — KEEP verbatim -->

  <!-- ============ THE PINNED 3D JOURNEY ============ -->
  <div id="top" style="position:relative; height:700vh; background:#F5F1E8;">
    <div class="home-sticky" style="position:sticky; top:0; height:100vh; overflow:hidden; background:#F5F1E8;">
      <canvas id="homeCanvas" aria-hidden="true" style="position:absolute; inset:0; width:100%; height:100%; z-index:1; opacity:0;"></canvas>
      <img id="homeMat" src="assets/mat-flat.png" alt="The SAÏA signature yoga mat, unrolled" style="display:none; position:absolute; right:6%; top:50%; height:80vh; width:auto; transform:translateY(-50%); filter:drop-shadow(0 40px 60px rgba(43,38,32,.22)); z-index:1;">

      <div id="stage" style="position:absolute; inset:0; z-index:3; pointer-events:none;">

        <!-- BAND 1 — HERO -->
        <div data-band="0,0.10" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
          <div class="band-inner" style="max-width:620px;">
            <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#2B2620; opacity:.7; margin-bottom:18px;">A women's club in London</div>
            <h1 style="font-family:'Cormorant Garamond',serif; font-weight:500; font-size:clamp(3.4rem,8.5vw,6.4rem); line-height:.96; margin:0; color:#2B2620;">Yoga mat hire,<br>across London.</h1>
            <p style="font-size:clamp(15px,1.5vw,18px); line-height:1.6; color:#2B2620; max-width:460px; margin:26px 0 0;">If you're organising a wellness event, you've landed in the right place — rent our mats for £8.50 each, with same-day delivery from our Central London warehouse.</p>
            <div style="margin-top:26px; font-size:12px; letter-spacing:.36em; text-transform:uppercase; color:#6B6358;">Fitness · Community · Mindset</div>
          </div>
        </div>

        <!-- Bands 2–7 inserted by later tasks -->

      </div>

      <!-- progress rail + scroll hint -->
      <div style="position:absolute; top:50%; right:4vw; transform:translateY(-50%); width:2px; height:190px; background:rgba(43,38,32,.16); z-index:4;"><span id="homeBar" style="position:absolute; top:0; left:0; width:100%; height:0%; background:#2B2620;"></span></div>
      <div id="homeHint" style="position:absolute; bottom:4vh; right:4vw; font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:#2B2620; z-index:4;">Scroll to unroll ↓</div>
    </div>
  </div>

  <!-- ============ FLAT TAIL (pin released) ============ -->
  <!-- testimonials <section> — KEEP verbatim from current home.html -->
  <!-- press <section> — KEEP verbatim -->
  <!-- <footer> — KEEP verbatim -->

  <!-- concierge widget — KEEP verbatim from current home.html -->
</div>

<script src="vendor/three.min.js"></script>
<script src="js/mat-core.js"></script>
<script src="js/home.js"></script>
<script src="js/home-journey.js"></script>
</body>
```

Also add this `<style>` block inside `<head>` (after the existing `<style>`):

```html
<style>
  .band-inner { will-change: transform, opacity; }
  /* static fallback: mobile / prefers-reduced-motion / WebGL failure */
  .is-static #top { height: auto !important; }
  .is-static .home-sticky { position: static !important; height: auto !important; overflow: visible !important; }
  .is-static #homeCanvas { display: none !important; }
  .is-static #homeMat { display: block !important; position: static !important; transform: none !important; height: auto; max-width: 100%; margin: 0 auto 40px; }
  .is-static [data-band] { position: static !important; inset: auto !important; opacity: 1 !important; display: block !important; padding: 56px 7vw !important; }
  .is-static .band-inner { transform: none !important; }
  .is-static #homeBar, .is-static #homeHint { display: none !important; }
</style>
```

Note: the old hero block referenced `#homeBrand`; it is intentionally gone. The `#homeMat` `src` stays a literal here (it's HTML, not JS, and only used by the static fallback); on Shopify it becomes `{{ 'mat-flat.png' | asset_url }}`.

- [ ] **Step 4: Trim `js/home.js` — remove the parallax loop, add `startHire()`, read endpoint from config**

Delete the entire "hero parallax loop" block (current lines ~8–34: the `matImg`/`brand`/`bar`/`hint`/`heroP` declarations, `tick()`, and its `requestAnimationFrame(tick)` call). It references `#homeBrand`, which no longer exists and would throw.

In `askAssist()`, replace the hardcoded URL:

```js
// before:
fetch('http://localhost:8787/api/concierge', {
// after:
fetch((window.SAIA_CONFIG && window.SAIA_CONFIG.conciergeEndpoint) || 'http://localhost:8787/api/concierge', {
```

At the very end of the IIFE (after the chip wiring, before the closing `})();`), expose the single hire entry point:

```js
  /* ---- single swappable hire entry point (Shopify rental checkout wires in here later) ---- */
  const NS = (window.SAIA = window.SAIA || {});
  NS.startHire = function () {
    panel.style.display = 'flex';
    render();
    if (input) input.focus();
  };
  document.querySelectorAll('[data-hire-cta]').forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); NS.startHire(); }));
```

- [ ] **Step 5: Verify `js/home.js` parses**

Run: `node --check "js/home.js"`
Expected: no output, exit 0.

- [ ] **Step 6: Page smoke test**

Run (start the server first if not already running — `python3 -m http.server 8000` in the project root):
```bash
curl -s http://localhost:8000/home.html | grep -c -e 'id="homeRoot"' -e 'id="top"' -e 'id="homeCanvas"' -e 'id="stage"' -e 'data-band="0,0.10"' -e 'home-journey.js' -e 'SAIA_ASSETS'
```
Expected: `7` (all seven markers present). Then confirm the retired controller is gone:
```bash
curl -s http://localhost:8000/home.html | grep -c 'home3d.js'
```
Expected: `0`.

- [ ] **Step 7: Checkpoint — you view it**

Open http://localhost:8000/home.html. Confirm: page loads with **no console errors**; the mat appears and **unrolls from a coil to flat as you scroll the first ~quarter**, then stays flat; the hero headline "Yoga mat hire, across London." is readable on the left; the progress rail fills; the scroll hint fades. Tail (testimonials/press/footer) and the concierge launcher still work. Then set the browser to *prefers-reduced-motion: reduce* (or narrow to <768px) and reload — confirm the canvas is gone, the flat PNG shows, and the hero text is stacked and readable (`.is-static` active).

---

### Task 2: Band 2 — the open mat + specs (+ mirrored-logo & sizing fixes)

The first band where the mat lies flat and the camera presents it. This is where the logo is readable, so the mirrored-logo and mat-sizing fixes land here.

**Files:**
- Modify: `home.html` (insert Band 2 into `#stage` after Band 1)
- Modify: `js/home-journey.js` (logo fix + sizing tune only if needed)

**Interfaces:**
- Consumes: `#stage`, the `data-band`/`.band-inner` pattern, `frames[1]` (the "present open mat" keyframe), `MAT_LENGTH`, `loadColorMap(TEX_URL)` from Task 1.

- [ ] **Step 1: Insert Band 2 markup**

Place immediately after the Band 1 `</div>` (the `<!-- Bands 2–7 inserted by later tasks -->` marker) in `#stage`:

```html
<!-- BAND 2 — THE OPEN MAT + SPECS -->
<div data-band="0.10,0.28" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
  <div class="band-inner" style="max-width:440px;">
    <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#6B6358; margin-bottom:18px;">The signature mat</div>
    <h2 style="font-family:'Cormorant Garamond',serif; font-weight:500; font-size:clamp(34px,4.4vw,54px); line-height:1.04; margin:0 0 22px; color:#2B2620;">Made for grip,<br>made to last.</h2>
    <p style="font-size:16px; line-height:1.75; color:#6B6358; margin:0 0 26px; max-width:400px;">One mat, exceptionally made — an ethically sourced natural-rubber base with a non-slip, anti-odour PU surface. Weighted to fall open and lie flat the moment you unroll it.</p>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      <span style="font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#6B6358; border:1px solid #C9C2B4; border-radius:30px; padding:6px 13px;">68 × 185 cm</span>
      <span style="font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#6B6358; border:1px solid #C9C2B4; border-radius:30px; padding:6px 13px;">4 mm</span>
      <span style="font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#6B6358; border:1px solid #C9C2B4; border-radius:30px; padding:6px 13px;">Natural rubber</span>
      <span style="font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#6B6358; border:1px solid #C9C2B4; border-radius:30px; padding:6px 13px;">Non-slip</span>
    </div>
    <div style="font-size:13px; color:#6B6358; margin-top:18px;">Retail value £79 each — <strong style="color:#2B2620;">for hire only.</strong></div>
  </div>
</div>
```

- [ ] **Step 2: Page smoke test**

Run: `curl -s http://localhost:8000/home.html | grep -c 'data-band="0.10,0.28"'`
Expected: `1`.

- [ ] **Step 3: Checkpoint — view Band 2; read the logo**

Open the page, scroll to ~15–25% (the mat lies flat, camera presents it). Look at the SAÏA logo printed on the mat. **Is it mirrored/reversed?**

- [ ] **Step 4: Apply the mirrored-logo fix ONLY if reversed**

If the logo reads reversed, in `js/home-journey.js` `init()`, immediately after `const colorMap = glb ? mat.loadColorMap(TEX_URL) : normalTex;` add:

```js
    // Home's mat pose reads the baked logo reversed vs Journey's — restore un-mirrored U.
    if (glb && colorMap) { colorMap.repeat.x = 1; colorMap.offset.x = 0; colorMap.needsUpdate = true; }
```

Then `node --check "js/home-journey.js"` (expect exit 0) and reload to confirm the logo reads correctly. If it was already correct in Step 3, skip this step.

- [ ] **Step 5: Tune mat sizing/framing**

Still viewing Band 2: the mat must be **fully framed and not run off the right edge** in bands 1–2. Adjust in `js/home-journey.js`:
- If the mat is too large / clips the right: reduce `MAT_LENGTH` (try `4.0`, then `3.8`), **or** increase `frames[1].pz` (pull camera back, e.g. `4.20 → 4.6`).
- If too small / lost in space: increase `MAT_LENGTH` (try `4.6`) or decrease `frames[1].pz`.
- To re-centre horizontally, nudge `frames[1].px` and `frames[1].tx` together.

Re-run `node --check`, reload, and confirm the mat is well-framed at p 0–0.28. These are visual judgement calls — iterate until it reads right.

- [ ] **Step 6: Checkpoint — you confirm Band 2**

Confirm: mat is flat and well-framed; logo reads correctly; spec chips and copy sit on the cream gutter to the left with no dark-on-dark; transition from hero → specs is smooth.

---

### Task 3: Bands 3 & 4 — How hire works · For every gathering

**Files:**
- Modify: `home.html` (insert Bands 3 and 4 into `#stage` after Band 2)
- Modify: `js/home-journey.js` (camera tune for `frames[2]`, `frames[3]` only if needed)

**Interfaces:**
- Consumes: `data-band`/`.band-inner` pattern; `frames[2]` (elevated plan view), `frames[3]` (pull back 3/4); `window.SAIA.startHire` (Task 1) for the hire CTA.

- [ ] **Step 1: Insert Band 3 markup (after Band 2)**

```html
<!-- BAND 3 — HOW HIRE WORKS -->
<div data-band="0.28,0.44" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
  <div class="band-inner" style="max-width:480px;">
    <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:16px;">Mat hire</div>
    <h2 style="font-family:'Cormorant Garamond',serif; font-weight:500; font-size:clamp(32px,4.4vw,52px); line-height:1.04; margin:0 0 14px; color:#2B2620;">Hiring is effortless.</h2>
    <p style="font-size:15px; line-height:1.7; color:#6B6358; margin:0 0 28px; max-width:420px;">From a 10-mat morning class to a 200-person retreat — we handle delivery, set-up time and collection. £8.50 a mat, 2-day hire, minimum of ten.</p>
    <div style="display:flex; flex-direction:column; gap:18px;">
      <div style="display:flex; gap:16px; align-items:baseline;"><span style="font-family:'Cormorant Garamond',serif; font-size:22px; color:#B8624A;">01</span><div><div style="font-family:'Cormorant Garamond',serif; font-size:20px; color:#2B2620;">Tell us your event</div><div style="font-size:14px; line-height:1.6; color:#6B6358;">Date, location and how many mats. Minimum of ten.</div></div></div>
      <div style="display:flex; gap:16px; align-items:baseline;"><span style="font-family:'Cormorant Garamond',serif; font-size:22px; color:#B8624A;">02</span><div><div style="font-family:'Cormorant Garamond',serif; font-size:20px; color:#2B2620;">We deliver early</div><div style="font-size:14px; line-height:1.6; color:#6B6358;">Mats arrive the day before by London courier — or collect from our NW3 studio.</div></div></div>
      <div style="display:flex; gap:16px; align-items:baseline;"><span style="font-family:'Cormorant Garamond',serif; font-size:22px; color:#B8624A;">03</span><div><div style="font-family:'Cormorant Garamond',serif; font-size:20px; color:#2B2620;">You practise</div><div style="font-size:14px; line-height:1.6; color:#6B6358;">A clean, grippy mat under every guest. Nothing to set up, nothing to launder.</div></div></div>
      <div style="display:flex; gap:16px; align-items:baseline;"><span style="font-family:'Cormorant Garamond',serif; font-size:22px; color:#B8624A;">04</span><div><div style="font-family:'Cormorant Garamond',serif; font-size:20px; color:#2B2620;">We collect after</div><div style="font-size:14px; line-height:1.6; color:#6B6358;">We pick everything up the day after. A 2-day hire from £8.50 a mat.</div></div></div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Insert Band 4 markup (after Band 3)**

```html
<!-- BAND 4 — FOR EVERY GATHERING -->
<div data-band="0.44,0.58" style="position:absolute; inset:0; display:flex; align-items:flex-start; justify-content:center; padding:13vh 6vw 0;">
  <div class="band-inner" style="width:100%; max-width:1000px;">
    <div style="text-align:center; margin-bottom:36px;">
      <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#6B6358; margin-bottom:14px;">Hire the range</div>
      <h2 style="font-family:'Cormorant Garamond',serif; font-weight:500; font-size:clamp(32px,4.4vw,52px); line-height:1.03; margin:0; color:#2B2620;">For every gathering.</h2>
    </div>
    <div style="display:grid; grid-template-columns:repeat(3,minmax(200px,1fr)); gap:20px;">
      <div style="pointer-events:auto; background:rgba(245,241,232,.92); border:1px solid #E2DCCF; border-radius:4px; padding:24px;">
        <div style="font-family:'Cormorant Garamond',serif; font-size:22px; color:#2B2620;">Events &amp; retreats</div>
        <p style="font-size:14px; line-height:1.6; color:#6B6358; margin:8px 0 14px;">10–60 mats, delivered and collected. Ideal for classes, brunch clubs &amp; weekenders.</p>
        <div style="font-size:15px; color:#2B2620;">From £8.50 / mat</div>
        <button data-hire-cta style="margin-top:16px; width:100%; background:#2B2620; color:#F5F1E8; border:none; font-family:'Libre Baskerville',serif; font-size:11px; letter-spacing:.2em; text-transform:uppercase; padding:13px; border-radius:2px; cursor:pointer;">Enquire to hire</button>
      </div>
      <div style="pointer-events:auto; background:rgba(245,241,232,.92); border:1px solid #E2DCCF; border-radius:4px; padding:24px;">
        <div style="font-family:'Cormorant Garamond',serif; font-size:22px; color:#2B2620;">Studios &amp; partners</div>
        <p style="font-size:14px; line-height:1.6; color:#6B6358; margin:8px 0 14px;">60+ mats on a reduced rate, with recurring delivery to keep your studio stocked.</p>
        <div style="font-size:15px; color:#2B2620;">Reduced volume rate</div>
        <button data-hire-cta style="margin-top:16px; width:100%; background:#2B2620; color:#F5F1E8; border:none; font-family:'Libre Baskerville',serif; font-size:11px; letter-spacing:.2em; text-transform:uppercase; padding:13px; border-radius:2px; cursor:pointer;">Request a rate</button>
      </div>
      <div style="pointer-events:auto; background:#2B2620; color:#F5F1E8; border-radius:4px; padding:24px; display:flex; flex-direction:column;">
        <div style="font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:rgba(245,241,232,.6); margin-bottom:10px;">Brand partnerships</div>
        <div style="font-family:'Cormorant Garamond',serif; font-size:24px; line-height:1.05;">Let's build something together.</div>
        <p style="font-size:14px; line-height:1.6; color:rgba(245,241,232,.7); margin:12px 0 14px;">Branded mats, press days and activations — designed with your team.</p>
        <button data-hire-cta style="margin-top:auto; width:100%; background:transparent; color:#F5F1E8; border:1px solid rgba(245,241,232,.5); font-family:'Libre Baskerville',serif; font-size:11px; letter-spacing:.2em; text-transform:uppercase; padding:13px; border-radius:2px; cursor:pointer;">Work with us</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Page smoke test**

Run: `curl -s http://localhost:8000/home.html | grep -c -e 'data-band="0.28,0.44"' -e 'data-band="0.44,0.58"' -e 'data-hire-cta'`
Expected: `5` (band 3, band 4, and 3 `data-hire-cta` buttons).

- [ ] **Step 4: Tune cameras if needed**

View p 0.28–0.44 (Band 3): the mat should read as an **elevated plan view down its length** with the steps legible on the left — adjust `frames[2]` (raise `py`, lower `pz`) if it's not. View p 0.44–0.58 (Band 4): camera **pulls back** so the mat sits behind the three cards without fighting them — adjust `frames[3].pz`/`py` if the cards overlap the dark mat awkwardly. Re-run `node --check` after edits.

- [ ] **Step 5: Checkpoint — you confirm Bands 3 & 4**

Confirm: smooth hand-off 2→3→4; steps readable (no dark-on-dark); cards sit cleanly over/around the mat; clicking any "Enquire to hire" / "Request a rate" / "Work with us" button opens the concierge (via `startHire`).

---

### Task 4: Bands 5, 6, 7 — The SAÏA Club · Pilates · Join

**Files:**
- Modify: `home.html` (insert Bands 5, 6, 7 into `#stage` after Band 4)
- Modify: `js/home-journey.js` (camera tune for `frames[4]`, `frames[5]`, `frames[6]` only if needed)

**Interfaces:**
- Consumes: `data-band`/`.band-inner` pattern; `frames[4]` (wide & low), `frames[5]` (raking close-up), `frames[6]` (settle); `window.SAIA.startHire`.

- [ ] **Step 1: Insert Band 5 markup (after Band 4)**

```html
<!-- BAND 5 — THE SAÏA CLUB -->
<div data-band="0.58,0.72" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:0 7vw;">
  <div class="band-inner" style="max-width:680px; background:radial-gradient(120% 120% at 50% 50%, rgba(245,241,232,.86), rgba(245,241,232,0) 72%); padding:40px;">
    <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:16px;">The SAÏA Club</div>
    <h2 style="font-family:'Cormorant Garamond',serif; font-weight:500; font-size:clamp(34px,4.6vw,58px); line-height:1.02; margin:0 0 22px; color:#2B2620;">We curate unforgettable experiences.</h2>
    <p style="font-size:17px; line-height:1.8; color:#6B6358; margin:0 auto; max-width:520px;">Join us for a series of events in London for like-minded women — to support each other, feel inspired, and celebrate sisterhood. A female-led club built on fitness, community &amp; mindset.</p>
  </div>
</div>
```

- [ ] **Step 2: Insert Band 6 markup (after Band 5)**

```html
<!-- BAND 6 — PILATES WITH CRISTINA -->
<div data-band="0.72,0.86" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-start; padding:0 7vw;">
  <div class="band-inner" style="max-width:460px;">
    <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#6B6358; margin-bottom:16px;">Fitness</div>
    <h2 style="font-family:'Cormorant Garamond',serif; font-weight:500; font-size:clamp(34px,4.6vw,58px); line-height:1.0; margin:0 0 22px; color:#2B2620;">Move with Cristina.</h2>
    <p style="font-size:16px; line-height:1.75; color:#6B6358; margin:0; max-width:400px;">Small, strong, slow Pilates — led by our founder, on the same mat you'll come to know by heart. Classical &amp; Reformer; 1-to-1 in NW3, or group classes in Hampstead. Breath-led, built for every body.</p>
  </div>
</div>
```

- [ ] **Step 3: Insert Band 7 markup (after Band 6)**

```html
<!-- BAND 7 — JOIN / GET ON THE GUEST LIST -->
<div data-band="0.86,1" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:0 7vw;">
  <div class="band-inner" style="max-width:560px;">
    <div style="font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#B8624A; margin-bottom:18px;">Join the SAÏA Community</div>
    <h2 style="font-family:'Cormorant Garamond',serif; font-weight:500; font-size:clamp(36px,5vw,62px); line-height:1.02; margin:0 0 20px; color:#2B2620;">Get on the guest list.</h2>
    <p style="font-size:16px; line-height:1.7; color:#6B6358; margin:0 0 30px;">First word on upcoming events and mat-hire availability.</p>
    <div style="pointer-events:auto; display:flex; flex-wrap:wrap; gap:12px; justify-content:center; max-width:480px; margin:0 auto;">
      <input type="email" placeholder="Enter your email" aria-label="Email address" class="input-focus" style="flex:1 1 240px; font-family:'Libre Baskerville',serif; font-size:15px; padding:15px 18px; background:#fff; border-radius:2px; color:#2B2620;">
      <button class="btn-ink" style="flex:0 0 auto; border:none; font-family:'Libre Baskerville',serif; font-size:12px; letter-spacing:.22em; text-transform:uppercase; padding:15px 34px; border-radius:2px; cursor:pointer;">Subscribe</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Page smoke test**

Run: `curl -s http://localhost:8000/home.html | grep -c -e 'data-band="0.58,0.72"' -e 'data-band="0.72,0.86"' -e 'data-band="0.86,1"'`
Expected: `3`.

- [ ] **Step 5: Tune cameras if needed**

View p 0.58–0.72 (Band 5): camera **wide & low**, mat soft behind the centred scrim text — soften the scrim or pull `frames[4]` back further if text contrast is weak. View p 0.72–0.86 (Band 6): a **raking close-up across the surface** (texture/grip catches the light) with the Pilates copy clear on the left — adjust `frames[5]` (lower `py`, side `px`). View p 0.86–1.0 (Band 7): camera **settles to a serene presented view** — tune `frames[6]`. Re-run `node --check` after edits.

- [ ] **Step 6: Checkpoint — you confirm the full journey**

Scroll the whole `#top` top-to-bottom: the mat unrolls then stays open; all 7 bands reveal/▸hide cleanly at their ranges with no dark-on-dark; the camera gives real variety (present → plan → pull-back → wide → raking → settle); the pin then releases into the flat tail.

---

### Task 5: Flat tail, fallback hardening, polish & accessibility

Finalise the editorial tail copy, the static fallback, the de-generic polish, and the a11y pass.

**Files:**
- Modify: `home.html` (tail copy verbatim; a11y attributes)
- Modify: `js/home.js` (verify `startHire` + endpoint already wired from Task 1)

**Interfaces:**
- Consumes: everything from Tasks 1–4. Produces the final reviewable page.

- [ ] **Step 1: Confirm tail copy is verbatim**

In the kept testimonials `<section>`, ensure the three quotes are the verbatim saialondon.com voices (Diana; Georgina — Olympic Rhythmic Gymnast: "A SAÏA Woman is not afraid to speak her truth, and is someone who inspires and lifts up other women around her"; Tamta). In the press `<section>`, keep VOGUE · STYLIST · Harper's Bazaar · ELLE · REFINERY29 · COURIER. These should already be present from the current file — fix any drift.

- [ ] **Step 2: Accessibility pass (invoke the web-design-guidelines skill)**

Run the **web-design-guidelines** skill against `home.html` and apply its findings. Concretely confirm: exactly one `<h1>` (Band 1) and `<h2>` for bands 2–7; `#homeCanvas` has `aria-hidden="true"`; `#homeMat` has descriptive `alt`; the email input has an `aria-label` (added in Task 4); every CTA is a real `<button>`/`<a>`; visible focus styles (the `.input-focus` / `.btn-ink` helpers exist in `base.css`); AA contrast on every text/background pairing (ink `#2B2620` and ink-soft `#6B6358` on cream pass; check any text over the mat uses the scrim).

- [ ] **Step 3: De-generic polish (invoke the frontend-design skill)**

Run the **frontend-design** skill over the bands + tail. Tighten type scale, vertical rhythm, kicker labels, and hairline detailing so it reads as a deliberate editorial product, not a generic template. Keep the locked palette/fonts and don't remove elements.

- [ ] **Step 4: Verify both JS files parse**

Run: `node --check "js/home.js" && node --check "js/home-journey.js"`
Expected: no output, exit 0.

- [ ] **Step 5: Portability audit**

Run:
```bash
grep -rn "assets/saia-mat.glb\|assets/saia-mat-texture.png\|localhost:8787" js/home-journey.js js/home.js
```
Expected: matches appear **only as fallback values** (`|| 'assets/…'`, `|| 'http://localhost:8787…'`), never as the sole/primary URL. Confirm every hire button uses `data-hire-cta` or calls `SAIA.startHire()`, and the boot config block is the only place `SAIA_ASSETS`/`SAIA_CONFIG` are defined.

- [ ] **Step 6: Full fallback test**

With the concierge endpoint **not** running, reload http://localhost:8000/home.html — the page must still fully work (3D runs; concierge falls back to its generic reply). Then enable *prefers-reduced-motion: reduce* and reload — `.is-static` active: no canvas, flat PNG shown, all 7 bands stacked and readable, tail intact, concierge works. Then resize <768px and reload — same static layout, mobile nav drawer opens/closes.

- [ ] **Step 7: Checkpoint — you give final sign-off**

Confirm the whole page on desktop (3D journey) and the static fallback (mobile/reduced-motion) both read well, on-brand, mat-hire-first, British English, no console errors.

---

## Self-review

**Spec coverage:**
- One pinned scene, whole page → Task 1 (`#top` 700vh sticky canvas + `home-journey.js`). ✅
- Light cream studio → Task 1 `init()` lighting. ✅
- Mat unrolls then stays open → Task 1 `deformFor` (clamps at 1 past `UNROLL_END`). ✅
- 7 bands, mat-hire-first, verbatim copy → Tasks 1–4. ✅
- Flat tail (testimonials/press/footer), Journal dropped → Tasks 1 & 5. ✅
- Three fixes (mirrored logo, sizing, contrast) → Task 2 (logo + sizing); contrast handled per-band across Tasks 1–4 + Step 2 a11y. ✅
- Fallback (mobile/reduced-motion) → Task 1 `.is-static` CSS + guard; Task 5 Step 6 test. ✅
- Perf & a11y → Task 1 (pixelRatio, IntersectionObserver, damp, deform-skip, aria-hidden) + Task 5 Step 2. ✅
- Shopify portability rules 1–5 → boot config (Task 1 Step 3), asset reads (Task 1 Step 1), endpoint (Task 1 Step 4), `startHire` + `data-hire-cta` (Tasks 1 & 3–4), audit (Task 5 Step 5). ✅
- Retire `home3d.js` / strip `home.js` parallax → Task 1 Steps 3–4. ✅

**Placeholder scan:** none — all band markup, JS, and commands are concrete. Camera/sizing "tune if needed" steps ship with working first-pass values and explicit knobs (which constant, which direction).

**Type/name consistency:** `#homeBar`/`#homeHint`/`#homeMat`/`#homeRoot`/`#stage`/`#top`/`.home-sticky`/`.band-inner` consistent across `home.html` ↔ `home-journey.js`. `window.SAIA.startHire`, `window.SAIA_ASSETS.matGlb/matTexture/matFlatPng`, `window.SAIA_CONFIG.conciergeEndpoint`, `data-hire-cta` consistent across `home.html` ↔ `home.js`. `frames[]` indices referenced in Tasks 2–4 match the 7-entry table defined in Task 1.
