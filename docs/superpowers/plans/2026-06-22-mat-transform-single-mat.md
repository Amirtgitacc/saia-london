# Mat Transform + Single-Mat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the realistic 3D mat *transform* (not cross-fade) into a flat watercolour mat in place, and have exactly ONE mat under Cristina for all 15 poses with believable contact.

**Architecture:** Keep the SAÏA mat as the single Three.js mesh for the entire journey. At the hand-off, morph the mesh's *material* from photoreal PBR to a flat watercolour painting via a `uMorph` uniform on one material — same geometry, same silhouette, so it reads as the surface restyling itself (R1). The camera is already locked from p0.50→1.0, so the mesh's mat is a fixed on-screen quad; we keep that live mesh as the ONLY mat and composite mat-free Cristina figures (each carrying her own soft contact-shadow halo) on top of it — no PNG floor, no per-figure mat, so doubling is impossible (R2).

**Verified facts (checked 2026-06-22):** `assets/saia-mat-texture.png` and `assets/saia-mat-watercolour.png` are both **512×1274** → identical layout, so the watercolour texture maps onto the same GLB UVs with zero stretch. The camera keyframes at p0.50/0.66/0.80/1.00 (`home-journey.js:51-54`) are identical → the mesh mat is already pixel-stable through the pose section.

**Rejected approaches (do NOT revisit — they inherit the report's root failure):**
- **Plate-subtraction** (generate Cristina on the mat, then subtract the clean mat plate): fails because the AI redraws the mat at a slightly different angle per pose, so `generated_mat(angle A) − clean_plate(angle B)` does not cancel — the whole mat survives the subtraction. Same geometry-drift wall as Attempt A.1.
- **Homography / affine baked-pose-mat registration**: salvage path at best; still fights mat colour drift, occluded corners, and pose warping, and does nothing for R1. Mat-free figures sidestep all of it (no mat pixels exist to drift).

**Tech Stack:** Vanilla JS, Three.js (global `window.THREE`), Playwright (headless verification only). No new dependencies. Higgsfield MCP (`nano_banana_pro`) for figure/texture regeneration.

## Global Constraints

- Mat palette: muted **charcoal/taupe + faint terracotta**. NEVER saturated orange (clashes with her terracotta leggings). Page palette: cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`.
- Mats are **HIRE-ONLY** in copy — this plan is visual only, do not touch hire/booking copy.
- DO NOT touch the 3D unroll (`deformFor`, p0→0.22) or the mood/lighting track (`MOODS`, `applyMood`).
- English-only. Warm, female-led, British brand.
- Mobile (`max-width:767px`) / `prefers-reduced-motion` → existing `.is-static` poster path (no WebGL) must still work and degrade gracefully.
- Front end stays dependency-free except Three.js (runtime) + Playwright (build/verify only).
- Verification of WebGL visuals is screenshot-based (`tools/matshot.mjs`) plus structural assertions via the `window.SAIA._rig` debug hook. There is no unit-test framework; "tests" here are (a) structural node scripts that assert `_rig` values and (b) human screenshot gates.

**Run/verify environment (needed by every verification step):**
```bash
# terminal A
cd "/Users/at/Projects/site 2" && python3 -m http.server 8000
# terminal B runs the node tools against http://localhost:8000/home.html
```

---

## File map

| File | Responsibility | Change |
|---|---|---|
| `assets/saia-mat-watercolour.png` | UV-aligned watercolour mat texture | Verify / regenerate |
| `js/mat-core.js` | mat geometry + materials | Add `makeMatMaterial()` (two-map morph material) |
| `js/home-journey.js` | scroll engine | Drive `uMorph` from scroll; keep mesh as the only mat; retire PNG floor; recalibrate figure box |
| `home.html` | DOM layers | Retire `#matStage` for WebGL path (keep for `.is-static` poster) |
| `tools/figsrc/*` | raw mat-free pose generations | New assets (regenerate) |
| `tools/figbake.mjs` | register poses | Rewrite: register **mat-free** figures by silhouette, keep shadow halo |
| `assets/figure/figure-1..15.png` | baked poses | Regenerated, mat-free |
| `tools/morphtest.mjs` | structural assertions on the morph | New |
| `tools/matshot.mjs` | screenshot harness | Reuse as-is for human gate |

---

### Task 1: UV-correct watercolour mat texture

**Files:**
- Verify/replace: `assets/saia-mat-watercolour.png`
- Reference: `assets/saia-mat-texture.png` (the photoreal map whose UV layout we must match)

**Interfaces:**
- Produces: `assets/saia-mat-watercolour.png` — a watercolour repaint sharing the EXACT layout of `saia-mat-texture.png` (SAÏA wordmark bottom-centre, single faint centre seam line, same aspect ratio ~0.42:1 portrait), so it maps onto the GLB UVs with no stretching.

- [ ] **Step 1: Confirm the existing texture's alignment**

The file `assets/saia-mat-watercolour.png` already exists and visually matches the photoreal layout (same wordmark position, centre line, aspect). Render the mesh wearing it to confirm UVs land correctly (done in Task 2's verification). If it reads too brown/muddy or too dark, regenerate in Step 2; otherwise keep it and skip to Task 2.

- [ ] **Step 2: (If needed) regenerate a cleaner UV-aligned watercolour mat**

Use Higgsfield `nano_banana_pro` with `assets/saia-mat-texture.png` fed as a locked reference for layout:

> "Hand-painted watercolour version of this exact yoga mat texture, same proportions and same SAÏA wordmark position at the bottom, same faint vertical centre line. Muted charcoal-grey and warm taupe wash with a faint terracotta bloom, understated — NOT saturated orange. Soft watercolour paper texture. Flat, evenly lit, no perspective, fills the frame edge to edge."

Then background-flatten onto opaque and save as `assets/saia-mat-watercolour.png` (overwrite). Keep the same pixel aspect as `saia-mat-texture.png`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/at/Projects/site 2"
git add assets/saia-mat-watercolour.png 2>/dev/null || true
# (repo may be non-git; if so, skip commit steps throughout — note in handoff)
```

> NOTE: the working dir reports "Is a git repository: false". If there is no git repo, SKIP every commit step in this plan and instead checkpoint by running the task's verification. Do not `git init` without asking the user.

---

### Task 2: Two-map morph material in `mat-core.js`

**Files:**
- Modify: `js/mat-core.js` (add `makeMatMaterial`, export it)
- Reference: `js/mat-core.js:196-202` (`loadColorMap` — the U-mirror we must reuse)

**Interfaces:**
- Consumes: `loadColorMap(url)` (existing), `makeNormalMap()` (existing).
- Produces: `NS.mat.makeMatMaterial(photorealUrl, watercolourUrl, normalTex)` → a `THREE.MeshPhysicalMaterial` whose `userData.setMorph(morph, bloom)` blends the surface from photoreal (morph 0) to flat watercolour (morph 1), and whose `userData.uniforms` exposes `{uMorph, uBloom, uWatercolour}`.

- [ ] **Step 1: Add `makeMatMaterial` to `mat-core.js`**

Insert before the `NS.mat = { ... }` export (around `js/mat-core.js:204`):

```js
  /* ---- one material that MORPHS photoreal -> flat watercolour in place.
         Same mesh, same UVs: as uMorph 0->1 the lit PBR surface is replaced by the
         flat, self-lit watercolour painting, so it reads as the SURFACE restyling,
         not as object A fading into object B.
         The reveal is NOISE-DRIVEN (a soft watercolour-paper threshold sweeping across
         the UVs) rather than a flat dissolve, so it reads as paint BLOOMING over the mat.
         setMorph also flattens the finish in JS: normalScale->0 (kills the rubber grain)
         and envMapIntensity->0 (kills specular) as it becomes a flat painting. ---- */
  function makeMatMaterial(photorealUrl, watercolourUrl, normalTex) {
    const THREE = window.THREE;
    const map = loadColorMap(photorealUrl);          // U-mirrored to un-reverse the brand
    const wc = loadColorMap(watercolourUrl);         // SAME mirror => UVs coincide
    const m = new THREE.MeshPhysicalMaterial({
      map, color: new THREE.Color('#ffffff'), normalMap: normalTex,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, metalness: 0.0,
      envMapIntensity: 0.22, side: THREE.DoubleSide,
    });
    const ENV0 = 0.22, NRM0 = 0.3;                   // baseline finish (restored at morph 0)
    const u = { uMorph: { value: 0 }, uBloom: { value: 0 }, uWatercolour: { value: wc } };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uMorph = u.uMorph;
      shader.uniforms.uBloom = u.uBloom;
      shader.uniforms.uWatercolour = u.uWatercolour;
      shader.fragmentShader =
        'uniform float uMorph;\nuniform float uBloom;\nuniform sampler2D uWatercolour;\n' +
        'float saiaNoise(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          [
            '#include <opaque_fragment>',
            '  vec3 wcCol = texture2D( uWatercolour, vMapUv ).rgb;',     // flat painting, self-lit
            // soft paper noise (low-freq blotches) gates the reveal so paint blooms unevenly
            '  float n = saiaNoise( floor( vMapUv * 22.0 ) ) * 0.6 + saiaNoise( floor( vMapUv * 7.0 ) ) * 0.4;',
            '  float reveal = smoothstep( n - 0.25, n + 0.25, clamp( uMorph, 0.0, 1.0 ) );',
            // brief wet-bloom lift travelling with uBloom at the wavefront
            '  float s = clamp( uBloom, 0.0, 1.0 ) * (1.0 - abs( reveal - 0.5 ) * 2.0);',
            '  vec3 bloomed = mix( wcCol, clamp( wcCol * 1.18 + 0.05, 0.0, 1.0 ), s );',
            '  gl_FragColor.rgb = mix( gl_FragColor.rgb, bloomed, reveal );',
          ].join('\n')
        );
    };
    m.userData.setMorph = function (morph, bloom) {
      const k = Math.max(0, Math.min(1, morph));
      u.uMorph.value = k; u.uBloom.value = bloom || 0;
      m.envMapIntensity = ENV0 * (1 - k);            // flat painting = no specular
      m.normalScale.set(NRM0 * (1 - k), NRM0 * (1 - k)); // flat painting = no rubber grain
    };
    m.userData.uniforms = u;
    return m;
  }
```

> `vMapUv` is the varying Three.js declares when `map` is set (r152+). If the project's Three.js is older and the shader fails to compile (check console), replace `vMapUv` with `vUv`. Confirm in Step 3.

- [ ] **Step 2: Export it**

Change the export line at `js/mat-core.js:204`:

```js
  NS.mat = { loadGlb, buildSpiralTable, spiralPoint, deform, makeEnv, makeNormalMap, buildGeometry, loadColorMap, makeMatMaterial };
```

- [ ] **Step 3: Verify the material compiles and the watercolour UVs land correctly**

This is wired in Task 3; defer the on-screen check to Task 3 Step 4. For now, sanity-check the file parses:

```bash
cd "/Users/at/Projects/site 2" && node -e "process.exit(0)" && node --check js/mat-core.js && echo OK
```
Expected: `OK` (no syntax error).

- [ ] **Step 4: Commit** (skip if no git repo)

```bash
git add js/mat-core.js && git commit -m "feat(mat): add photoreal->watercolour morph material"
```

---

### Task 3: Drive the morph from scroll; keep the mesh as the only mat (R1)

**Files:**
- Modify: `js/home-journey.js` (material build, `paint`, `_rig.at`, retire `matStageFor`/`matStageStyle` floor behaviour)
- Create: `tools/morphtest.mjs`

**Interfaces:**
- Consumes: `NS.mat.makeMatMaterial` (Task 2).
- Produces: `morphFor(p)`; `meshMaterial.userData.setMorph` calls in `paint`/`_rig.at`; `_rig.peek()` extended to expose `morph` and `bloom`.

- [ ] **Step 1: Build the morph material instead of the plain PBR material**

In `js/home-journey.js:219-227`, replace the material/mesh block. Currently:

```js
    const normalTex = mat.makeNormalMap();
    const colorMap = glb ? mat.loadColorMap(TEX_URL) : normalTex;
    meshMaterial = new THREE.MeshPhysicalMaterial({
      map: colorMap, color: new THREE.Color('#ffffff'), normalMap: normalTex,
      normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, metalness: 0.0,
      envMapIntensity: 0.22, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, meshMaterial);
```

Replace with:

```js
    const normalTex = mat.makeNormalMap();
    const WC_URL = ASSETS.matWatercolour || 'assets/saia-mat-watercolour.png';
    meshMaterial = glb
      ? mat.makeMatMaterial(TEX_URL, WC_URL, normalTex)
      : new THREE.MeshPhysicalMaterial({ map: normalTex, color: new THREE.Color('#ffffff'),
          normalMap: normalTex, normalScale: new THREE.Vector2(0.3, 0.3),
          roughness: 0.9, metalness: 0.0, envMapIntensity: 0.22, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, meshMaterial);
```

- [ ] **Step 2: Add `morphFor(p)` and retire the canvas-fade floor**

Replace `matStageFor` / `bloomFor` / `matStageStyle` (`js/home-journey.js:64-79`). Keep `bloomFor` (reused), replace the rest:

```js
  function deformFor(p) { return Math.min(1, Math.max(0, p / UNROLL_END)); } // unchanged
  /* The mat is ONE mesh the whole way. At the hand-off we MORPH its material from photoreal
     to flat watercolour in place (R1) — the WebGL canvas stays fully visible; there is no
     second PNG mat. morphFor: 0 until p0.50, 1 by p0.56, smoothstepped. */
  function morphFor(p) { let t = (p - 0.50) / 0.06; t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  /* brief paint-bloom pulse at the moment of change (finishes crisp) */
  function bloomFor(p) { const t = (p - 0.50) / 0.06; return (t <= 0 || t >= 1) ? 0 : Math.sin(t * Math.PI); }
```

Delete `matStageFor` and `matStageStyle` entirely (and the now-unused `MAT_SHADOW` filter on `#matStage` — but keep the `MAT_SHADOW` const, it's still applied to figures via `initFigures`). Search for any remaining `matStageFor(`/`matStageStyle(` references after editing.

- [ ] **Step 3: Apply the morph in `paint` and `_rig.at`; keep canvas opaque**

In `paint(p)` (`js/home-journey.js:177-189`), replace:

```js
    renderer.render(scene, camera);
    canvas.style.opacity = (1 - matStageFor(p)).toFixed(3);
    matStageStyle(p);
```
with:
```js
    if (meshMaterial.userData.setMorph) meshMaterial.userData.setMorph(morphFor(p), bloomFor(p));
    renderer.render(scene, camera);
    canvas.style.opacity = '1';   // the mesh IS the mat for the whole journey
```

In `_rig.at(p)` (`js/home-journey.js:252-260`), replace the matching two lines:
```js
        canvas.style.opacity = (1 - matStageFor(p)).toFixed(3);
        matStageStyle(p);
```
with:
```js
        if (meshMaterial.userData.setMorph) meshMaterial.userData.setMorph(morphFor(p), bloomFor(p));
        canvas.style.opacity = '1';
```
(Move the `setMorph` call BEFORE `renderer.render(scene, camera)` in `_rig.at` — it currently renders at line 256; place setMorph just before it.)

Extend `_rig.peek()` (`js/home-journey.js:249`) to expose the morph:
```js
      peek() { return { current, target, paused, visible, lastD, morph: morphFor(current), bloom: bloomFor(current), cam: camera.position.toArray() }; },
```

- [ ] **Step 4: Hide the PNG floor on the WebGL path**

In `initFigures()` (`js/home-journey.js:134-142`), the `#matStage` element is the old floor. Stop showing it (WebGL path only — `goStatic()` returns before this runs, so the static poster is unaffected). Replace the `if (matStageEl) { ... }` line:

```js
    if (matStageEl) { matStageEl.style.display = 'none'; }   // retired: the live mesh is the only mat now
```

- [ ] **Step 5: Structural test — assert the morph curve**

Create `tools/morphtest.mjs`:

```js
/* SAÏA — structural assertions for the mat material morph (R1).
   Confirms uMorph is 0 before the hand-off, 1 after, canvas stays opaque, no console errors. */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8000/home.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.SAIA && window.SAIA._rig, { timeout: 8000 });
const probe = async (p) => page.evaluate((p) => {
  window.SAIA._rig.at(p);
  const c = document.getElementById('homeCanvas');
  return { ...window.SAIA._rig.peek(), canvasOpacity: c.style.opacity };
}, p);
const checks = [];
const a = await probe(0.49); checks.push(['morph@0.49==0', Math.abs(a.morph) < 0.001]);
const b = await probe(0.56); checks.push(['morph@0.56==1', Math.abs(b.morph - 1) < 0.001]);
const c = await probe(0.80); checks.push(['morph@0.80==1', Math.abs(c.morph - 1) < 0.001]);
checks.push(['canvasOpaque@0.80', c.canvasOpacity === '1' || c.canvasOpacity === '']);
checks.push(['noConsoleErrors', errs.length === 0]);
await browser.close();
let ok = true;
for (const [name, pass] of checks) { console.log(pass ? '✓' : '✗', name); if (!pass) ok = false; }
if (errs.length) console.log('ERRORS:', errs.join(' | '));
process.exit(ok ? 0 : 1);
```

- [ ] **Step 6: Run the structural test (expect PASS)**

```bash
cd "/Users/at/Projects/site 2" && node tools/morphtest.mjs
```
Expected: all `✓`, exit 0. If `noConsoleErrors` fails with a shader error, swap `vMapUv`→`vUv` in `mat-core.js` (Task 2 note) and re-run.

- [ ] **Step 7: Human gate — confirm it reads as a TRANSFORM, not two mats**

```bash
cd "/Users/at/Projects/site 2" && node tools/matshot.mjs
```
Open `tools/matshot/b-0.52-handoff.png`. Acceptance: the mat is mid-morph — the SAME mat shape, its surface part-photoreal/part-watercolour, no second offset mat, no doubled edge. `a-0.48-showcase.png` is photoreal; `c-0.56-walkin.png` is fully watercolour at the identical silhouette.

- [ ] **Step 8: Commit** (skip if no git repo)

```bash
git add js/home-journey.js tools/morphtest.mjs && git commit -m "feat(home): morph the single mat mesh; retire the PNG floor"
```

---

### Task 4: Calibrate the figure box to the live mesh mat's screen rect

**Files:**
- Modify: `js/home-journey.js:127` (`FIG_BOX`)
- Reuse: `tools/matshot.mjs`

**Interfaces:**
- Consumes: `_rig.at(p)` rendering the watercolour mesh mat at the locked camera (p≥0.56).
- Produces: a `FIG_BOX` `{left, bottom, width}` whose on-screen rectangle sits ON the mesh mat's surface (feet line above the front lip, within the side edges).

- [ ] **Step 1: Measure the mesh mat's on-screen rect**

Add a one-off probe to `_rig` (temporary; can stay, it's inert). After the `at(p)` method in `_rig` (`js/home-journey.js:260`), add:

```js
      matRect() {                                  // mesh mat's screen-space bbox at current cam
        const b = new THREE.Box3().setFromObject(group);
        const pts = [], mn = b.min, mx = b.max;
        for (const x of [mn.x, mx.x]) for (const y of [mn.y, mx.y]) for (const z of [mn.z, mx.z]) {
          const v = new THREE.Vector3(x, y, z).project(camera);
          pts.push([(v.x * 0.5 + 0.5) * canvas.clientWidth, (-v.y * 0.5 + 0.5) * canvas.clientHeight]);
        }
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      },
```

Run:
```bash
cd "/Users/at/Projects/site 2" && node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto("http://localhost:8000/home.html", { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.SAIA && window.SAIA._rig);
  const r = await p.evaluate(() => { window.SAIA._rig.at(0.62); return window.SAIA._rig.matRect(); });
  console.log("mat screen rect @0.62:", r, "viewport 1440x900");
  await b.close();
})();'
```
Record the rect (left/right/top/bottom in px at 1440×900).

- [ ] **Step 2: Convert to a `FIG_BOX` that lands her contact on the mat**

Compute from the measured rect:
- `width` (vw) = `(right - left) / 1440 * 100`, rounded.
- `left` (%) = horizontal centre `(left+right)/2 / 1440 * 100`, rounded.
- `bottom` (vh): the figures anchor their feet to `FIG_BOX.bottom`. Set it so the feet line sits ~1/3 up from the mat's front edge onto the surface (NOT on the front lip — the earlier "standing in front of the mat" bug). Use `bottom_vh = (900 - matFrontY) / 900 * 100 + 4`, where `matFrontY` ≈ the rect `bottom`. Start with `+4vh` of lift onto the surface; tune in Step 3.

Update `js/home-journey.js:127`:
```js
  const FIG_BOX = { left: '<computed>%', bottom: '<computed>vh', width: '<computed>vw' };
```

- [ ] **Step 3: Visual gate — feet on the surface, spread poses contained**

```bash
cd "/Users/at/Projects/site 2" && node tools/matshot.mjs
```
Check `g-0.797-dog.png` and `h-0.824-lunge.png`: the (current, on-mat) figures' contact should land inside the watercolour mesh mat. Because the current figures still carry baked mats, expect a temporary doubled look here — that is fixed in Tasks 5–6. The ONLY thing to confirm now: the mesh mat's rect comfortably contains the figure footprint. Nudge `FIG_BOX` until it does.

- [ ] **Step 4: Commit** (skip if no git repo)
```bash
git add js/home-journey.js && git commit -m "chore(home): calibrate figure box to the live mat rect"
```

---

### Task 5: Inventory the reuse source frames (DECISION: reuse, not regenerate)

**Decision (2026-06-22):** The existing on-mat generations in `tools/figsrc/pose-01..15.{png,jpeg}` are beautiful, identity-consistent, and have real bare-feet-on-mat contact. We REUSE them and lift Cristina off the mat in Task 6 — no Higgsfield regeneration. (Original plan's mat-free regeneration is shelved; revisit only if extraction fails on specific poses.)

**Files:** none modified — this task is verification + the pose→figure order mapping.

**Interfaces:**
- Produces: a confirmed `pose-NN → figure-N` ordering that Task 6 consumes.

- [ ] **Step 1: Confirm the 15 source frames exist and map the order**

```bash
cd "/Users/at/Projects/site 2" && ls tools/figsrc/pose-*.{png,jpeg} 2>/dev/null | sort
```
Expected: `pose-01` … `pose-15` (mix of `.png`/`.jpeg`). The numeric order IS the motion order = `FIG_LABELS` (`js/home-journey.js:121-123`): 01 walk in, 02 step on, 03 stand, 04 arms rise, 05 reach up, 06 heart open, 07 hinge, 08 forward fold, 09 downward dog, 10 low lunge, 11 lower to seat, 12 seated cross, 13 seated twist, 14 seated reach, 15 hands to heart. So `pose-NN` → `figure-N` is a direct 1:1 by number.

- [ ] **Step 2: Spot-check two frames are on-mat as expected**

Confirm (by eye) `pose-03` (stand) and `pose-09` (downward dog): Cristina painted ON a muted charcoal/taupe mat, warm skin/terracotta/cream against the cool grey mat (this colour contrast is what Task 6's mat-removal relies on). No code change. If a frame is mat-free already or has an oddly-coloured mat, note it for Task 6.

---

### Task 6: `figbake` v3 — lift Cristina off the mat (extract figure + synthesize contact shadow)

**Files:**
- Modify: `tools/figbake.mjs`
- Output: `assets/figure/figure-1..15.png` (transparent: Cristina + a synthesized soft contact shadow, mat removed, registered to one canonical contact line)

**Interfaces:**
- Consumes: `tools/figsrc/pose-01..15.{png,jpeg}` (Task 5).
- Produces: `assets/figure/figure-1..15.png` at `OUT_W×OUT_H`, transparent, Cristina-only + a synthesized ground shadow, registered so her contact point lands on one canonical anchor and her height is normalised → identical contact line across all 15 frames (no second mat anywhere).

**Why this works (the core idea):** the WebGL mesh is now the only mat, so the figure must contribute NO mat pixels. Each `pose-NN` is Cristina on a cool grey mat against a cream background; her body (warm skin, terracotta leggings, cream top) and the cool grey mat are strongly colour-separated. So: (1) border flood-fill removes the cream, (2) a connectivity flood-fill from the lower mat "wings" removes the mat (stopping at her warm/saturated body — connectivity keeps her dark hair, which is disconnected from the mat, safe), (3) her painted shadow is consumed with the mat, so we synthesize a clean soft ground shadow from her lower silhouette, (4) register by figure silhouette. **This is the user-chosen reuse path.** Thresholds will need a tuning pass against the real frames — iterate using the `.debug.png` overlays.

The existing pipeline order in `tools/figbake.mjs`: corner bg sample → mat silhouette detection (`~:73-101`, REMOVE) → border flood-fill alpha matte (`~:104-125`, KEEP) → transform (`~:127-132`, REPLACE) → debug (`~:135-144`, REPLACE). Keep the helpers (`lum`, `sat`, `dist`, `bg`). The new flow inside `page.evaluate`: corner bg sample → border flood-fill (cream→transparent) → **mat-removal flood (NEW)** → **figure silhouette scan (NEW)** → **synthesized shadow + figure draw (NEW)** → debug.

- [ ] **Step 1: After the border flood-fill, REMOVE the mat by a connectivity flood**

The border flood-fill already builds `outside` (1 = cream-connected-to-border = transparent). Opaque = figure + mat. Right AFTER that flood-fill loop completes (and BEFORE writing alpha at `~:118`), insert mat removal. Sample the mat colour from the lower side-wings (mat extends left/right past her body), then flood mat-like pixels from the bottom/side seeds:

```js
    // ---- remove the mat: it's the only thing we must NOT ship (the WebGL mesh is the mat) ----
    const satOf = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
    const lumOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    // sample mat colour from the lower wings (leftmost/rightmost opaque px per row = mat, away from her)
    let mr = 0, mg = 0, mb = 0, mn2 = 0;
    for (let y = Math.floor(H * 0.84); y < Math.floor(H * 0.97); y++) {
      let xl = -1, xr = -1;
      for (let x = 0; x < W; x++) { const idx = y * W + x; if (!outside[idx]) { if (xl < 0) xl = x; xr = x; } }
      if (xl < 0) continue;
      for (const x of [xl, xl + 8, xr - 8, xr]) { if (x < 0 || x >= W) continue; const i = (y * W + x) * 4; mr += px[i]; mg += px[i + 1]; mb += px[i + 2]; mn2++; }
    }
    const matC = mn2 ? [mr / mn2, mg / mn2, mb / mn2] : [110, 108, 104];
    // "mat-like": low saturation, mid/low luminance, near the sampled mat colour. Her warm skin,
    // terracotta leggings (high sat) and cream top (high lum) all FAIL this → they survive.
    const matLike = (idx) => {
      if (outside[idx]) return false;
      const i = idx * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      return satOf(r, g, b) < 0.30 && lumOf(r, g, b) < 168 &&
             Math.hypot(r - matC[0], g - matC[1], b - matC[2]) < 72;
    };
    const isMat = new Uint8Array(W * H), mstack = [];
    const mseed = (idx) => { if (!isMat[idx] && matLike(idx)) { isMat[idx] = 1; mstack.push(idx); } };
    for (let x = 0; x < W; x++) { mseed((H - 1) * W + x); mseed((Math.floor(H * 0.93)) * W + x); }
    for (let y = Math.floor(H * 0.55); y < H; y++) { mseed(y * W); mseed(y * W + W - 1); }
    while (mstack.length) {
      const idx = mstack.pop(), x = idx % W, y = (idx / W) | 0;
      if (x > 0) mseed(idx - 1); if (x < W - 1) mseed(idx + 1);
      if (y > 0) mseed(idx - W); if (y < H - 1) mseed(idx + W);
    }
    for (let idx = 0; idx < W * H; idx++) if (isMat[idx]) outside[idx] = 1;  // fold mat into "transparent"
```

Then the EXISTING alpha-write loop (`~:118-124`, which sets `px[..3]=0` where `outside`, else opaque with a 1px feather) runs unchanged — it now erases cream AND mat. Keep `cx.putImageData(sd, 0, 0);`.

- [ ] **Step 2: Scan the figure silhouette (Cristina only, post-mat-removal)**

After `cx.putImageData(sd, 0, 0);`, insert the silhouette scan + contact anchor:

```js
    // figure silhouette = remaining opaque pixels (Cristina, mat gone). Anchor on her contact
    // (bottom-centre), normalise by height so all 15 share one contact line.
    let top = H, bottom = -1, minX = W, maxX = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!outside[idx]) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
    if (bottom < 0) return { ok: false, bg };
    const bandTop = bottom - Math.max(1, Math.round((bottom - top) * 0.10));
    let sumX = 0, nX = 0;
    for (let y = bandTop; y <= bottom; y++) for (let x = 0; x < W; x++) { const idx = y * W + x; if (!outside[idx]) { sumX += x; nX++; } }
    const contactX = nX ? sumX / nX : (minX + maxX) / 2;
    const contactY = bottom, figH = bottom - top;
    const conf = Math.max(0, Math.min(1, (figH / H - 0.45) / 0.5));
```

- [ ] **Step 3: Synthesize a soft ground shadow, then draw the figure on top**

Replace the transform block (`~:127-132`). The synthesized shadow = her cutout, recoloured ink-dark, squashed flat at the contact line, blurred, low alpha — drawn UNDER her:

```js
    const TARGET = window.__TARGET;   // {cx, bottomY, height} — see Step 4
    const s = TARGET.height / figH;
    const out = document.createElement('canvas'); out.width = OUT_W; out.height = OUT_H;
    const oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high';

    // her silhouette recoloured to ink-dark (for the shadow)
    const sh = document.createElement('canvas'); sh.width = W; sh.height = H;
    const shc = sh.getContext('2d');
    shc.drawImage(c, 0, 0); shc.globalCompositeOperation = 'source-in';
    shc.fillStyle = 'rgb(46,40,33)'; shc.fillRect(0, 0, W, H);

    // ground shadow: flattened (scaleY≈0.18) + blurred + faint, anchored at the contact line
    oc.save();
    oc.globalAlpha = 0.30; oc.filter = 'blur(16px)';
    oc.translate(TARGET.cx, TARGET.bottomY); oc.scale(s, s * 0.18); oc.translate(-contactX, -contactY);
    oc.drawImage(sh, 0, 0);
    oc.restore();

    // Cristina on top
    oc.save();
    oc.translate(TARGET.cx, TARGET.bottomY); oc.scale(s, s); oc.translate(-contactX, -contactY);
    oc.drawImage(c, 0, 0);
    oc.restore();
```

- [ ] **Step 4: Set `TARGET`, `OUT_DIR`, and pass `TARGET` into the page**

- Change `TARGET` (`tools/figbake.mjs:23`):
  ```js
  const TARGET = { cx: 700, bottomY: 1380, height: 1240 }; // contact centre + figure height in output
  ```
- The `page.evaluate(... , { src, OUT_W, OUT_H, TARGET })` call already passes `TARGET` in; inside the evaluate, the destructured `TARGET` is in scope — use it directly (drop the `window.__TARGET` placeholder in Step 3's first line; it was only a reminder). Confirm `TARGET` is in the evaluate's argument destructuring.
- Set `OUT_DIR = 'assets/figure'` (`tools/figbake.mjs:18`) so output lands where `home.html` loads it.

- [ ] **Step 5: Replace the debug overlay + return payload** (`~:135-144`)

```js
    const dbg = document.createElement('canvas'); dbg.width = OUT_W; dbg.height = OUT_H;
    const dc = dbg.getContext('2d'); dc.fillStyle = '#1b1b1b'; dc.fillRect(0, 0, OUT_W, OUT_H);
    const ds = Math.min(OUT_W / W, OUT_H / H); dc.save(); dc.scale(ds, ds); dc.drawImage(img, 0, 0); dc.restore();
    dc.lineWidth = 4; dc.strokeStyle = '#36d399';
    dc.strokeRect(minX * ds, top * ds, (maxX - minX) * ds, (bottom - top) * ds);
    dc.fillStyle = '#ff5a36'; dc.beginPath(); dc.arc(contactX * ds, contactY * ds, 7, 0, 7); dc.fill();
    return { ok: true, conf, contactX, contactY, figH, matC, s, bg, H, W,
      png: out.toDataURL('image/png'), debug: dbg.toDataURL('image/png') };
```
Update the success log (`~:152`): `console.log(\`✓ ${name}  conf=${res.conf.toFixed(2)} figH=${res.figH|0} cx=${res.contactX|0} matC=${res.matC.map(n=>n|0)} s=${res.s.toFixed(3)}${flag}\`);`

Also fix the input file discovery: source frames are `pose-NN.{png,jpeg}` and output must be `figure-N.png`. Map names so `pose-03` → `figure-3` (strip leading zero). The default `files` glob already picks up `tools/figsrc/*.{png,jpe?g}`; change the output `name` to `figure-${parseInt(basename.replace(/[^0-9]/g,''),10)}`.

- [ ] **Step 6: Bake + ITERATE on thresholds**

```bash
cd "/Users/at/Projects/site 2" && node tools/figbake.mjs
```
Expected: 15 `✓` lines → `assets/figure/figure-1..15.png` + `.debug.png`.
**This is the iteration loop.** Open several outputs and `.debug.png`. Tune ONLY these knobs and re-run until clean:
- Mat not fully removed (grey patches remain near her feet/between legs) → raise `matLike` luminance ceiling (168→180) or colour distance (72→90), or add a lower seed row.
- Part of HER removed (e.g. cream top, a foot) → tighten the same thresholds (she's being over-consumed): lower the luminance ceiling or distance.
- Shadow too heavy/light or detached → tune `globalAlpha` (0.30), `blur(16px)`, and the `s*0.18` squash.
Document the final threshold values in the report.

- [ ] **Step 7: Commit** (skip if no git repo)
```bash
git add tools/figbake.mjs assets/figure/figure-*.png && git commit -m "feat(figbake): lift Cristina off the mat + synthesize contact shadow"
```

---

### Task 7: Final integration — figures over the live mat; `home.html` cleanup

**Files:**
- Modify: `home.html` (`#matStage` retire on WebGL path; keep poster for `.is-static`)
- Verify: `js/home-journey.js` figure wiring already in place

**Interfaces:**
- Consumes: registered `assets/figure/figure-1..15.png` (Task 6), live morphing mesh mat (Task 3), calibrated `FIG_BOX` (Task 4).

- [ ] **Step 1: Keep `#matStage` only as the static poster**

`#matStage` (`home.html:97`) is hidden on the WebGL path by Task 3 Step 4. Confirm the `.is-static` fallback still shows a mat: the static path (`max-width:767px` / reduced-motion) hides `#homeCanvas` and should show `#matStage` + figure(s). Verify `home.html`'s `.is-static` CSS does not also hide `#matStage`. If the static poster needs the mat, leave `#matStage`'s `src` pointing at a flat poster mat (`assets/figure/mat-stage.png`) — the JS only sets `display:none` at runtime in WebGL mode, so static (which returns before that code) keeps the inline-styled PNG. No HTML change needed unless the static poster looks wrong.

- [ ] **Step 2: Full screenshot run**

```bash
cd "/Users/at/Projects/site 2" && node tools/matshot.mjs && node tools/morphtest.mjs
```

- [ ] **Step 3: Acceptance gate (R1 + R2)**

Open `tools/matshot/`:
- **R1** — `a-0.48` photoreal mat → `b-0.52` same-silhouette mid-morph → `c-0.56` flat watercolour. No second mat, no doubled edge at any frame. Reads as a transform.
- **R2** — `d-0.634` … `j-0.960`: exactly ONE mat (the mesh) under Cristina in every pose; her feet/hands rest on the surface with a soft contact shadow; spread poses (`g-0.797-dog`, `h-0.824-lunge`) stay on the mat; no shimmer / colour-shift / doubling between poses.
- `morphtest.mjs` exits 0; CONSOLE ERRORS: none.

- [ ] **Step 4: Static fallback check**

```bash
cd "/Users/at/Projects/site 2" && node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });   // mobile
  await p.goto("http://localhost:8000/home.html", { waitUntil: "networkidle" });
  await p.screenshot({ path: "tools/matshot/static-mobile.png", fullPage: false });
  await b.close();
})();'
```
Open `tools/matshot/static-mobile.png`: the static poster still shows a mat + figure, no broken layout.

- [ ] **Step 5: Commit** (skip if no git repo)
```bash
git add home.html && git commit -m "chore(home): retire PNG floor on WebGL path, keep static poster"
```

---

### Task 8: Cleanup + self-review

**Files:**
- Modify: `js/home-journey.js`, `tools/figbake.mjs` (remove dead code/comments)

- [ ] **Step 1: Remove dead references**
```bash
cd "/Users/at/Projects/site 2" && grep -nE "matStageFor|matStageStyle" js/home-journey.js
```
Expected: no matches (besides perhaps a comment). Remove any leftover. Update the stale comment block at `js/home-journey.js:65-67` and `:116-119` to describe the new "one mesh, morph in place; mat-free figures over it" model.

- [ ] **Step 2: Final syntax check**
```bash
cd "/Users/at/Projects/site 2" && node --check js/home-journey.js && node --check js/mat-core.js && node --check tools/figbake.mjs && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Re-run full verification**
```bash
cd "/Users/at/Projects/site 2" && node tools/morphtest.mjs && node tools/matshot.mjs
```
Expected: morphtest exit 0; matshot frames pass the Task 7 acceptance gate.

- [ ] **Step 4: Commit** (skip if no git repo)
```bash
git add -A && git commit -m "chore: tidy mat-transform comments and dead code"
```

---

## Self-review

**Spec coverage (against `docs/REPORT-mat-transform-problem.md`):**
- R1 (transform not transition) → Tasks 2–3: one mesh, one material, `uMorph` blends photoreal→flat watercolour on the identical silhouette. ✓
- R2 (exactly one mat) → Tasks 3–7: live mesh is the only mat (PNG floor retired), figures are mat-free, so doubling is structurally impossible. ✓
- Believable per-pose contact → Task 5 (baked soft contact shadow travels with each figure) + Task 4 (feet land on the surface, not the front lip). ✓
- Spread poses contained → Task 4 (mat rect contains footprint) + Task 5 (framed to fit). ✓
- "watercolour bloom at the moment of change" → Task 2 `uBloom` + Task 3 `bloomFor`. ✓
- Don't touch unroll/mood → untouched (`deformFor`, `MOODS`, `applyMood` unchanged). ✓
- Muted charcoal/taupe, never orange → Task 1 generation guard. ✓
- Mobile/reduced-motion poster → Task 7 Step 1 & Step 4. ✓
- Dependency-free (Three.js + Playwright only) → no new deps. ✓

**Open risks to watch during execution:**
1. `vMapUv` vs `vUv` depending on Three.js version (Task 2 note; caught by `morphtest.mjs` console-error check). The injected `saiaNoise` helper must sit above `main()` — it's prepended with the uniforms, so it does.
2. The flat-watercolour mix overrides scene lighting at `uMorph=1`, so the mood/lighting track no longer tints the mat after the hand-off — that is intended (the mat is now a flat painting) and the mood track still drives the background/scrim. Confirm the mat doesn't look detached from the room at `j-0.960`.
3. figbake silhouette registration assumes the soft shadow stays opaque after flood-fill; if a pose's shadow is too pale it may be matted out — bump the shadow darkness in regeneration, not the matte threshold (which would re-admit cream).
4. **Contact-shadow grounding:** the baked shadow is composited in normal blend over the live mat. If a pose reads "pasted on" rather than "pressed into," the cheapest fix is to set the figure layer's shadow region to `mix-blend-mode: multiply` so the shadow darkens the actual watercolour mat pixels. Try this only if Task 7's gate looks floaty — do NOT multiply the whole figure (it would darken her body too).
5. **Noise-reveal tuning:** the `vMapUv * 22.0` / `* 7.0` frequencies control blotch size of the paint bloom. If the reveal looks too speckly or too banded, adjust those two constants — they're the only knobs.
```
