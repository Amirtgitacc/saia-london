# Handover — SAÏA `index.html` scroll-flow redesign

Paste the prompt below into a fresh session to continue.

---

You are continuing a redesign of **`index.html`** for SAÏA London (static, dependency-free
site; mat hire is the priority). Read `CLAUDE.md` first — it has the brand rules, the
concierge architecture, and a "Delivery (Addison Lee)" section. Last commit on branch
`mat-transform-single-mat`: `f05fa7e`.

## How I want you to work (IMPORTANT)
- **Always show me options as visuals in a lab before changing the real page.** Build a
  standalone HTML lab under `tools/lab/` that renders 2–4 versions **side-by-side** (or a
  global switcher), each replayable, against a representative backdrop. I pick, then you apply.
  This is the established pattern — keep using it for every design decision.
- **Use real UX/UI skill and taste** — invoke the `frontend-design` / `ui-ux-pro-max` /
  `web-design-guidelines` skills. Distinctive, production-grade, on-brand; not generic. Always
  verify in the browser (Chrome DevTools MCP) with a screenshot before telling me it's done.
- Keep responses short; lead with a recommendation; use tables/visuals to compare options.
- Brand: cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`. Mats are **HIRE ONLY**. English only.

## Run / verify
```
npm start                      # concierge endpoint :8787 (optional)
python3 -m http.server 8000    # then open http://localhost:8000/
```
Labs: `http://localhost:8000/tools/lab/<name>.html`

## Decisions LOCKED + APPLIED to live `index.html` ✅
All of the below are now LIVE on `index.html` (not just in labs):
| Thing | Choice | Status |
|---|---|---|
| Font (site-wide) | **Playfair Display · Inter** | ✅ applied (index.html) |
| Hero | **Left · classic** | ✅ live |
| Signature mat | **Pill chips** | ✅ live |
| Hiring effortless (Section 3) | **Vertical list + "Van-on-a-road"** scroll animation | ✅ applied — scroll-scrubbed in `js/home-journey.js` (`driveHireRoad`); road finishes by p0.38 so the van reaches "Collect" while the copy is still sharp |
| Section 4 "Hire the range" | **B · Featured tier** (Events & retreats card lifted, terracotta border, "Most booked" badge) | ✅ applied (`.s4grid`/`.s4card.feat`) |
| Delivery/hire estimator | **B · Spotlight stage** — dark interrupt, self-drawing route, van drives in, total counts up | ✅ applied as standalone `.saia-est-stage` section right after the pinned journey; scoped CSS + engine; ported from `tools/lab/estimator-lab.html` |
| Copy fix | "same-week" → **same-day** | ✅ applied |

### Scroll-band fade tuning (`bands()` in `js/home-journey.js`)
Reworked from the old symmetric blur-settle to **"crisp almost the whole way"**: tiny snap-in
window (`fin`), full-resolution hold across ~70% of each band, brief soft fade at the very edges,
with blur **decoupled** from opacity (heavy focus-in blur, gentle ≤~1.5px on exit so copy stays
readable as it leaves). Tunables: `fin = min(0.012, w*0.09)`, `fout = min(0.03, w*0.22)`.

Already LIVE from earlier rounds: the 5 over-Cristina flow bands use
**margin-rail + scrim-free + blur-settle** (now the same crisp-hold curve above).

## Labs that exist
- `content-lab.html`, `content-lab-r2.html` — placement + reveal (decided: rail + blur, live)
- `sections-lab.html` — font switcher + Hero / Signature-mat / Hiring layouts
- `process-lab.html` — Section-3 process animations (decided: Van-on-a-road)
- `range-lab.html` — Section-4 "Hire the range" tiers (A Refined cards / B Featured / C Rows / D Bento)
- `delivery-estimator.html` — locked; embeddable `.saia-estimator` component

## DONE ✅ (this round)
1. ~~Pick Section 4 layout~~ → **B Featured tier** chosen + applied.
2. ~~Apply all decisions to live `index.html`~~ → Playfair/Inter, hero left-classic, pill-chips,
   scroll-scrubbed van-on-a-road, Section 4 featured tier — all live.
3. ~~Embed the delivery estimator~~ → **B Spotlight stage** embedded as `.saia-est-stage`.
4. ~~Copy fix same-week → same-day~~ → done.

## OPEN — do next
- Ground remaining tier copy in real facts (below); keep Brand Partnerships (it IS on the real site).
- Fonts were scoped to `index.html` only — the sample pages (`samples.html`, `sample-film.html`,
  `sample-hybrid.html`) still on the old Cormorant/Hanken families if site-wide consistency is
  wanted later. (The old `hero.html` / agentic `index.html` front end has since been removed and
  `home.html` renamed to `index.html` as the site root.)
- Estimator delivery numbers are still the LOW placeholder (Central £35 / Greater £45) — swap for
  **Route B** (live Addison Lee Quickbook API) when SAÏA opens a business account.
- Wire the estimator "Book the hire" CTA (currently a prefilled WhatsApp deep-link) to real
  Shopify/Stripe checkout when payment is set up.

## Parked (documented in CLAUDE.md)
- **Route B** — live Addison Lee Quickbook API for real delivery quotes (needs SAÏA business account).
- **Payment** — wire the estimator's "Book the hire" button to Shopify checkout or a Stripe link.

## Verified facts (from saialondon.com — use these, don't invent)
£8.50/mat · 2-day base · +£1.50/mat per extra day · min 10 · 60+ = reduced quote · mat is
black, 68×185×4mm, natural-rubber + PU, non-slip/anti-odour, retail £79 (hire only) · delivery
by **Addison Lee** (NW3 → event; pickup from NW3 free) · WhatsApp Cristina 07444 611 914 ·
Pilates 1-2-1 NW3 + group Hampstead, Classical + Reformer · founder Cristina (English/Mexican),
started 2020, Brunch Club origin · Fitness · Community · Mindset. Estimator delivery numbers are
a deliberately LOW placeholder (Central from £35, Greater London from £45).

Recommended first move: ask me to pick Section 4 in `range-lab.html`, then do one focused
apply-to-live build so I can see the whole redesigned page for real.
