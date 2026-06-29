# Cristina avatar → 5 anchor stills (restyle)

**Date:** 2026-06-29
**Goal:** Regenerate the 5 yoga anchor poses to match the uploaded Cristina avatar *exactly*
(face, top-bun-with-front-braid, dusty-rose thin-strap cami crop, light greige high-waist
leggings, gold necklace, barefoot, smooth cel-shaded illustration style). **Stills only** —
no flow video, no `index.html` changes — so the look can be approved before any flow rebuild.

Source avatar: `/Users/at/Downloads/Gemini_Generated_Image_icnql7icnql7icnq.png`
(standing namaste, black bg, cream watercolour contact puddle).

## Decisions (confirmed with user)

- **Scope:** anchor stills only; gate before flow rebuild.
- **Fidelity:** match the avatar exactly.
- **Style shift:** YES — restyle the character to this cel-shaded avatar look (a departure
  from the current hand-painted watercolour-and-ink flow figures). An eventual flow rebuild
  would adopt this style.
- **STAND pose:** namaste / prayer hands, like the source avatar.

## Why NOT the old Soul→watercolour pipeline

The existing pipeline (`cristina-figure-pipeline` memory) turns *real photos* into watercolour
via a trained Higgsfield Soul (photoreal-only, needs 5–20 photos). Here we already have the
finished target look, so training a Soul would lose this exact cel style. Wrong tool for
"match exactly." Instead, treat the avatar as a single-image reusable character.

## Approach

1. **Upload** the avatar (`media_upload` → PUT bytes → `media_confirm`).
2. **Register as an Element** (`show_reference_elements action:create`, category `character`)
   so it can be injected as a named, consistent character across generations.
3. **Generate 5 poses** with `nano_banana_pro`, embedding `<<<element_id>>>` in each prompt and
   locking face / hair (top bun + front braid) / outfit (dusty-rose cami + greige leggings) /
   gold necklace / barefoot / cel-shaded style / flat plain background + soft contact shadow /
   full body head-to-toe with margin.
4. **Background-remove + autocrop** each (`remove_background` → alpha bbox, zero alpha<24 to
   drop halos) → save as transparent PNGs.

### The 5 poses

| Anchor | Pose |
|--------|------|
| STAND  | Standing tall, namaste / prayer hands at chest (like the avatar) |
| REACH  | Standing, both arms reaching straight up overhead |
| DOG    | Downward-facing dog, head hanging straight down (not tilted) |
| LUNGE  | Low lunge, front knee bent, hands resting on front knee / reaching |
| SEATED | Seated cross-legged, hands resting on knees, tall spine |

## Output

`tools/figsrc/avatar-anchors/{stand,reach,dog,lunge,seated}.png` — transparent cutouts for
side-by-side review. Also keep the raw (pre-cutout) generations alongside for reference.

## Out of scope (this pass)

- No video clips, no 303-frame flow assembly, no `assets/flow-frames/` changes.
- No `index.html` / `js/home-journey.js` edits.
- These follow only after the user approves the still look.

## Verify

Open the 5 cutouts side-by-side; confirm face/outfit/hair/style match the avatar and poses are
clean (esp. dog head-down, full body in frame).
