# SAÏA London — site + "Noor" concierge

Static site for SAÏA London (a female-led women's club — **mat hire is the priority**, then
community, then Yoga/Pilates). Dependency-free front end; one tiny Node endpoint powers the
Claude side of the concierge. See `README.md` for the site internals (3D pages, GLB, etc.).

> **Current design state** of the `index.html` redesign (what's live, decided, and open) lives in
> `docs/HANDOVER-home-redesign.md` — check there before touching `index.html` layout/flow.
> (`index.html` is the page formerly known as `home.html`; it is now the site root.)

## Run / verify

```bash
# 1. one-time: paste your key
cp .env.example .env      # then edit .env → ANTHROPIC_API_KEY=sk-ant-...
npm install

# 2. terminal A — the concierge assist endpoint (:8787)
npm start                 # = node --env-file=.env server.js

# 3. terminal B — the static site (:8000)
python3 -m http.server 8000     # open http://localhost:8000/
```

Without a running endpoint (or key) the site still works — the concierge just uses its
deterministic brain and skips the Claude assist. `curl localhost:8787/health` shows status.

## The concierge: a two-tier brain

The concierge is **dedicated to SAÏA**, not a generic chatbot. Two tiers, same output shape
`{say, actions}`, consumed by one deterministic executor:

```
send(text)
  └─ Tier 1  js/planner.js  localPlan() → {say, actions, matched}
        matched? ── yes ─► use it (instant, free, on-brand, no network)
                  └─ no ──► Tier 2  POST /api/concierge (server.js, Claude Haiku 4.5)
                              returns {say, actions}; on any error → Tier 1 catch-all
        both feed ─► Planner.applyActions(hire, actions)  ← deterministic booking math
```

- **Tier 1 = the product.** Curated, scripted answers for the common situations. Fast, free,
  never off-brand. Claude never touches these.
- **Tier 2 = the safety net.** Only fires on the long tail. Scoped hard to SAÏA, can answer
  *and* book, but never computes a price itself — it emits an action and the app does the math.

## Single source of truth: `js/saia-knowledge.js`

All SAÏA facts (hire terms, classes, events, founder, contact) live here. It feeds **both**
tiers — Tier 1 interpolates the values, Tier 2 gets `KB.factSheet` in its system prompt — so
they can never disagree. **Change a fact once, here, and both brains update.** Dual-mode:
`window.SAIA.KB` in the browser, `require()` in Node.

## Editing the concierge

- **Add a known situation (Tier 1):** add a branch in `localPlan()` in `js/planner.js`,
  return via the `m(say, actions)` helper (sets `matched:true`). Pull facts from `KB`.
- **Change Claude's scope/voice (Tier 2):** edit `systemPrompt()` in `server.js`.
- **Improve Claude's answer quality (Tier 2):** add/refine gold Q→A examples in
  `js/saia-examples.js` — these are injected as few-shot teaching of voice + the right action.
  This is the file to *grow* over time; Claude generalises from it, so a handful of good
  examples beats hundreds of hardcoded scripts. Keep `say` to 1–3 warm British sentences and
  never put a computed price in it (emit an action instead).
- **Change a fact/price/number:** edit `js/saia-knowledge.js` only.
- **Booking math** lives in `applyActions()` in `planner.js` — shared by both tiers; the 11
  tools are: `add_mats, set_event, recommend, set_date, quote, book_delivery, checkout,
  confirm, rsvp_event, book_pilates, join_newsletter`.

## The concierge front end

- `index.html` (the site root) → FAQ concierge inside `home.js` (no hire panel). Escalates to the
  same `/api/concierge` endpoint on a miss.

> The old agentic front end (`index.html` + `hero.html` with a live hire panel via `concierge-ui.js`
> + `journey.js`) was removed. Its booking brain — `planner.js` + `applyActions()` — lives on and is
> still shared by the concierge here.

## Brand rules (always)

- Mats are **HIRE ONLY — never "buy"/"for sale"**. £8.50/mat, 2-day hire, min 10.
- Voice: warm, female-led, unpretentious, British English. English-only project.
- Contact = WhatsApp Cristina (founder + Pilates instructor) on 07444 611 914; NW3 area.
- Palette: cream `#F5F1E8`, ink `#2B2620`, terracotta accent `#B8624A`.
- Fonts are per-page (not yet unified): `index.html` uses **Playfair Display + Inter**;
  the sample pages (`samples.html`, `sample-film.html`, `sample-hybrid.html`) still on
  **Cormorant Garamond + Hanken Grotesk**.
- Don't remove existing UI elements when making changes.

## Model

Tier-2 assist uses `claude-haiku-4-5` (fast, fires only on the long tail). Override with
`SAIA_MODEL` in `.env`. Key stays server-side; it never reaches the browser.

## Delivery (Addison Lee) — placeholder now, live API later

Delivery is by **Addison Lee** courier (NW3 warehouse → event; pickup from NW3 is free). Verified
hire facts from saialondon.com: £8.50/mat, 2-day base, **+£1.50/mat per extra day**, min 10,
**60+ mats → reduced quote**; courier ≈ **£35–55 each way** to central London.

- **NOW — Route C (placeholder, LIVE):** the estimator is live on `index.html` as the
  `.saia-est-stage` "Spotlight" section (dark interrupt, self-drawing route, total counts up),
  ported from `tools/lab/estimator-lab.html`. A dependency-free zone estimator maps the event
  postcode to a London zone and totals it with the mat-hire math. Placeholder courier numbers are
  deliberately LOW: **Central from £35, Greater London from £45**, outside London → WhatsApp quote.
  **Estimate only**; Cristina confirms the real courier price. (Older standalone component:
  `tools/lab/delivery-estimator.html`.)
- **LATER — Route B (the plan):** swap the estimate for **live quotes via the Addison Lee
  "Quickbook" API** (Anypoint/MuleSoft). Has quote + booking endpoints (`POST /booking/create`,
  plus a price-quote call); auth = `AL client_id:client_secret`. Wire the quote into `server.js`
  and feed the hire panel. Requires SAÏA to open an **Addison Lee business account + API
  credentials** — no public API fee (you pay per delivery, not per call); confirm account minimums
  with AL. No-code alternative on the real Shopify store: the official **Addison Lee Shopify app**
  (live same-day rates at checkout; free to install, bills in USD).
