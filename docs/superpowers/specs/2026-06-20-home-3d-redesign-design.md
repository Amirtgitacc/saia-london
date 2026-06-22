# Home — Pinned Scroll-Driven 3D Journey (Design, RESTART)

**Date:** 2026-06-20
**Status:** approved — writing implementation plan next
**Supersedes:** the earlier "3D hero + flat editorial sections" choreography in this same file.
That model bolted a 3D hero onto an otherwise-flat page and was rejected (the open mat scrolled
away into empty cream, never carried the page). This spec replaces it.

**Scope:** rebuild `home.html` as **one continuous, pinned, scroll-driven 3D journey** — a single
sticky mat that stays on-screen and transforms while content bands reveal at successive scroll
ranges — then release the pin into a short flat editorial tail. Light cream editorial studio,
**mat-hire first**, **real saialondon.com copy**. No change to `index.html` (Journey) or
`hero.html`. The concierge (Phase 2) is untouched.

**End target:** this becomes a **Shopify store** (theme). We build the home page now as clean
**static, dependency-free HTML/CSS/JS** for fast 3D iteration (`python3 -m http.server`), but with
**Shopify-portability rules baked in** (see "Shopify integration & portability" below) so a later
phase can port it to a Liquid theme without rework. Mat hire is ultimately a **rental checkout**
(customer pays a hire fee through Shopify); in this static build the hire CTAs route through a
single swappable entry point that later wires to the Shopify cart.

---

## Goal & principles

- **One scene, the whole page.** Copy the proven pattern in `js/journey.js` + `index.html`:
  a tall scroll spine with a sticky full-viewport canvas pinned for the entire journey; a damped
  scroll progress `p` (0..1) drives mat deform + camera keyframes + `[data-band]` reveals.
- **Mat-hire is priority #1**, then community, then Pilates/yoga.
- **Light cream studio, not dark.** Reuse `home3d.js`'s airy lighting (transparent renderer,
  `HemisphereLight` + soft warm key, PCF soft shadow, `ShadowMaterial` contact shadow so the mat
  floats on the cream) — NOT Journey's dark dawn→dusk arc.
- **Mat unrolls, then stays open** (user decision). Coil → flat by ~p 0.22, then stays flat; the
  camera does the work after that (present → plan view → pull back → wide → raking → settle).
- **Real copy, verbatim** from saialondon.com (captured in the handover; full facts in
  `js/saia-knowledge.js`). No invented headlines.
- **Never dark-on-dark.** Each band composes text on cream gutters or behind a soft cream scrim;
  the dark mat never sits behind dark text.
- **Never slow or broken.** Mobile / `prefers-reduced-motion` skip WebGL and get a static stacked
  editorial layout + the flat PNG.

---

## Architecture

```
home.html
 ├─ <script> SAÏA boot config (inline, top of <body>) ....... NEW — see portability §
 │        window.SAIA_ASSETS  = { matGlb, matTexture, matFlatPng }   ← injectable URLs
 │        window.SAIA_CONFIG  = { conciergeEndpoint }                ← injectable endpoint
 ├─ header (desktop + mobile nav) + announcement bar ........ unchanged
 ├─ #top  (≈700vh tall scroll spine)
 │   └─ position:sticky; top:0; height:100vh; overflow:hidden:
 │        <canvas id="homeCanvas">  alpha:true, composites over cream
 │        <img id="homeMat">        flat PNG — shown ONLY in the static fallback
 │        <div id="stage">          7 absolutely-positioned [data-band] overlays
 │        progress rail + scroll hint
 ├─ FLAT TAIL (normal flow, after the pin releases):
 │        testimonials · press logos · footer (with subscribe)
 └─ concierge widget (home.js Option B) .................... unchanged

js/home-journey.js   NEW — journey.js's spine (damped current→target p, camAt(frames),
                     bands(p), deformFor(p), updateTarget, onResize, IntersectionObserver pause)
                     + home3d.js's LIGHT cream studio lighting. Reuses mat-core.js unchanged.
                     Reads asset URLs from window.SAIA_ASSETS (falls back to 'assets/…' paths).
js/home3d.js         retired — its <script> tag removed from home.html (file left on disk).
js/home.js           keep mobile nav drawer + Option-B concierge; DELETE the old flat-PNG
                     parallax tick() loop. Concierge reads window.SAIA_CONFIG.conciergeEndpoint
                     (falls back to localhost:8787).
js/mat-core.js       reused as-is (loadGlb, buildGeometry, deform, makeEnv, makeNormalMap,
                     loadColorMap) — all already take a URL arg, so no change needed.
```

Reuses `assets/saia-mat.glb`, `assets/saia-mat-texture.png`, `assets/mat-flat.png` (fallback).

### Light cream studio vs Journey's dark arc

| | Journey (`journey.js`) | Home (this spec) |
|---|---|---|
| Renderer | `alpha:false`, dark `scene.background` | `alpha:true`, transparent — composites over cream page |
| Background | animated dawn→dusk | constant cream `#F5F1E8` (page), no scene bg |
| Key light | warm, dramatic, day-arc | soft neutral + gentle warm fill, steady |
| Floor | dark earth plane | `ShadowMaterial` contact shadow only (mat floats) |
| Exposure | swings through the day | steady, bright (~1.08) |
| Mood | cinematic ritual | premium editorial product |

Material stays the matte rubber (physical material + procedural normal map in `mat-core.js`).

---

## Band-by-band choreography

`deform`: 0 = rolled coil, 1 = flat. `deformFor(p)`: 0→1 across p 0–0.22, then **clamped at 1**
(stays open). Variety after p 0.22 comes from the **camera** `frames[]` table (smoothstepped, as
in journey.js). All `p` / camera numbers are first-pass and tuned live on view.

| # | Band (`data-band` p) | Copy (verbatim) | Mat | Camera | Contrast plan |
|---|----------------------|-----------------|-----|--------|---------------|
| 1 | **Hero** (0–0.10) | "Yoga mat hire, across London." · "Fitness · Community · Mindset" | coil → begins unrolling (0→0.45) | close 3/4 on the coil | headline left on cream; coil sits right |
| 2 | **The mat** (0.10–0.28) | "Made for grip, made to last." · 68×185 cm · 4 mm · natural rubber · non-slip · (retail £79, ref only — HIRE ONLY) | finishes flat (→1) | eases to present the open mat; slow push along surface | spec chips in left cream gutter; mat centre-right |
| 3 | **How hire works** (0.28–0.44) | "Hiring is effortless." · £8.50/mat · 2-day · min 10 · next-day London delivery · NW3 pickup · steps 01–04 | flat, still | lifts to an elevated plan view down the length | steps stacked in a cream gutter beside the mat |
| 4 | **For every gathering** (0.44–0.58) | "For every gathering." · events & retreats, 10–60 mats · 60+ → reduced quote | flat, tilts to a soft 3/4 | pulls back, mat as a backdrop | cards on a near-solid cream panel; mat behind |
| 5 | **The SAÏA Club** (0.58–0.72) | "We curate unforgettable experiences." + one pull-quote | flat, recedes (camera distance) | drifts wide & low; mat soft | centred text on a soft cream scrim |
| 6 | **Pilates** (0.72–0.86) | "Move with Cristina." · Classical + Reformer · 1-2-1 in NW3 / group in Hampstead | flat | raking close-up across the surface | text left; mat rakes right |
| 7 | **Join** (0.86–1.0) | "Get on the guest list." · email capture | settles to a calm presented view | returns to a serene hero-ish view | centred card on cream |

**Flat tail (below `#top`, normal flow):**
1. **Testimonials** — Diana / Georgina (Olympic Rhythmic Gymnast) / Tamta, verbatim.
2. **Press logos** — VOGUE · STYLIST · Harper's Bazaar · ELLE · REFINERY29 · COURIER.
3. **Footer** — keep the existing rich footer (links + subscribe + socials).

**Journal section: dropped** (user decision, 2026-06-20). Can be reinstated later as a flat-tail
band if wanted.

---

## The three fixes (baked into the build)

1. **Mirrored SAÏA logo.** `mat-core.js loadColorMap` mirrors the U axis (`repeat.x = -1`) for
   Journey's pose. Home's mat pose may read reversed. Verified at **Band 2** (logo is readable
   there); if reversed, flip `colorMap.repeat.x` / `offset.x` **in `home-journey.js` only** so
   Journey's working pose is untouched.
2. **Oversized / runs off the right edge.** Tune `MAT_LENGTH` + camera `frames[]` + the group's
   world offset so the mat is fully framed in every band and never clips the viewport.
3. **Text/mat contrast.** The per-band composition rules above: dark ink text lives on cream
   gutters; where text must overlap the mat, add a soft cream radial scrim behind it. Never
   dark-on-dark.

---

## Fallback (mobile / `prefers-reduced-motion`)

Detect with `matchMedia('(max-width: 767px)')` and `('(prefers-reduced-motion: reduce)')`. When
either matches, `home-journey.js` skips WebGL entirely and adds a root class `.is-static`. CSS for
`.is-static`:

- `#top` → `height:auto`; its inner sticky wrapper → `position:static; height:auto; overflow:visible`.
- `#homeCanvas` → `display:none`; `#homeMat` (flat PNG) → shown.
- `[data-band]` overlays → `position:static; opacity:1; transform:none`, stacked as normal flowing
  sections with sensible vertical padding.

Same DOM, no second copy of the content. The flat tail is unchanged. The concierge works in both.

---

## Shopify integration & portability (build-now rules)

The page is built static now and ported to a Liquid theme later. To make that port mechanical
rather than a rewrite, every task in this build MUST follow these rules:

1. **No hardcoded asset URLs in JS.** All asset URLs come from a single inline config block at the
   top of `<body>`:

   ```html
   <script>
     window.SAIA_ASSETS = {
       matGlb:     'assets/saia-mat.glb',
       matTexture: 'assets/saia-mat-texture.png',
       matFlatPng: 'assets/mat-flat.png'
     };
     window.SAIA_CONFIG = { conciergeEndpoint: 'http://localhost:8787/api/concierge' };
   </script>
   ```

   `home-journey.js` uses `window.SAIA_ASSETS.matGlb` / `.matTexture` (with the literal `'assets/…'`
   string as a fallback so the file still runs if the block is missing). On Shopify this one block
   becomes Liquid and nothing else changes:

   ```liquid
   <script>
     window.SAIA_ASSETS = {
       matGlb:     {{ 'saia-mat.glb'         | asset_url | json }},
       matTexture: {{ 'saia-mat-texture.png' | asset_url | json }},
       matFlatPng: {{ 'mat-flat.png'         | asset_url | json }}
     };
     window.SAIA_CONFIG = { conciergeEndpoint: {{ settings.concierge_endpoint | json }} };
   </script>
   ```

2. **Section-shaped markup.** Keep the journey self-contained inside `#top`, and each flat-tail item
   a discrete top-level `<section>`. Liquid mapping (later phase): header/footer → theme `layout` +
   a `footer` section; `#top` journey → one `sections/home-journey.liquid`; each tail `<section>` →
   its own section. Don't nest content across these boundaries.

3. **One swappable hire entry point.** Every "Hire" CTA calls a single function
   `window.SAIA.startHire()` (or a `[data-hire-cta]` hook), which in the static build opens the
   concierge / hire flow. Later, Shopify rental checkout is wired in **one place** by changing that
   function (convert the concierge's computed line items → Shopify AJAX cart / draft order). Do NOT
   scatter hire/checkout logic across band buttons.

4. **Configurable concierge endpoint.** The Node concierge (`server.js`) cannot run on Shopify; it
   will be externally hosted. `home.js` reads `window.SAIA_CONFIG.conciergeEndpoint` (fallback
   `http://localhost:8787/api/concierge`). No other hardcoded endpoint anywhere.

5. **Liquid-safe content.** Inline styles port verbatim (fine). Avoid raw `{{` / `{%` sequences in
   text content. Keep filenames flat in `assets/` (no nested asset subfolders — Shopify's `assets/`
   is flat).

> Out of scope for this build (later Shopify phase, tracked separately): the rental-pricing model
> (rental app vs selling-plan vs draft-order), the actual Liquid theme files, the theme-editor
> blocks, and hosting the concierge endpoint. This build only guarantees the home page ports
> cleanly into that work.

---

## Performance & accessibility

- One WebGL context; `setPixelRatio(min(devicePixelRatio, 2))`; `IntersectionObserver` pauses
  rendering when `#top` is off-screen; damped `current→target`; skip redundant `deform` calls
  (`|d - lastD| > 0.0015`) — all as `journey.js` / `home3d.js` already do.
- Canvas is decorative → `aria-hidden="true"`.
- Semantic headings per band (`<h1>` hero, `<h2>` elsewhere), real link/button elements,
  visible focus, alt text on the PNG, and AA contrast on every text-over-background pairing.

---

## Build order (each step verified + viewed in the browser before the next)

1. **Scaffold** — rebuild `home.html` to the pinned structure; create `home-journey.js` with the
   light studio + mat unroll + **Band 1 hero** working; remove the `home3d.js` script tag.
2. **Band 2** — the open mat + specs; camera present move; fix mirrored-logo & mat sizing here.
3. **Bands 3–4** — How hire works · For every gathering.
4. **Bands 5–7** — The SAÏA Club · Pilates · Join.
5. **Flat tail + cleanup** — testimonials, press, footer; strip `home.js` parallax `tick()`;
   `.is-static` fallback; frontend-design polish + web-design-guidelines a11y pass.

Verify each: `python3 -m http.server 8000` → http://localhost:8000/home.html (static server
required — the page `fetch()`es the `.glb`; `file://` won't work).

---

## Decisions (locked 2026-06-20)

1. **Scope:** 3D pinned journey for the mat-led chapters → release pin → flat editorial tail.
2. **Mat arc:** unroll then **stay open** (camera carries the variety; no re-roll).
3. **Journal:** dropped for now.
4. **Copy:** verbatim saialondon.com (handover); facts from `js/saia-knowledge.js`.
5. **Deps:** stay dependency-free vanilla — no GSAP/Locomotive; hand-roll like `journey.js`.
6. **End target = Shopify store.** Build static-portable now (this spec), port to a Liquid theme
   later. All five portability rules above are mandatory acceptance criteria for every build task.
7. **Hire = rental checkout** (eventual). This build routes every hire CTA through the single
   `window.SAIA.startHire()` entry point so the Shopify cart can be wired in later in one place.
