# SAÏA London — site + "Noor" concierge

Static site for SAÏA London (a female-led women's club — **mat hire is the priority**, then
community, then Yoga/Pilates). Dependency-free front end; one tiny Node endpoint powers the
Codex side of the concierge. See `README.md` for the site internals (3D pages, GLB, etc.).

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
deterministic brain and skips the Codex assist. `curl localhost:8787/health` shows status.

## The concierge: a two-tier brain

The concierge is **dedicated to SAÏA**, not a generic chatbot. Two tiers, same output shape
`{say, actions}`, consumed by one deterministic executor:

```
send(text)
  └─ Tier 1  js/planner.js  localPlan() → {say, actions, matched}
        matched? ── yes ─► use it (instant, free, on-brand, no network)
                  └─ no ──► Tier 2  POST /api/concierge (server.js, Codex Haiku 4.5)
                              returns {say, actions}; on any error → Tier 1 catch-all
        both feed ─► Planner.applyActions(hire, actions)  ← deterministic booking math
```

- **Tier 1 = the product.** Curated, scripted answers for the common situations. Fast, free,
  never off-brand. Codex never touches these.
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
- **Change Codex's scope/voice (Tier 2):** edit `systemPrompt()` in `server.js`.
- **Change a fact/price/number:** edit `js/saia-knowledge.js` only.
- **Booking math** lives in `applyActions()` in `planner.js` — shared by both tiers; the 11
  tools are: `add_mats, set_event, recommend, set_date, quote, book_delivery, checkout,
  confirm, rsvp_event, book_pilates, join_newsletter`.

## Two concierge front ends

- `index.html` + `hero.html` → agentic concierge with a live hire panel
  (`concierge-ui.js` + `planner.js`). Tier 2 escalation built in.
- `home.html` → simpler FAQ concierge inside `home.js` (no hire panel). Also escalates to the
  same `/api/concierge` endpoint on a miss.

## Brand rules (always)

- Mats are **HIRE ONLY — never "buy"/"for sale"**. £8.50/mat, 2-day hire, min 10.
- Voice: warm, female-led, unpretentious, British English. English-only project.
- Contact = WhatsApp Cristina (founder + Pilates instructor) on 07444 611 914; NW3 area.
- Palette: cream `#F5F1E8`, ink `#2B2620`, terracotta accent `#B8624A`. Cormorant Garamond +
  Hanken Grotesk. Don't remove existing UI elements when making changes.

## Model

Tier-2 assist uses `Codex-haiku-4-5` (fast, fires only on the long tail). Override with
`SAIA_MODEL` in `.env`. Key stays server-side; it never reaches the browser.
