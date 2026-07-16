# One assistant name · working Book Now · chat logging — design

Date: 2026-07-16 · Approved by Amir in conversation.

## 1. One unified name: "SAÏA assistant"

The bot is currently called three things in user-facing copy: "Noor" (Shopify cart page),
"SAÏA Concierge" (sample pages' widget header), "chatbot" (samples decision page). The main
site (`index.html`) already says "SAÏA assistant" everywhere.

Changes (user-visible text + the obvious header comments only):

| File | Before | After |
|---|---|---|
| `theme/templates/cart.liquid` | "Plan a hire with Noor" | "Plan a hire with the SAÏA assistant" |
| `sample-film.html`, `sample-hybrid.html` | widget header "SAÏA Concierge", aria "Close concierge" | "SAÏA Assistant" / "Close assistant" |
| `samples.html` | Decision 05 heading "Concierge chatbot" (+ "chatbot" in copy) | "SAÏA assistant" |
| `js/planner.js` | header comment `concierge "Noor"` | `SAÏA assistant` |

Out of scope: `tone-questionnaire.html` (already sent to Cristina), internal identifiers
(`NS.Concierge`, `home-concierge.js`, `/api/concierge`, `#concierge-hire`) — code only, never
seen by users, renaming them risks breakage for zero user value.

## 2. Estimator "Book now" → a real cart

**Bug:** the theme's estimator handler only does `sessionStorage.setItem('saia_hire', …)` then
`location.href='/cart'` — nothing is ever *added* to the Shopify cart, so customers land on an
empty cart page. (The port tool rewrote the local `checkout.html` nav to `/cart` verbatim.)

**Fix (in `index.html`, the source of truth the theme is ported from):** the handler builds the
same `hire` object as now, then calls `window.SAIA.bookHire(hire)` (`js/checkout-handoff.js`,
already loaded on both surfaces — it's what the chat assistant's "Book this hire" button uses):

- **Shopify** (variant IDs configured): AJAX cart build — `/cart/clear.js` → `/cart/add.js`
  (mats + extra days + deposit lines) → `/cart/update.js` (attributes) → land on `/cart` with
  real lines and total, ready to pay. Falls back to a cart permalink on any AJAX failure.
- **Local / Vercel demo** (no variant IDs): sessionStorage + `checkout.html` — unchanged.
- **Outside London** (quote-only): opens pre-filled WhatsApp to Cristina — already built in.

Keep a minimal fallback if `bookHire` is somehow missing: current sessionStorage + nav behaviour.
Then regenerate the theme: delete the stale changed copies in `theme/assets/` and re-run
`node tools/shopify-port/port.mjs index.html index`.

## 3. Conversation logging → Supabase

Tier-1 replies are computed in the browser, and even Tier-2 replies can come from the offline
fallback — so the only place that knows the *actual* conversation shown to the guest is the
front end. Log from there, fire-and-forget, never blocking the chat.

```
Browser (home-concierge.js — the ONE shared chat brain, both surfaces)
  each turn ──POST {session, role, tier, message, page}──► /api/log
                                                            │
                              Vercel api/log.js ── insert ──► Supabase `chat_logs`
                              local server.js  ── console log (or insert if env set)
```

- **Session id:** `crypto.randomUUID()` kept in `sessionStorage.saia_chat_session` — groups a
  visit's turns into one reviewable thread.
- **What gets logged:** every user message, every bot reply (with `tier: 'local' | 'claude'`),
  and action lines (`role:'act'`, e.g. "Added 25 mats") so bookings are visible in the review.
- **Endpoint discovery:** derived from the existing `SAIA_CONFIG.conciergeEndpoint`
  (`…/api/concierge` → `…/api/log`) — no new theme setting needed; CORS mirrors
  `api/concierge.js` (`*`).
- **Transport:** `fetch(…, { keepalive: true })`, errors swallowed — logging must never break
  or slow the chat.
- **Storage:** new `js/log-core.js` (Node-side, shared by `api/log.js` + `server.js`, mirroring
  the `concierge-core.js` pattern): validates/normalises the payload (clamp message length,
  whitelist roles) and inserts via Supabase REST
  (`POST {SUPABASE_URL}/rest/v1/chat_logs`, service-role key, `Prefer: return=minimal`).
  Missing env vars → no-op (site keeps working with zero setup, like the concierge key).
- **Review:** Supabase dashboard → Table Editor → `chat_logs`, filter by `session_id`.

Table (RLS enabled, no public policies — only the service key writes/reads):

```sql
create table if not exists chat_logs (
  id          bigint generated always as identity primary key,
  session_id  text not null,
  role        text not null,      -- 'user' | 'bot' | 'act'
  tier        text,               -- 'local' | 'claude' (bot turns only)
  message     text not null,
  page        text,
  created_at  timestamptz not null default now()
);
alter table chat_logs enable row level security;
```

One-time setup by Amir: create free Supabase project → run the SQL → add `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars (and `.env` locally, optional).

## Files touched

`theme/templates/cart.liquid`, `samples.html`, `sample-film.html`, `sample-hybrid.html`,
`js/planner.js` (comment), `index.html` (Book Now handler + cache-buster), `js/home-concierge.js`
(log hooks), **new** `js/log-core.js`, **new** `api/log.js`, `server.js` (route), `.env.example`,
**new** `tests/log-core.test.js`, regenerated `theme/templates/index.liquid` + `theme/assets/*`.

## Testing

- `node --test tests/` — new `log-core.test.js` covers payload validation/normalisation
  (roles whitelist, message clamp, junk rejection); existing suites must stay green.
- Manual: local chat → server console shows turns; estimator Book Now locally → demo checkout
  still pre-filled; on the Shopify preview → cart shows mat lines + total.
