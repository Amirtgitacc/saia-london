# Home v2 — Concierge integration + scroll/estimator/map redesign

**Date:** 2026-06-27
**Page:** `home.html` (the live GitHub Pages home; the `gh-pages` branch)
**Status:** Approved design, ready for implementation plan.

> Hand this spec to a fresh session. It is self-contained. Read `CLAUDE.md` and
> `docs/HANDOVER-home-redesign.md` first for the current home design state.

---

## 1. Goal

Make `home.html` read unmistakably as a **scroll experience** that **converts through a
concierge**. Eight changes, grouped into four build phases. The biggest is turning the
home concierge from a dumb FAQ into the real agentic brain, woven into the page.

## 2. Locked decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Concierge model | **Inline designed-in block + smart floating launcher**, one shared brain |
| Estimator | **Restyle it** (themed, animated) **+ hand off** its result to the concierge |
| Checkout depth | **Mockup confirmation only** — no real payment yet (placeholder link + "Confirmed") |
| Footer / contact | **Remove WhatsApp Cristina from footer, keep "A Woman Who Wins."** Studio + contact CTAs open the concierge; one subtle WhatsApp line lives *inside* the concierge |

## 3. Current state (what exists today)

- **`home.html`** pinned 3D journey with bands, then sections. Key landmarks:
  - Bands 1–4 inside the pinned journey (`~line 400–485`): Hero, Open-mat+specs, How-hire-works,
    "For every gathering" (3 cards: Studios / Events / Brand — each already has a
    `data-hire-cta` button).
  - Flow levels 1–5 (`~line 487–530`): Pilates intro / method / **NW3 & Hampstead (level 3)** /
    why / guest list.
  - **Estimate stage** `section.saia-est-stage` (`~line 550`) — the dark "spotlight" estimator.
  - **`#mat-hire`** "Hire yoga mats for your event" CTA section (`~line 588`) — **REDUNDANT, to remove.**
  - Gallery `#events` (`~line 605`), Pilates `#pilates` (`~line 619`), Press (`~line 641`),
    Footer `#hire` (`~line 657`), Concierge launcher (Option B, `~line 694`).
  - Mobile journey `#mobileJourney` (`~line 356`) filled by `js/home-mobile-journey.js` (≤767px).
- **`js/home.js`** — nav drawer + the **simple FAQ concierge** (`reply()` keyword matcher,
  `askAssist()` escalation, `startHire()`, `data-hire-cta` wiring). No hire basket, no actions.
- **`js/planner.js`** — the **real agentic brain**, already built and used by index/hero:
  - `localPlan(text) → {say, actions, matched}` (Tier 1 scripted brain)
  - `applyActions(hireState, actions) → {hire, acts}` (deterministic booking executor, 11 tools)
  - exposed at `window.SAIA.Planner`.
- **`js/concierge-ui.js`** — agentic concierge UI used by index/hero (Cormorant styling, has a
  hire panel). Reference only; home gets its own UI to match its Playfair/cream look.
- **`js/saia-knowledge.js`** — single source of truth (facts + `factSheet`). Unchanged.
- **`server.js`** — Tier-2 `/api/concierge` safety net (Claude Haiku). Unchanged.

## 4. Files touched

```
home.html               markup: remove #mat-hire; add inline concierge section in its place;
                        add hire CTAs into bands 1–3; restyle estimator + top hero; add map slot
                        in NW3 band; bolder scroll cue; footer edit.
js/home.js              keep nav drawer + extend startHire(); DELETE the FAQ reply()/askAssist().
js/home-concierge.js    NEW. Agentic concierge UI for home (inline block + launcher, one brain).
js/planner.js           REUSE unchanged (home now shares localPlan + applyActions).
js/saia-knowledge.js    unchanged.
server.js               unchanged.
tools/lab/maps.html     NEW throwaway lab: 3–4 animated map directions side by side.
```

No change to the single-source-of-truth or the Tier-2 endpoint. The concierge brain is reused,
not rewritten — only the home UI layer is new.

---

## 5. Feature specs

### 5.1 Concierge — two surfaces, one brain (Phase 4, the big one)

**Brain:** home uses `window.SAIA.Planner.localPlan()` first; on `matched:false` it escalates to
`POST /api/concierge` (same as today's `askAssist`); either way the returned `actions` run through
`window.SAIA.Planner.applyActions()` to update a live **hire basket**. This is exactly the
index/hero pipeline, brought to home.

**Surface A — inline block** (new designed-in section, placed where `#mat-hire` is removed, directly
below the estimator so "estimate → book" flows downward):
- Opens with an **intent guess + choice chips**, not a blank box:
  `[ Hosting ~30 ]  [ I run a studio ]  [ Just browsing ]`
- On engagement it expands into: conversation thread + **live hire basket** showing
  `mats · hire length · running total` and a `to checkout →` affordance.
- Styled in home palette (cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`, Playfair + Inter).

**Surface B — floating launcher** (the existing Option B launcher, kept) now runs the **same**
`home-concierge.js` brain and basket. Inline block and launcher share state.

**Entry modes** (`home-concierge.js` exposes `SAIA.startHire(opts)`):
| Trigger | Mode | Seed behavior |
|---------|------|---------------|
| Any `data-hire-cta` button (bands, hero) | `hire` | open pre-seeded, ready to take a count → quote |
| `data-hire-cta="studio"` button | `studio` | enquiry mode: collect studio name, dates, mat count |
| Estimator "Book this with the concierge →" | `estimate` | seed postcode/zone/mats from the estimate |
| Launcher click (cold) | `default` | show intent chips |

**Conversion path** (mockup): guest count → `recommend` mats → `quote` → user says/clicks checkout →
`checkout` (placeholder "secure checkout link ready") → `confirm` ("Confirmed. Welcome to SAÏA.").
All of this math already exists in `applyActions`; no new booking logic.

**Contact:** one subtle "or WhatsApp Cristina" line inside the concierge (studio/contact context only).
Not in the footer.

**Acceptance:**
- Clicking any band Hire button opens the concierge already in hire mode (no cold blank panel).
- A first-time visitor sees intent chips, picks one, and can reach a "Confirmed" mockup without
  typing a free-form sentence if they use chips/answers.
- The estimator's book button lands the user in the concierge with the estimate context carried in.
- Inline block and floating launcher never show contradictory baskets (shared state).

### 5.2 Estimator redesign (Phase 2)

Keep the function (postcode → London zone → mat math → "from £X"), change the feel.

| Now | After |
|-----|-------|
| Dark dry template, feels like another site | Themed cream/ink/terracotta, **fade + rise in** on scroll |
| Nothing marks it as an estimate | Clear **"ESTIMATE"** treatment framed on the border |
| Static | Background **boxes** + a **car drives across** on entry → reads as *delivery* |
| Dead end | **"Book this with the concierge →"** hands off to 5.1 (mode `estimate`) |

**Acceptance:** scrolling into the section triggers the entrance animation once; the word ESTIMATE is
unmistakable on the frame; the car/boxes motion plays; the book button opens the concierge seeded.

### 5.3 Map — NW3 & Hampstead (Phase 3, you choose the style)

Build `tools/lab/maps.html` with **4 animated directions**, all dependency-free, all in palette:

1. **Ink line-art** — roads/Heath outline self-draw in.
2. **Tube-map geometric** — dots + connector lines, transit feel.
3. **Topographic** — contour rings around an NW3 marker.
4. **Hand-drawn** — sketchy warm linework matching the watercolour theme.

Each: simplified North-London / NW3, a marker pin on NW3/Hampstead, self-drawing lines, subtle
idle motion. User picks one; integrate the chosen one into **Flow Level 3** (the "NW3 & Hampstead"
Pilates band). Lab page is throwaway (under `tools/`, not shipped to Pages).

**Acceptance:** lab shows 4 side by side; chosen map sits in the NW3 band, animates on view, themed.

### 5.4 Remove redundant section (Phase 1)

Delete the `#mat-hire` "Hire yoga mats for your event" section (`~line 588`). Mat hire is already
covered by bands 1–4 above and the estimator. Its slot becomes the **inline concierge block** (5.1).

### 5.5 Hire CTAs everywhere (Phase 1)

- Add a **bold, persistent "Hire a mat"** CTA through the **opening bands** (3D-roll hero, the
  open-mat/specs band, the how-hire-works band) — not only in band 4's cards.
- Add a quieter **studio variant** ("Run a studio? Talk to us", `data-hire-cta="studio"`).
- All CTAs route into the concierge per 5.1. Keep existing band-4 card buttons; restyle for
  consistency, don't remove them.

**Acceptance:** every opening band has a visible Hire affordance; studio variant opens studio mode.

### 5.6 Footer (Phase 1)

- **Remove** the "WhatsApp Cristina" contact element from the footer.
- **Keep** "A Woman Who Wins."
- Footer hire button continues to open the concierge.

### 5.7 Bolder scroll cue (Phase 1)

Replace the current subtle scroll hint on entry with a **bolder animated affordance** (e.g. an
animated arrow/line + motion) that clearly signals the page scrolls. Respect
`prefers-reduced-motion`.

### 5.8 Top hero polish (Phase 1)

Elevate the entry hero ("Yoga mat hire across London"): refine type scale, spacing, and add a soft
**entrance animation**. Content/copy stays (already humanized); this is a design lift only. Per
`CLAUDE.md`, do not remove existing elements.

---

## 6. Phasing (becomes the implementation plan)

1. **Phase 1 — Cleanup + CTAs + hero + scroll cue + footer.** Low risk, fast. (5.4–5.8)
2. **Phase 2 — Estimator redesign** + concierge handoff hook. (5.2)
3. **Phase 3 — Map lab → pick → integrate.** (5.3)
4. **Phase 4 — Concierge upgrade** (inline block + smart launcher + flow). (5.1)

Each phase ships independently and is verifiable in the browser before the next.

## 7. Out of scope (explicit)

- Real payments / live Shopify or Stripe checkout (mockup only this round).
- Live Addison Lee courier API (estimator stays the dependency-free zone estimate).
- index.html / hero.html (their concierge stays as-is; only home.html changes).
- Any change to `saia-knowledge.js` facts or `server.js` scope/voice.
- Farsi / RTL / i18n (English-only project).

## 8. Constraints / brand rules (must hold)

- Mats are **HIRE ONLY** — never "buy"/"for sale". £8.50/mat, 2-day, min 10.
- Palette cream `#F5F1E8` / ink `#2B2620` / terracotta `#B8624A`; home fonts Playfair + Inter.
- Voice: warm, female-led, British English. No em/en dashes in any new copy (humanizer rule).
- Accessibility: semantic HTML, aria-labels, alt text, keyboard nav, focus rings,
  `prefers-reduced-motion` on all new animation.
- Dependency-free front end; one tiny Node endpoint only.

## 9. Verify (per phase)

```bash
# terminal A — concierge endpoint (Tier 2)
npm start
# terminal B — static site
python3 -m http.server 8000   # open http://localhost:8000/home.html
```
- Phase 1: `#mat-hire` gone, Hire buttons in every opening band, footer has no WhatsApp but keeps
  "A Woman Who Wins", scroll cue is obvious, hero animates in.
- Phase 2: estimator fades in, shows ESTIMATE + car/boxes, book button opens concierge seeded.
- Phase 3: `tools/lab/maps.html` shows 4 directions; chosen map animates in the NW3 band.
- Phase 4: any Hire button opens the smart concierge; chips → quote → mockup "Confirmed".
