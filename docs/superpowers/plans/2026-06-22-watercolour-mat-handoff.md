# Watercolour Mat Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `home.html`, the showcased 3D mat washes out and crossfades into a single flat watercolour mat that sits under Cristina's feet while she flows through her poses.

**Architecture:** Keep the realistic 3D `saia-mat.glb` showcase for the early bands. Retire the dark watercolour-on-mesh wash. At the "Move with Cristina" beat (scroll p≈0.50→0.56), fade the WebGL canvas out while a new flat 2D watercolour mat PNG (`#matStage`) — painted in Cristina's style, living in the same DOM coordinate system as the figures — fades in under her foot line. Because the mat is a 2D layer anchored like the figures, it is always perfectly under her feet (no 3D alignment math). The mat is **fixed** (a calm stage), not per-pose.

**Tech Stack:** Vanilla JS, Three.js (already wired), Playwright (headless screenshots), Higgsfield MCP (asset generation). No build step; static site on `:8000`.

## Global Constraints

- **Mats are HIRE ONLY** — never "buy"/"for sale". (Not surfaced in this work, but the brand rule stands.)
- **Palette:** cream `#F5F1E8`, ink `#2B2620`, terracotta accent `#B8624A`. The new mat uses the warm terracotta/charcoal/cream watercolour palette of the existing figures.
- **English-only project.** No Farsi/RTL.
- **Don't remove existing UI elements** beyond the specific ones named in this plan (the dark wash mesh).
- **Not a git repo** — there are no commit steps; each task ends with a screenshot/visual verification checkpoint instead.
- **Edit only `home.html`, `js/home-journey.js`, and `assets/figure/*`.** Do not touch `index.html` / `hero.html` or the unroll choreography before p≈0.44.
- **Figure pipeline recipe** lives in project memory `cristina-figure-pipeline` — reuse its locked reference IDs and watercolour prompt for any asset generation.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `assets/figure/mat-stage.png` | The single flat watercolour stage mat | Create (Higgsfield) |
| `home.html` | Add `#matStage` DOM layer behind the figures | Modify (~line 93–112 area) |
| `js/home-journey.js` | Remove dark wash; add canvas fade + `matStageFor()` handoff | Modify |
| `assets/figure/figure-*.png` | Figures must have NO baked-in mat | Audit; regen offenders |
| `tools/matshot.mjs` | Screenshot harness for the handoff window (reuses `_rig.at`) | Create |

---

### Task 1: Generate the watercolour stage mat asset

**Files:**
- Create: `assets/figure/mat-stage.png`
- Reference: `assets/figure/figure-2.png` (has a baked mat to match), project memory `cristina-figure-pipeline`

**Interfaces:**
- Produces: `assets/figure/mat-stage.png` — a transparent-background, alpha-cropped PNG of one flat yoga mat in gentle 3/4 perspective, watercolour-and-ink style, matching the figure palette.

- [ ] **Step 1: Generate the mat illustration via Higgsfield MCP**

Call `generate_image` with model `nano_banana_pro`, aspect ratio `3:2` (wide mat), quality 1k, prompt:

```
A refined hand-painted editorial watercolour-and-ink illustration (not a photograph) of a
single yoga and Pilates exercise mat lying flat on the floor, seen in gentle three-quarter
perspective — the long edge roughly horizontal and receding slightly away from the viewer.
Warm terracotta, charcoal and cream palette; soft watercolour shading with delicate ink
lines; subtle paper grain; flat plain cream background; a soft contact shadow beneath the
mat. The mat has a faint centre line down its length and a small "SAÏA" wordmark near one
end. No people, no text other than the wordmark.
```

- [ ] **Step 2: Remove background**

Call `remove_background` with `media_id` = the generation job id from Step 1.

- [ ] **Step 3: Download, autocrop to alpha bbox, save**

Download the cutout. Autocrop: zero out pixels with alpha < 24 (drops soft halos), crop to the alpha bounding box, save as `assets/figure/mat-stage.png`. (Reuse the PIL approach from the figure pipeline — see `tools/figcut/` for the existing crop pattern.)

- [ ] **Step 4: Verify the asset visually — LOOP UNTIL RIGHT**

Read `assets/figure/mat-stage.png` and `assets/figure/figure-2.png` side by side. Confirm ALL of:
- Background is fully transparent (no cream rectangle).
- Perspective: long edge horizontal, receding gently away — same family of angle as `figure-2`'s baked mat.
- Palette/medium matches the figures (warm terracotta/charcoal/cream, visible paper grain and ink lines).
- Reads as ONE clean mat, not a folded/stacked or top-down-flat mat.

If any check fails, adjust the prompt (perspective wording, palette, "single mat", "lying flat") and repeat Steps 1–3. Do not proceed until the asset matches.

---

### Task 2: Add the `#matStage` DOM layer to `home.html`

**Files:**
- Modify: `home.html` (the `.home-sticky` block, around lines 91–112)

**Interfaces:**
- Consumes: `assets/figure/mat-stage.png` (Task 1)
- Produces: a DOM element `#matStage` (an `<img>`) positioned behind `#figureLayer` and above `#homeCanvas`, anchored like the figures (`left:55%`, foot line `bottom:~12vh`), starting at `opacity:0`. `js/home-journey.js` (Task 3) drives its opacity.

- [ ] **Step 1: Insert the `#matStage` layer**

In `home.html`, immediately AFTER the `#homeMat` img (line 93) and BEFORE the `#figureLayer` div (line 96), add:

```html
      <!-- Watercolour stage mat — fades in under Cristina at the handoff (p≈0.50→0.56),
           sits behind the figures, above the canvas. Driven by matStageFor() in home-journey.js -->
      <img id="matStage" src="assets/figure/mat-stage.png" alt=""
           style="position:absolute; left:55%; bottom:12vh; transform:translateX(-50%);
                  width:46vw; height:auto; transform-origin:bottom center; z-index:2;
                  opacity:0; pointer-events:none; will-change:opacity;
                  filter:drop-shadow(0 30px 36px rgba(43,38,32,.18));">
```

Note: `#figureLayer` is also `z-index:2`; because `#matStage` comes *before* it in the DOM, the figures paint on top — Cristina's body is in front of the mat. The canvas is `z-index:1`, so the mat sits above it.

- [ ] **Step 2: Verify the element exists and is correctly stacked**

Start the static server if not running: `python3 -m http.server 8000` (from project root). Then:

Run: `node -e "import('playwright').then(async({chromium})=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:8000/home.html',{waitUntil:'networkidle'});const r=await p.evaluate(()=>{const m=document.getElementById('matStage');const cs=getComputedStyle(m);return{present:!!m,z:cs.zIndex,opacity:cs.opacity,src:m.getAttribute('src')};});console.log(JSON.stringify(r));await b.close();})"`

Expected: `{"present":true,"z":"2","opacity":"0","src":"assets/figure/mat-stage.png"}`

---

### Task 3: Wire the handoff in `js/home-journey.js`

**Files:**
- Modify: `js/home-journey.js`

**Interfaces:**
- Consumes: `#matStage` (Task 2), the existing `paint(p)` / `_rig.at(p)` / `init()` functions.
- Produces: `matStageFor(p)` (0→1 smoothstep across p 0.50→0.56); `paint()` and `_rig.at()` drive `canvas.style.opacity = 1 - matStageFor(p)` and `matStageEl.style.opacity = matStageFor(p)`. Removes `wcMaterial`, `wcMesh`, `WC_URL`, `washFor`.

- [ ] **Step 1: Remove the dark wash — delete the watercolour mesh and its loader**

In `init()`, delete the entire watercolour-skin block (the comment + `wcMap`, `wcMaterial`, `wcMesh` creation and `group.add(wcMesh)` — currently lines ~227–241):

```js
    /* watercolour skin: the SAME mat geometry ... */
    const wcMap = glb ? mat.loadColorMap(WC_URL) : normalTex;
    wcMaterial = new THREE.MeshPhysicalMaterial({ ... });
    const wcMesh = new THREE.Mesh(geo, wcMaterial);
    wcMesh.castShadow = false; ... group.add(wcMesh);
```

Also remove `wcMaterial` from the `let` declaration on line ~38 (change `meshMaterial, wcMaterial, floor` → `meshMaterial, floor`) and remove the `WC_URL` const (line ~17).

- [ ] **Step 2: Remove `washFor` and its uses**

Delete the `washFor(p)` function (line ~66). In `paint(p)` remove the line `if (wcMaterial) wcMaterial.opacity = washFor(p);` (line ~181). In `_rig.at(p)` remove `if (wcMaterial) wcMaterial.opacity = washFor(p);` (line ~268).

- [ ] **Step 3: Add the `#matStage` reference and `matStageFor()`**

Near the other element lookups (after `const sticky = ...`, line ~25) add:

```js
  const matStageEl = document.getElementById('matStage');
```

Near `deformFor` (line ~64), add the handoff ramp:

```js
  /* 3D mat hands off to the flat 2D watercolour mat: canvas fades out as #matStage fades in,
     peaking just before Cristina walks on (~p0.56) */
  function matStageFor(p) { let t = (p - 0.50) / 0.06; t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
```

- [ ] **Step 4: Drive the crossfade in `paint(p)`**

In `paint(p)`, after `renderer.render(scene, camera);` (line ~182), add:

```js
    const hs = matStageFor(p);
    canvas.style.opacity = (1 - hs).toFixed(3);
    if (matStageEl) matStageEl.style.opacity = hs.toFixed(3);
```

- [ ] **Step 5: Mirror the crossfade in `_rig.at(p)` (so headless screenshots match)**

In `_rig.at(p)`, after `renderer.render(scene, camera);` (line ~269), add the same three lines:

```js
        const hs = matStageFor(p);
        canvas.style.opacity = (1 - hs).toFixed(3);
        if (matStageEl) matStageEl.style.opacity = hs.toFixed(3);
```

- [ ] **Step 6: Stop the initial-reveal CSS transition from lagging the scroll fade**

The canvas gets `canvas.style.transition = 'opacity .8s ease'` after init (line ~250) for the first reveal. That 0.8s ease would lag the scroll-linked fade. After the reveal is set, the per-frame opacity writes need to be instant. In `init()`, change the reveal so the transition is cleared on the next frame:

```js
    canvas.style.transition = 'opacity .8s ease'; canvas.style.opacity = '1';
    setTimeout(function () { canvas.style.transition = 'none'; }, 850);
```

- [ ] **Step 7: Verify no console errors and the handoff fires**

With the server running:

Run: `node tools/matshot.mjs` (created in Task 4) — but for a first smoke test before that exists, run:

```
node -e "import('playwright').then(async({chromium})=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});await p.goto('http://localhost:8000/home.html',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.SAIA&&window.SAIA._rig,{timeout:8000}).catch(()=>{});const r=await p.evaluate(()=>{window.SAIA._rig.at(0.58);const c=getComputedStyle(document.getElementById('homeCanvas')).opacity;const m=getComputedStyle(document.getElementById('matStage')).opacity;return{canvas:c,mat:m};});console.log('p0.58',JSON.stringify(r),'errors:',errs.join('|')||'none');await b.close();})"
```

Expected: at p0.58 `canvas` opacity ≈ `0` and `matStage` opacity ≈ `1`, errors `none`.

---

### Task 4: Build the screenshot harness and verify the handoff

**Files:**
- Create: `tools/matshot.mjs`

**Interfaces:**
- Consumes: `window.SAIA._rig.at(p)` and the running server on `:8000`.
- Produces: screenshots in `tools/matshot/` across the handoff + pose range.

- [ ] **Step 1: Write `tools/matshot.mjs`**

```js
/* SAÏA — watercolour mat handoff verification. Renders the handoff window + the
   pose flow so we can confirm one mat under Cristina's feet. Usage: node tools/matshot.mjs */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tools/matshot', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 }).catch(() => {});
const ps = [
  ['a-0.48-showcase', 0.48], ['b-0.52-handoff', 0.52], ['c-0.56-walkin', 0.56],
  ['d-0.617-stand', 0.617], ['e-0.703-heart', 0.703], ['f-0.731-hinge', 0.731],
  ['g-0.789-dog', 0.789], ['h-0.817-lunge', 0.817], ['i-0.874-seated', 0.874],
  ['j-0.960-close', 0.960],
];
for (const [n, p] of ps) {
  await page.evaluate((p) => window.SAIA._rig.at(p), p);
  await page.waitForTimeout(160);
  await page.screenshot({ path: `tools/matshot/${n}.png` });
  console.log(n, p);
}
console.log('CONSOLE ERRORS:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
```

- [ ] **Step 2: Run the harness**

Run: `node tools/matshot.mjs`
Expected: 10 PNGs written to `tools/matshot/`, console errors `none`.

- [ ] **Step 3: Review the handoff frames**

Read `tools/matshot/a-0.48-showcase.png`, `b-0.52-handoff.png`, `c-0.56-walkin.png`. Confirm:
- `a` (0.48): the realistic 3D mat is still showing (canvas visible), no flat mat yet.
- `b` (0.52): mid-crossfade — 3D fading, flat mat appearing, no moment where NEITHER is visible.
- `c` (0.56): the flat watercolour mat is fully in, 3D canvas gone, Cristina at the start of her walk-in.

If there's a visible gap (blank floor) mid-crossfade, widen/shift the `matStageFor` window in `js/home-journey.js` and re-run.

---

### Task 5: Clean baked-in mats out of the figures

**Files:**
- Modify/regen: `assets/figure/figure-*.png` (only those with a baked-in mat)
- Backup: `tools/figbak/`

**Interfaces:**
- Consumes: figure pipeline recipe (memory `cristina-figure-pipeline`).
- Produces: all 15 figures with transparent-under-feet (no baked mat).

- [ ] **Step 1: Audit all 15 figures**

Read each `assets/figure/figure-1.png` … `figure-15.png`. List which ones contain a baked-in mat under the feet (confirmed so far: `figure-2`; check `figure-1`, `figure-3`, and the rest — walking/standing poses are the likely offenders; `figure-9` dog and `figure-12` seated are clean).

- [ ] **Step 2: Back up the offenders**

Copy each offending `figure-N.png` to `tools/figbak/` before changing it (the dir already exists).

- [ ] **Step 3: Regenerate offenders WITHOUT a mat**

For each offender, regenerate via Higgsfield using the figure recipe from memory `cristina-figure-pipeline` (model `nano_banana_pro`, the locked reference IDs, the watercolour prompt prefix), with the matching pose from the `FIG` list and an explicit **"barefoot on a flat plain cream floor, no mat"**. Then `remove_background` → autocrop → overwrite `assets/figure/figure-N.png`. Keep the same pixel framing/scale as the original so the `FIG` heights still line up.

- [ ] **Step 4: Verify — LOOP UNTIL RIGHT**

Re-run `node tools/matshot.mjs` and read the pose frames (`c`…`j`). Confirm across EVERY pose:
- There is exactly ONE mat — the `#matStage` watercolour mat — under her feet.
- No second tiny baked-in mat appears in any walking/standing frame.
- Her feet read as resting on the stage mat (not floating above or buried below it).

If any frame shows a double mat or a regen lost her likeness/scale, fix that figure (re-prompt or restore from `tools/figbak/` and erase the mat in PIL) and re-run.

---

### Task 6: Tune placement until perfect — the iteration loop

**Files:**
- Modify: `home.html` (`#matStage` `width` / `bottom`), `js/home-journey.js` (`matStageFor` window) as needed.

**Interfaces:**
- Consumes: the full pipeline from Tasks 1–5.

- [ ] **Step 1: Run the full harness and review every frame**

Run: `node tools/matshot.mjs`, then read all 10 frames in `tools/matshot/`.

- [ ] **Step 2: Judge against the goal — LOOP UNTIL PERFECT**

For the pose frames (`c`–`j`), the mat must read as the single believable stage Cristina works on. Check, and adjust the named knobs until all are true:

| Symptom | Knob to adjust |
|---|---|
| Mat too small / her feet hang off the front | `#matStage` `width` ↑ (home.html) |
| Mat too big / dominates the frame | `#matStage` `width` ↓ |
| Feet float above the mat / mat sits too low | `#matStage` `bottom` ↑ |
| Feet sink below the mat / mat too high | `#matStage` `bottom` ↓ |
| Blank floor moment mid-crossfade | widen `matStageFor` window |
| Mat appears too early/late vs. her walk-in | shift `matStageFor` start (currently 0.50) |
| Mat paints over Cristina's body | DOM order: `#matStage` must precede `#figureLayer` |

After each change, re-run `node tools/matshot.mjs` and re-review. Repeat until every pose frame is right. Do NOT declare done until the screenshots clearly show one watercolour mat correctly under her feet across the whole flow.

- [ ] **Step 3: Final real-scroll smoke test**

Run: `node tools/scroll.mjs` and confirm the canvas stays pinned and no console/layout regression in the existing bands. Read `tools/scroll/5-f0.7.png` (the Cristina beat) to confirm it matches the rig output.

- [ ] **Step 4: Report with evidence**

Present the key frames (`b-0.52-handoff`, `c-0.56-walkin`, `g-0.789-dog`, `i-0.874-seated`) to the user as proof the handoff and under-feet placement are correct.

---

## Self-Review

**Spec coverage:**
- Retire dark wash → Task 3 (Steps 1–2). ✓
- New mat asset → Task 1. ✓
- `#matStage` DOM layer + z-order → Task 2. ✓
- Canvas handoff + `matStageFor()` → Task 3 (Steps 3–6). ✓
- Clean figures → Task 5. ✓
- Fixed (not per-pose) mat → no scaling logic anywhere; mat opacity-only. ✓
- Screenshot loop "until perfect" (user's explicit ask) → Tasks 4 & 6. ✓
- Verify command from spec → Task 6 Step 3 + final report. ✓

**Placeholder scan:** No TBD/TODO; every code step shows the code; commands have expected output. ✓

**Type/name consistency:** `matStageEl`, `matStageFor`, `#matStage` used consistently across Tasks 2, 3, 4, 6. `washFor`/`wcMaterial`/`wcMesh`/`WC_URL` only ever referenced in their removal step (Task 3). ✓
