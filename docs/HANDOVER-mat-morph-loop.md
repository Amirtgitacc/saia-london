# HANDOVER — Mat morph + Cristina-on-the-mat, iterate-until-perfect loop

Paste this whole file as the task prompt. It is self-contained. Use `/loop` so you keep
iterating until the acceptance rubric passes.

---

## What you're fixing

`home.html` (SAÏA London) has a pinned scroll journey: a real 3D mat unrolls, then hands off to
a flat watercolour scene where the founder Cristina flows through 15 yoga/Pilates poses. Two
defects:

1. The mat **fades into a different mat** instead of transforming in place.
2. Cristina is **beside the mat, not on it** (spread poses overflow it too).

**Read first, do not skip:**
- `docs/superpowers/specs/2026-06-22-mat-morph-and-on-mat-figures-design.md` — the approved design.
- `.claude/projects/.../memory/cristina-figure-pipeline.md` (the Cristina pipeline memory) —
  Higgsfield recipe, reference IDs, identity-gate gotchas. If you can't find it, the recipe is
  also summarised in the spec.
- `js/home-journey.js`, `home.html` (lines ~88–120), `tools/matshot.mjs`, `tools/figposes.mjs`.

**Approved approach (do NOT relitigate):**
- Morph = **in-place** (A): land the 3D mat on the watercolour PNG's exact screen rect, crossfade
  + a **subtle** paint bloom.
- On-the-mat = **generated per-pose (D)**: generate each pose ON a locked-reference hero mat,
  then register every frame's mat to one fixed on-screen position via a build tool so it's
  beautiful AND shimmer-free.
- Credits are not a constraint. Optimise for the most beautiful, smooth result.

## Brand guardrails (never break these)

- Mats are **HIRE ONLY** — never "buy". Voice: warm, female-led, British English, English-only.
- Palette: cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`. The mat is the muted
  charcoal/taupe + faint terracotta signature mat (NOT saturated orange — it clashes with her
  terracotta leggings).
- Don't remove existing UI elements. Don't touch the 3D unroll (p0→0.22) or the mood track.
- Cristina must stay recognisable; use SOFT identity phrasing ("keep her recognisable…") —
  emphatic "THIS EXACT person" makes Higgsfield jobs stall/fail.

## Setup each session

```bash
# terminal A
npm start
# terminal B
python3 -m http.server 8000
```
Verify renders come from `node tools/matshot.mjs` (writes to `tools/matshot/*.png`).

## The loop

Repeat until the **acceptance rubric** below scores PASS on every line, or you've done 6 rounds
(then stop and report what's still failing + your best hypothesis).

```
┌─ 1. GENERATE ────────────────────────────────────────────────┐
│  • Hero mat (once, reuse after): Higgsfield nano_banana_pro,   │
│    3/4 angle, muted charcoal/taupe + faint terracotta, no ref  │
│    photos → remove_background → autocrop → assets/figure/      │
│    mat-stage.png. This is morph target + reference + template. │
│  • Each pose: generate Cristina ON the hero mat (feed hero mat │
│    as a locked reference image + portrait/stand refs). Prompt  │
│    real contact: weight on feet/hands, soft contact shadow on  │
│    the mat. Resubmit any dropped/stalled job.                  │
└───────────────────────────────────────────────────────────────┘
┌─ 2. BUILD (tools/figbake.mjs — create it if missing) ─────────┐
│  • Detect the mat region in each generated frame.             │
│  • Compute translate/scale to align it to the hero mat's      │
│    fixed rect; apply; export assets/figure/figure-1..15.png.  │
│  • Log per-frame registration confidence; flag low ones.      │
│  • Back up current assets to tools/figbak/ before overwrite.  │
└───────────────────────────────────────────────────────────────┘
┌─ 3. WIRE (js/home-journey.js, home.html) ─────────────────────┐
│  • Retune camera `frames` near p0.50 so the 3D mat lands on    │
│    the PNG rect. Add subtle bloom (blur+saturate pulse on      │
│    #matStage during p0.50→0.56). Ensure both mats are never    │
│    visible at once. Re-verify FIG[] foot/h/x.                  │
└───────────────────────────────────────────────────────────────┘
┌─ 4. RENDER & SELF-CRITIQUE ───────────────────────────────────┐
│  • node tools/matshot.mjs                                      │
│  • Open every tools/matshot/*.png with the Read tool and look. │
│  • Score against the rubric. Write the score + what's wrong.   │
└───────────────────────────────────────────────────────────────┘
┌─ 5. DECIDE ───────────────────────────────────────────────────┐
│  • All PASS → done, summarise. Any FAIL → identify the single  │
│    biggest cause, change ONE thing, loop. If a fix attempt     │
│    already failed, do NOT try a variation — reassess from      │
│    first principles (regen asset vs. adjust transform vs.      │
│    adjust camera).                                             │
└───────────────────────────────────────────────────────────────┘
```

## Acceptance rubric (score each PASS/FAIL every round, with a one-line reason)

**Morph (frames a-0.48 / b-0.52 / c-0.56):**
1. At b-0.52 the 3D mat and the watercolour mat occupy the **same screen rect** — no positional
   jump, no second mat appearing elsewhere.
2. The transition reads as the mat **turning into** watercolour (bloom present but subtle — not
   a hard flash, not an obvious crossfade of two offset shapes).
3. No moment shows **two mats** or **zero mats**.

**On the mat (frames d-stand / e-heart / f-hinge / g-dog / h-lunge / i-seated / j-close):**
4. Her contact points (feet, and hands where relevant) rest **on the mat surface** — not on the
   front lip, not floating, not off the side.
5. **Spread poses (g-dog, h-lunge)** are fully contained on the mat.
6. There is a believable **contact shadow / weight** — she looks like she's using the mat.

**Smoothness & polish:**
7. The mat does **not move, shimmer, or change colour** between consecutive poses (compare
   d→e→f→… ; the mat region should look static).
8. Cristina stays **recognisable and on-style** (watercolour, terracotta leggings, cream top);
   no warped anatomy, no baked-in second mat, no saturated-orange mat.
9. `matshot.mjs` reports **CONSOLE ERRORS: none**.

A round is "perfect" only when 1–9 are all PASS. If you're unsure on a visual line, it's a FAIL —
describe exactly what looks off so the next round can target it.

## Tools you have

- **Higgsfield MCP** (generate_image, generate_3d, remove_background, upscale_image, etc.) for
  all asset generation. Use the pipeline-memory recipe and reference IDs.
- **Read tool** renders PNGs visually — use it to actually look at every `tools/matshot/*.png`.
- **tools/matshot.mjs** for handoff + pose frames; **tools/figposes.mjs** for the pose flow.

## When you finish

State plainly: which rubric lines pass, what assets/files changed, and the one verify command
(`node tools/matshot.mjs`). If you stopped at 6 rounds without full PASS, list the remaining
failures and your best next hypothesis — do not claim it's perfect if it isn't.
