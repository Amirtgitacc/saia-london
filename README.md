# SAÏA London — site internals

The SAÏA London site: a **dependency-free static front end** (HTML + CSS + vanilla JS,
Three.js vendored locally, no build step) plus one tiny Node endpoint for the concierge's
Claude assist. Working instructions, architecture and brand rules live in **`CLAUDE.md`** —
this file is just the map of what's where.

## Run

See `CLAUDE.md` → "Run / verify". Short version: `npm start` (concierge endpoint :8787) +
`python3 -m http.server 8000` (static site). A static server is required (not `file://`)
because the pages `fetch()` the `.glb` mat model and textures.

## Pages

| File | What it is |
|------|------------|
| `index.html` | The site root (formerly `home.html`): scroll-driven home with the 3D mat journey, the delivery estimator ("Spotlight" section), and the SAÏA assistant. Design state: `docs/HANDOVER-home-redesign.md`. |
| `story.html`, `events.html` + `event-*.html`, `pilates-with-cristina.html`, `contact-us.html`, `terms-and-conditions.html`, `guest-list.html` | Editorial / info pages. |
| `checkout.html` | Hire checkout hand-off page. |
| `samples.html`, `sample-film.html`, `sample-hybrid.html` | Design-direction sample boards (older font pair). |

## Structure

```
index.html + pages        see table above
css/base.css              design tokens, fonts, keyframes
js/
  saia-knowledge.js       ALL SAÏA facts + pricing (single source of truth)
  planner.js              Tier-1 concierge brain + applyActions() booking math
  concierge-core.js       Tier-2 (Claude) prompt/schema, shared by server.js + api/
  saia-examples.js        gold Q→A few-shot examples for Tier 2
  home-concierge.js       assistant UI on index.html (+ chat logging)
  shopify-cart.js         hire state → Shopify cart (mats, deposit, courier line)
  checkout-handoff.js     cart → checkout plumbing
  log-core.js             chat-log validation, shared by api/log.js + server.js
  mat-core.js, home*.js   3D mat + page controllers
server.js                 local dev endpoint (:8787)
api/                      same endpoints as Vercel serverless functions
theme/                    the on-brand Shopify theme (see CLAUDE.md → "Shopify theme")
tests/                    node --test tests/*.test.js
vendor/three.min.js       Three.js r160 (vendored)
assets/ photos/           GLBs, textures, imagery
tools/                    generators + labs (tools/lab/*.html)
docs/                     handover / design-state docs
```

## Deployment

- **Vercel** — live at `saia-london.vercel.app`; `git push` auto-redeploys. `ANTHROPIC_API_KEY`
  set in the Vercel env.
- **Shopify** — store `saialondon`; the theme in `theme/` is pushed to a draft theme (ID in
  `CLAUDE.md`) until publish day.
