# SAÏA London — site + concierge

Static, dependency-free site for SAÏA London (female-led women's club — **mat hire first**, then
community, then Yoga/Pilates). One small Node endpoint powers the Claude side of the concierge.
Site internals (3D pages, GLB) → `README.md`. Home-page design state → `docs/HANDOVER-home-redesign.md`
(read before touching `index.html` layout). `index.html` is the site root, formerly `home.html`.

## Run / verify

```bash
cp .env.example .env      # ANTHROPIC_API_KEY=sk-ant-...   (one-time)
npm install
npm start                       # terminal A — concierge endpoint :8787 (health: /health)
python3 -m http.server 8000     # terminal B — the site → http://localhost:8000/
node --test tests/*.test.js     # pricing, quotes, planner, cart, logging — keep green
```

Without the endpoint or key the site still works; the concierge just skips the Claude assist.

## The concierge: two tiers, one executor

```
send(text)
  └─ Tier 1  js/planner.js  localPlan() → {say, actions, matched}
        matched? ── yes ─► use it (instant, free, on-brand, no network)
                  └─ no ──► Tier 2  POST /api/concierge (server.js, claude-haiku-4-5)
                              returns {say, actions}; any error → Tier 1 catch-all
        both feed ─► Planner.applyActions(hire, actions)   ← deterministic booking math
```

**Tier 1 is the product** (curated, never off-brand); **Tier 2 is the safety net** for the long
tail — scoped hard to SAÏA, and it never computes a price, it emits an action. Model override:
`SAIA_MODEL` in `.env`. The key stays server-side.

| Change | Where |
|---|---|
| A known situation (Tier 1) | `localPlan()` in `js/planner.js` — return via `m(say, actions)` |
| Claude's scope/voice (Tier 2) | `systemPrompt()` in `server.js` |
| Claude's answer quality | gold Q→A examples in `js/saia-examples.js` — **grow this file**; a few good examples beat hundreds of scripts. 1–3 warm British sentences, never a computed price |
| Any fact/price/number | `js/saia-knowledge.js` **only** |
| Booking math | `applyActions()` in `js/planner.js` |

The 15 tools: `add_mats, set_days, set_method, set_postcode, set_event, recommend, set_date,
quote, book_delivery, checkout, confirm, rsvp_event, request_pilates, join_pilates_list,
join_newsletter` — **keep in sync with `TOOLS` in `js/concierge-core.js`**, which is what Tier 2
may emit; a tool listed there but missing from `applyActions()` is silently ignored. Slot order:
mats → days → method → postcode → date. **No return-journey slot** (`set_collection` /
`hire.collection` are gone — the method decides both journeys; a stale one is ignored and still
prices two-way). Pilates is never instant-booked: 1-2-1 → `request_pilates`, group →
`join_pilates_list`.

**Single source of truth: `js/saia-knowledge.js`** — every fact lives here and feeds both tiers
(Tier 1 interpolates it, Tier 2 gets `KB.factSheet`), so they cannot disagree. Dual-mode:
`window.SAIA.KB` in the browser, `require()` in Node.

## Conversation logging

Each turn fires from `js/home-concierge.js` to `POST /api/log`. `js/log-core.js` (shared by
`api/log.js` + `server.js`) writes to **Vercel Blob** — needs `BLOB_READ_WRITE_TOKEN`, else rows
print locally / drop in prod. Cristina reads them at **`/chat-log.html`** via `GET /api/chat-log`:
needs `CHAT_LOG_PASSWORD` + `CHAT_LOG_SECRET` (optional `RL_CHATLOG_PER_15`, default 10/15min),
else 503. The password buys an 8-hour HMAC cookie.

> **Privacy — do not weaken.** Blob URLs are public-but-unguessable and transcripts carry names,
> postcodes and emails. Two load-bearing mitigations: blobs use `addRandomSuffix: true`, and
> **no blob URL ever reaches the browser** (`/api/chat-log` serves content only). Never add a
> "download the raw file" link.

## Brand rules (always)

- Mats are **HIRE ONLY — never "buy"/"for sale"**. £8.50/mat, 2-day hire, **+£1.50/mat per extra
  day**, **min 10, max 50** (our stock; no bulk discount). Over 50 → suggest staggered/reused
  sessions, never book past 50. **One exception:** studios can commission **bespoke mats made to
  order** — enquiry only, by email to Cristina@saialondon.com. No price, no checkout path; the
  concierge must never invent a bespoke price.
- Say **"us"/"we"** in every contact instruction and service promise. Keep Cristina's name for
  biography, her role as Pilates instructor, page/nav titles, filenames and the email address.
  She is a person, not a mascot.
- Collection is **same day, after the event** (mats rolled, bagged, stacked; waiting charge if
  the courier waits) — **not** "the day after". Same-day delivery+collection still bills as the
  2-day hire. Delivery is the day before. Our NW3 base is the **warehouse**, never "office".
- Voice: warm, female-led, unpretentious, British English. **English-only project.**
- Contact: **Cristina@saialondon.com** (primary, site-wide) + WhatsApp 07444 611 914; NW3.
  (`marketing@`/`press@` on contact-us.html are separate department channels.)
- Palette: cream `#F5F1E8`, ink `#2B2620`, terracotta `#B8624A`. Fonts are per-page: `index.html`
  = Playfair Display + Inter; the sample pages still on Cormorant Garamond + Hanken Grotesk.
- **Never remove existing UI elements** when making changes.

## Delivery — symmetric, banded, chosen BEFORE checkout

Addison Lee courier from NW3. Either **we do both journeys** (delivery + same-day collection, one
price) or **the customer does both** (free pickup and return). **No mixed option.** `hire.method`
is `'deliver' | 'pickup'`, chosen in the estimator or the assistant, never at checkout.

| Band | Price | Where | Real AL Small Van (round trip) |
|---|---|---|---|
| `bandA` | **£80** | NW1–3, NW5/6/8/10/11, N1–N8, N19, N22, W1, W2, W9–W11, EC1–EC4 | £65–78 |
| `bandB` | **£110** | WC, SW1–SW11, most SE + E, W3–W14, N9–N18, NW4, NW9 | £84–104 |
| `outer` | **quote** | rest of London + BR CR DA EN HA IG KT RM SM TW UB WD | £129–192 |
| `outside` | **quote** | not London | — |

Prices in `KB.delivery.bands`; district maps `bandADistricts`/`bandBDistricts`. Band C has no
price **on purpose** (£129 Harrow → £192 Bromley — one number would gouge or lose): it sets
`quoteOnly`, routing to the WhatsApp quote via `js/checkout-handoff.js` with no courier cart
line. Never price it without re-quoting AL. Figures = live AL Small Van quotes from NW3, Aug 2026,
inc VAT, **excluding waiting-time charges**; re-quote all four corners when AL moves its tariff.

- **In the cart it's a real line item.** `js/shopify-cart.js` adds the hidden "Courier delivery"
  product, one variant per priced band (`variant_courier_band_a` / `_b` via `saia-boot.liquid`).
  Courier variants weigh 1kg, everything else 0g, and shipping is **weight-gated**: carts with a
  courier line get the free rate, carts without get the paid fallback. No loophole either way.
- **A priced band with no variant is refused, not silently discounted** — `cartCourierMissing()`
  sends it to the WhatsApp quote. Without that the guest pays nothing for the delivery we just
  quoted *and* the 0g cart takes the paid fallback rate. Band C/outside never trip it.
- **A band price change = three places, all must match**, else the price depends on the route to
  checkout: (1) `KB.delivery.bands.<band>`, (2) the Shopify variant price, (3) the paid fallback
  rate in the "SAÏA mat hire (checkout plumbing)" shipping profile.
- **Publish order** (bot and storefront are different deployments): Shopify variant **first** →
  `theme push` → `git push`. Git first = the bot quotes the new price while the cart charges the
  old one.
- **LATER — live AL rates:** the AL Shopify app is installed but in TEST mode. Blockers: no
  vehicle-size concept (10–50 mats need a van), and dynamic rates need the carrier-service API
  (Advanced plan). Alternative: AL "Quickbook" API, needs a business account.

## Home page — the pinned journey

`index.html` is a 900vh pinned scroll journey (`js/home-journey.js`); each `[data-band]` chapter
is a **100vh window with `overflow:hidden`** under a sticky `.snav`. Anything outside the strip
between nav and fold is **cut, silently**.

- **Never hard-code the navbar height** (it is ~123px desktop / 59px mobile, two rows). It is
  measured and published as `--snav-h` by a script beside the `<header>`.
- `fitBands()` in `home-journey.js` re-measures per resize (and per content resize — the quote
  card grows ~320px when a date opens the breakdown) and gives each chapter a nudge to clear the
  nav plus a scale to clear the fold, folded into the transform `bands()` already writes.
  Chapters that fit are untouched.
- The estimator exists **twice**: pinned in chapter 4 (`.is-inband`, ≥768px) and flat
  (`.est-flat`, `#estimate`, ≤767px). Only one renders. Its headline reveal must trigger off
  **`.in`**, not just `.vb.play` — the pinned copy has no `.vb` wrapper.
- **Bump `?v=` in `index.html` after editing anything in `js/`**, or browsers run stale code.

## Shopify theme

`theme/` is the on-brand theme (store `saialondon`, theme **182035448187** "SAÏA v2"). It is
**PUBLISHED — it is what www.saialondon.com serves**, so `theme push` is a production deploy with
no preview step. The old "Motion" theme is gone.

```bash
npx shopify theme push --store saialondon --theme 182035448187 --path theme --allow-live --only <file> --only <file>
node tools/shopify-port/port.mjs index.html index      # regenerates theme/templates/index.liquid
```

`theme/assets/` holds copies of the shared `js/` files. `concierge-core.js`, `saia-examples.js`,
`log-core.js` and `http-guard.js` are **server-side only and must never appear there**.
`index.liquid` mirrors the `index.html` estimator — edits must land in both (run the port).

Porting gotchas, all silent if missed:

- **`port.mjs` throws "asset name collision"** for any `theme/assets/x.js` whose bytes differ
  from `js/x.js`. Delete that theme copy, then re-run. Always `git diff --stat theme/` after.
- **It re-emits `<meta name="description">` into the body** on every run; restore the
  `{%- comment %}` block in its place (the real one lives in `snippets/seo-meta.liquid`).
- **`home-mobile-journey.js` is NOT a plain copy.** `port.mjs` rewrites two literals; a bare
  `cp` breaks the mobile storefront with nothing in the console:

  | in `js/` | in `theme/assets/` |
  |---|---|
  | `from '../vendor/GLTFLoader.js'` | `from './GLTFLoader.js'` |
  | `window.location.href = 'guest-list.html'` | `= '/pages/guest-list'` |

  There is no `theme/vendor/`, so the unported import 404s, `initMobileJourney()` never runs, and
  ≤767px loses the journey that *replaces* the hero and hire bands — an empty page. Check after
  every sync: `grep -n "vendor/\|guest-list.html" theme/assets/home-mobile-journey.js` → nothing.
- Before pushing, **pull the live copies and diff** — the storefront can be edited in the admin,
  and a push overwrites it.
