# SAÏA — Full move to Shopify (faithful port)

**Date:** 2026-07-16
**Status:** Approved design
**Decision owner:** Amir

## Goal

Replace the live saialondon.com Shopify theme with this redesigned site (the Vercel
static site in this repo), built and deployed via Shopify CLI, and turn mat hire from
an info page into a real Shopify checkout. Design fidelity is the priority: pages are
ported nearly verbatim (Approach A), not rebuilt as editor-friendly sections.

## Decisions made

| Decision | Choice |
|---|---|
| Scope | Full move: all pages hosted on Shopify |
| Theme style | A · Faithful port — Liquid templates wrap the existing HTML/CSS/JS; pixel-identical |
| Store | Existing live store behind saialondon.com; access via **Shopify CLI** |
| Concierge Tier 2 | **Stays on Vercel** (`api/concierge`); Shopify site calls it cross-origin (CORS already `*`); Claude key never touches Shopify |
| Checkout | Real Shopify cart via **cart permalink** built from `applyActions()` output |
| Delivery fee | **Not charged at checkout.** Order charges mats + extra days only; delivery shown as "confirmed by Cristina", invoiced separately (estimator stays estimate-only) |
| Publish gate | All work lands on an **unpublished draft theme**; only Amir publishes |

## Theme structure

From-scratch custom theme (no Dawn base):

```
saia-theme/
├─ layout/theme.liquid          shared <head> (fonts, palette, meta), body wrapper
├─ templates/
│   ├─ index.liquid             ← index.html (3D journey, estimator, concierge)
│   ├─ page.events.liquid       ← events.html
│   ├─ page.story.liquid        ← story.html
│   ├─ page.pilates.liquid      ← pilates-with-cristina.html
│   ├─ page.contact.liquid      ← contact-us.html
│   ├─ page.guest-list.liquid   ← guest-list.html
│   ├─ page.terms.liquid        ← terms-and-conditions.html
│   ├─ page.event-*.liquid      ← 5 individual event pages
│   ├─ product.liquid           minimal — hire products exist but aren't browsed
│   ├─ cart.liquid              ← replaces demo checkout.html summary view
│   └─ 404.liquid
├─ assets/                      css/, js/, small images, GLBs (≤10 MB per file)
├─ config/settings_schema.json  theme settings (concierge endpoint URL, contact details)
└─ snippets/                    shared nav/footer extracted from the pages
```

- Each `page.*.liquid` template needs a matching Page created once in Shopify admin
  (Online Store → Pages) and assigned to it. One-time manual step, documented in the plan.
- **Asset rule:** files ≤10 MB → theme `assets/`; larger media (`flow.mp4` 28 MB, large
  photos) → **Shopify Files** CDN, referenced by absolute URL. Only assets actually
  referenced by the ported pages are uploaded (repo `photos/` is 232 MB, mostly unused).
- All local paths (`js/…`, `css/…`, `assets/…`) are rewritten to
  `{{ '…' | asset_url }}` (or the Files CDN URL). Mechanical rewrite; JS logic unchanged.
- The `index.html` boot-config block (endpoint URLs) becomes Liquid theme settings —
  the one place URLs live, as the existing code comment anticipated.

## Concierge

Unchanged architecture. Tier 1 (`js/planner.js` + `js/saia-knowledge.js`) ships inside
theme assets and runs in the browser as today. Tier 2 misses POST to the existing
Vercel endpoint `https://saia-london.vercel.app/api/concierge`; CORS headers already
allow it. Endpoint URL is a theme setting. Later hardening (optional): pin
`Access-Control-Allow-Origin` to the Shopify domain.

## Real checkout

Two products created once in Shopify admin:

| Product | Price | Quantity means |
|---|---|---|
| Mat hire · 2-day | £8.50 | number of mats (min 10, max 50) |
| Extra hire day | £1.50 | mats × extra days |
| Refundable deposit | £1.50 | number of mats — charged at checkout, refunded by Cristina in Shopify admin once the mats come back |

Flow: the concierge/hire flow's existing `checkout` action stops printing a fake link
and builds a real cart permalink —

```
/cart/{mat-hire-variant}:{mats},{extra-day-variant}:{mats×extraDays},{deposit-variant}:{mats}
  ?attributes[Event date]=…&attributes[Postcode]=…&attributes[Delivery estimate]=…
```

— so Cristina sees full booking context (date, postcode, delivery estimate) as cart
attributes on the order. `applyActions()` booking math is unchanged.

Constraints:
- Min 10 / max 50 enforced by the front end (as today); `cart.liquid` clamps quantity
  as a backstop (Shopify has no native min/max without apps).
- No computed price ever appears in concierge `say` text (existing brand rule); the
  cart shows Shopify's own line prices.
- Delivery line appears in the cart UI as **"Delivery — confirmed by Cristina"** at £0,
  with the estimator figure shown as context only.
- Brand rule holds: HIRE only — product copy never says "buy"/"for sale".

## Sub-projects (build order, each verified before the next)

1. **Theme scaffold + CLI** — minimal valid theme connected to the store as a draft;
   `shopify theme dev` renders a hello-world layout.
2. **Port `index.html` + shared assets** — the hard one: 3D journey (GLB), scroll flow,
   estimator, fonts, all working inside Liquid.
3. **Port remaining pages** — events (+5 event pages), story, pilates, contact, terms,
   guest-list, 404.
4. **Concierge wiring** — Noor answers on the theme-dev preview via the Vercel endpoint;
   boot config reads from theme settings.
5. **Real checkout** — products created, cart permalink wired into `applyActions()`
   `checkout` case, `cart.liquid` built, test-mode order completes end-to-end.
6. **Launch** — Amir reviews the draft theme on the real domain and publishes.
   Post-launch: redirect/retire the Vercel *pages* (the `api/` endpoint stays).

## Error handling

- Concierge endpoint unreachable from Shopify → existing Tier-1 catch-all already
  handles this (site never breaks without the API).
- Cart permalink with out-of-range quantities (user edits URL) → `cart.liquid` clamp +
  Cristina sees quantity on the order; low risk, no app needed.
- Oversize theme asset push fails → the asset rule above (Files CDN for >10 MB) is
  applied during porting, not discovered at push time.

## Testing

Per sub-project, on the `shopify theme dev` preview: scroll journey plays, estimator
totals count up, concierge answers a Tier-1 and a Tier-2 question, and (sub-project 5)
a test-mode checkout completes with cart attributes visible on the draft order.
Critical-path only (checkout math already has tests in `tests/`); no UI tests.

## Out of scope

- Addison Lee live API (Route B in CLAUDE.md) — the estimator stays placeholder.
- Editor-friendly Shopify sections (Approach B) — may convert simple pages later.
- Any change to booking math, brand voice, or the two-tier concierge design.
