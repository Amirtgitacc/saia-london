# SAÏA London — implemented site

A real, runnable implementation of the four Claude Design prototypes in
`../project`, built as a **dependency-free static site** (HTML + CSS +
vanilla JS, with Three.js vendored locally). No build step.

## Run

```bash
cd site
python3 -m http.server 8000   # or any static server
# open http://localhost:8000/
```

A static server is required (not `file://`) because the pages `fetch()`
the `.glb` mat model and the texture.

## Pages

| File           | Design source                              | What it is |
|----------------|--------------------------------------------|------------|
| `index.html`   | **SAÏA - A Day on the Mat** (primary)      | The continuous scroll journey — real WebGL mat that unrolls, a camera that travels down it as a path, a dawn→midday→dusk day-arc, scene "acts" (Pilates → Community → Mindset/hire → Founder), and the breathing **Noor** concierge. |
| `hero.html`    | **SAÏA - 3D Mat Hero**                     | The dim-studio hero: the mat unrolls on scroll, the hire offer reveals, and the booking agent docks in when the mat is fully open. |
| `home.html`    | **SAÏA - Home**                            | The flat marketing home: scroll-driven mat parallax hero, responsive desktop/mobile nav, all editorial sections, Option-B concierge. |
| `samples.html` | **SAÏA - Direction Samples**               | The horizontal design-system & directions board. |

## Structure

```
site/
  index.html / hero.html / home.html / samples.html
  css/base.css          design tokens, fonts, keyframes, hover/focus helpers
  js/
    mat-core.js         GLB parse + Archimedean-spiral unroll + procedural normal map (shared)
    planner.js          concierge agentic local planner + action engine (shared)
    concierge-ui.js     agentic concierge thread/hire-panel rendering (Journey + Hero)
    journey.js          "A Day on the Mat" controller
    hero.js             3D Mat Hero controller
    home.js             Home controller (parallax + FAQ concierge)
  vendor/three.min.js   Three.js r160 (vendored from npm)
  assets/               saia-mat.glb, saia-mat-texture.png, mat-flat.png, mat-rolled.png
```

## Notes on faithfulness

- The 3D scene, spiral unroll math, day-arc, camera keyframes and concierge
  logic are ported directly from the prototypes' source.
- The design tool's runtime (`x-dc` / `DCLogic` / `sc-if` / `{{ }}`) was
  replaced with plain DOM + small vanilla controllers; the `<image-slot>`
  drop-in placeholders became styled `.saia-slot` placeholders.
- **Concierge AI:** the prototypes called the design tool's
  `window.claude.complete`, which doesn't exist in a real deployment. Per
  the chosen direction this build ships the **local deterministic planner**
  only (the prototype's own fallback) — fully offline, no API key, and the
  agentic booking flow still runs end-to-end (e.g. "30 women on Saturday"
  → 33 mats, £280.50, quoted). To wire real Claude later, add a small
  server endpoint and call it from `concierge-ui.js` before falling back to
  `SAIA.Planner.localPlan`.
- Fonts load from Google Fonts; everything else (Three.js, model, textures)
  is local, so the site works without any third-party CDN.
```
