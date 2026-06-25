# SAÏA — "In their words" photo reel (film-strip, minimal rails)

**Date:** 2026-06-25
**Scope:** Replace the testimonial section on `home.html` with a scroll-scrubbed photo reel.

## Goal
Replace the `#events` "In their words." testimonial cards with a horizontal,
scroll-driven photo reel of real SAÏA event photography — a slow "film roll" framed
by 35mm sprocket-hole rails — that feels modern, editorial and on-brand.

## Decisions (locked via 4 rounds of live prototyping)
- **Motion:** H1 "cinematic drift reel" — section pins, photos glide horizontally as you
  scroll, smoothed (lerp) so it never races. Each photo has a gentle Ken-Burns zoom.
- **Focus bloom:** off-centre photos are smaller, lower, blurred and **grayscale**; the
  centred photo rises, sharpens and **blooms into full colour**.
- **Environment:** **minimal film rails** — two perforation rails (ink, on the cream page)
  along the top & bottom that translate in lockstep with the photos. No dark band, no arch.
- **Hover:** photo lifts, grows, sharpens, tilts toward the cursor, shows a small value chip.
- **Captions:** italic Cormorant lines crossfade as you scroll (`A Woman Who Wins.` etc.).

## Placement
`home.html`, the `id="events"` section (currently lines ~266–291), between the pinned
watercolour hero and the "In the press" strip. Keep `id="events"` so the footer nav anchor
still resolves.

## Implementation
- **One file** (`home.html`): scoped `<style>` block under `#events`, replacement section
  markup, and one self-contained inline `<script>`. No new dependencies, no new fonts
  (Cormorant Garamond + Libre Baskerville already loaded).
- **Structure:** `.rl-scroll` (460vh) → sticky `.rl-sticky` (100vh) containing the cream
  background, `.film-rails` (top/bottom `.perf-row`), heading, `.caps`, and `.rl-track`
  (the `figure` photos). Perforations are a CSS mask tile translated with the film.
- **JS:** builds figures + captions, runs one rAF loop computing each photo's distance from
  viewport centre → scale / opacity / blur / grayscale; translates track + rails by the same
  `filmX`; crossfades captions; handles hover.

## Content
- **Photos:** 12 curated real event JPEGs from `/photos`.
- **Words:** existing SAÏA brand lines (no new testimonials lost — the section was already
  being replaced at the user's request).
- **Hover chips:** rotating SAÏA value words (Community, Movement, Strength, Stillness,
  Together, Mindset) — abstract, so no photo is mislabelled.

## Accessibility / fallback
- All photos carry `alt` text.
- `@media (prefers-reduced-motion: reduce)`: un-pin → static centred grid, full colour, no
  transforms, rails hidden.
- `@media (max-width:767px)`: wider tiles (64vw), shorter scroll track.

## Out of scope (parked)
- Downloading/importing all saialondon.com page content (separate, larger task).
- Real per-photo event/location captions (using value words for now).
