# Design — `home.html` restructure: Pilates scroll, Gallery, Story page, mat-hire CTA

**Date:** 2026-06-27 · **Branch:** `mat-transform-single-mat` · **Scope:** `home.html` + new `story.html`

## Goal

Reshape `home.html` so the Cristina avatar scroll segment tells the **Pilates with Cristina**
story, the photo reel reads as the **Gallery**, the **Our Story** content moves to its own page,
the **Join** band becomes a **Pilates guest list**, and mat hire gets one **clear dedicated CTA
section**. Static, dependency-free, on-brand (Playfair Display + Inter; cream/ink/terracotta).

## Decisions (locked with user)

| # | Decision | Choice |
|---|---|---|
| 1 | Pilates in the avatar scroll | Re-theme the whole avatar segment to Pilates **and keep** the flat `#pilates` section |
| 2 | Mat-hire "clear part" | Keep pre-avatar bands 1–4 as the mat-hire story **+ add a new flat "Hire yoga mats" CTA section** near the estimator |
| 3 | Our Story | **Move to `story.html`**, remove from `home.html` entirely |
| 4 | Join band | **Pilates class guest list / waitlist** framing |
| 5 | Club & Community scroll bands | **Let them go** — replaced by Pilates bands; pillars survive via hero eyebrow, Gallery, footer |
| 6 | Photo reel | Re-label as **Gallery** (`#gallery`), update nav |

## Current → target page flow

```
PINNED SCROLL (#top, 2000vh)               PINNED SCROLL (#top)
  Bands 1–4  Mat hire story          →       Bands 1–4  Mat hire story        (UNCHANGED)
  Avatar L1  Mat hire                →       Avatar L1  Move with Cristina
  Avatar L2  The SAÏA Club           →       Avatar L2  The method
  Avatar L3  Move with Cristina      →       Avatar L3  NW3 & Hampstead
  Avatar L4  Community               →       Avatar L4  Breath-led / ethos
  Avatar L5  Join the Community      →       Avatar L5  Join the Pilates guest list
FLAT TAIL                                  FLAT TAIL
  Estimator                          →       Estimator                        (UNCHANGED)
  —                                  →       ➕ "Hire yoga mats" CTA section
  Photo reel  "In their words"#events →      Gallery  #gallery (re-labelled)
  Our Story   #story                 →       (removed → story.html)
  Pilates     #pilates (5 rules)     →       Pilates  #pilates (KEPT)
  In the press · Footer              →       In the press · Footer (links updated)
                                            NEW PAGE: story.html
```

## Components

### 1. Re-themed avatar scroll bands (`home.html`, the `[data-band]` divs ~L424–472)
Copy-only re-theme inside the existing band layout and `data-band` scroll ranges. No engine
change — `js/home-journey.js` band ranges, figure frames, and `bands()` fade logic stay as-is.

| Band | `data-band` (unchanged) | Eyebrow | Heading | Body |
|---|---|---|---|---|
| L1 | 0.576,0.66 | Fitness | Move with Cristina. | Founder-led Pilates for women, on the same mat you'll come to know by heart |
| L2 | 0.675,0.755 | The method | Strength from the inside out. | Classical method + Reformer; Joseph Pilates' Contrology; every level |
| L3 | 0.778,0.86 | Where | NW3 & Hampstead. | One-to-one in NW3, group classes in Hampstead |
| L4 | 0.882,0.955 | Why | Breath-led, for every body. | Built for every level; she meets you where you are |
| L5 | 0.972,1 | Join the Pilates guest list | Reserve your spot. | Waitlist email signup, Pilates-framed (keep `pointer-events:auto` input + button) |

Band copy is authored from the existing flat `#pilates` page copy plus `KB.pilates` — no invented
facts. The static bands are hard-coded HTML (not runtime-interpolated from KB), so "single source
of truth" applies to the *concierge*, not these literals; we mirror KB wording where it exists.
**Optional enrichment:** add the extra Pilates facts that currently live only in page copy
("Pilates for women", "Contrology", "every level", "meets you where you are") into `KB.pilates`
so the concierge can use them too. Nice-to-have, not blocking.

### 1a. Guest-list submission behaviour (RESOLVED — finding #1)
The L5 email input + button **have no handler today** (neither does the footer signup — all email
capture on `home.html` is currently decorative). There is no newsletter backend. Behaviour for the
new Pilates guest list:
- Add a small **inline client-side handler** (a few lines, no library, no network): validate the
  email, then swap the field for a confirmation line — *"You're on the Pilates guest list — Cristina
  will be in touch."* Empty/invalid email shows an inline error; `aria-live` announces both states.
- Explicitly a **front-end-only placeholder** until a real newsletter/concierge endpoint exists
  (parked, same status as the estimator's "Book the hire" CTA).
- Wrap the input + button in a `<form>` with `onsubmit` prevented, for keyboard/Enter support + a11y.
- *Alternatives considered:* WhatsApp deep-link (odd for a "list"), or the planner's
  `join_newsletter` action (unavailable here — `home.js` is the FAQ concierge, no planner actions).
- The footer signup stays decorative for now (out of scope); note it shares this gap.

### 2. NEW flat "Hire yoga mats" CTA section (`home.html`, tail, right after the estimator)
A clear, unmissable mat-hire block so hire has an obvious home now that the avatar scroll is
Pilates. Content: short headline, the core terms (£8.50/mat · 2-day · min 10 · same-day London
delivery), and a primary `data-hire-cta` button (reuses the existing hire-CTA wiring). On-brand
flat section consistent with the other tail sections. `id="hire"` consideration: footer already
uses `id="hire"`; the new section gets a distinct id (e.g. `id="mat-hire"`) and nav "Mat Hire"
points to it.

### 3. Gallery re-label (`home.html`, `#events` reel section ~L522) — RESOLVED finding #2
**Do NOT rename the id.** `#events` is targeted by ~40 CSS rules (L41–85) and
`getElementById('events')` in the inline reel engine (L655). Renaming would force a wide,
breakage-prone change. Instead:
- Keep `id="events"` on the section wrapper untouched (CSS + JS reel engine unchanged).
- Change only the **visible label**: section head text "In their words" → "Gallery" (and the "SAÏA
  women" eyebrow as desired); nav + mobile-drawer + footer link **text** "Events" → "Gallery",
  `href="#events"` unchanged.

This keeps the rename purely cosmetic. (A `#gallery` anchor is unnecessary; `#events` remains the
scroll target.)

### 4. `story.html` (new page) — RESOLVED finding #3
Full "A Woman Who Wins" story (the three paragraphs + attribution currently in `#story`), own page,
same fonts/palette/header/footer styling as `home.html`. Dependency-free. Remove `#story` from
`home.html`. Specifics so it doesn't inherit `home.html`'s assumptions:
- **Do NOT load `js/home.js`** — it assumes `#mobileDrawer`/`#navToggle`/concierge elements exist
  and would error on this page. Ship a **tiny inline drawer script** (open/close + close-on-link)
  for the mobile menu. No concierge chatbot on the story page.
- **Cross-page links:** the copied header/footer must point back with absolute home anchors —
  `home.html#mat-hire`, `home.html#pilates`, `home.html#events`, plus a clear **Home** link
  (`home.html` / logo → `home.html#top`). In-page links on story.html (if any) stay local.
- Typography: Playfair Display + Inter, matching `home.html` (see finding #4 resolution).

### 5. Nav + footer link updates (`home.html` desktop + mobile nav, footer)
- Desktop + mobile nav: `Mat Hire (#mat-hire) · Pilates (#pilates) · Gallery (href=#events) · Our Story (story.html)`.
- Footer "About us" links: Our Story → `story.html`; "Yoga mat hire" → `#mat-hire`; Events label → "Gallery" (`href="#events"`).
- Existing footer `id="hire"` stays on the footer; the new mat-hire CTA section uses `id="mat-hire"` to avoid collision (finding-safe).

### 6. Typography authority (RESOLVED — finding #4)
`home.html` already uses **Playfair Display + Inter**; `story.html` follows it for consistency.
`CLAUDE.md` was already corrected to a per-page font rule (home = Playfair/Inter; index/hero =
Cormorant/Hanken). `AGENTS.md` (the Codex mirror) still has the stale "Cormorant Garamond + Hanken
Grotesk … always" line (L72–73) — **update it to match `CLAUDE.md`** so the docs agree. No font
change to any page; this is a docs-consistency fix only.

## Deliverables (scope)
- `tools/lab/<name>.html` — side-by-side options for the 3 new visual pieces (CTA section, Pilates
  guest list, Gallery header). **Lab is an explicit deliverable**, built before live edits.
- `home.html` — re-themed avatar bands, new mat-hire CTA section, Gallery relabel, guest-list
  handler, `#story` removed, nav/footer link updates.
- `story.html` — new page + inline drawer script.
- `AGENTS.md` — one-line font-rule fix.
- (Optional) `js/saia-knowledge.js` — enrich `KB.pilates`.

## Out of scope / unchanged
- `js/home-journey.js` scroll engine, figure frames, mat handoff, `bands()` fade curve.
- The estimator spotlight stage, the concierge chatbot, `index.html`, `hero.html`.
- No new JS libraries (scroll stays custom vanilla — gsap/locomotive NOT used).
- Delivery numbers, prices, brand facts (single source = `js/saia-knowledge.js`).

## Workflow & verification
1. **Lab first** (per project handover rule): build `tools/lab/<name>.html` showing 2–3 options
   side-by-side for the **new visual pieces only** — the "Hire yoga mats" CTA section, the
   Pilates guest list, and the Gallery header. User picks before live edits.
2. Apply the chosen options + the copy-only scroll re-theme + `story.html` to live files.
3. **Verify in Chrome DevTools MCP**: screenshot home (desktop + mobile widths) through the
   scroll, the new CTA section, Gallery, guest list, and `story.html`. Run the
   `web-design-guidelines` review for a11y (semantic headings, alt text, contrast, focus, keyboard).

## Skills / MCP
| Tool | Use |
|---|---|
| `frontend-design` | Design the new CTA section, guest list, gallery header |
| `ui-ux-pro-max` | Layout/spacing/type + lab option patterns |
| `web-design-guidelines` | A11y/UX review before "done" |
| Chrome DevTools MCP | Screenshot-verify lab + live, desktop + mobile |
| Higgsfield MCP (parked) | Only if a new Cristina Pilates pose/frame is wanted later |

## Risks
- **Anchor breakage:** `#story` is referenced by nav x2 + footer; update/remove every reference.
  `#events` id is **kept** (only labels change) to avoid touching ~40 CSS rules + the reel JS.
  Grep before and after.
- **Pillar loss:** Club/Community dedicated bands removed by design (user-approved); ensure hero
  eyebrow + Gallery + footer still carry "Fitness · Community · Mindset".
- **`#hire` collision:** footer already owns `id="hire"`; new mat-hire section uses `id="mat-hire"`.
- **story.html JS:** must NOT load `home.js` (assumes drawer + concierge elements); ship inline drawer.
- **Decorative signups:** the new guest-list handler is front-end-only (no backend); footer signup
  remains decorative — both parked until a newsletter endpoint exists.
