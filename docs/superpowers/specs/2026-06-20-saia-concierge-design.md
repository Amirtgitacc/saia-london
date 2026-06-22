# SAÏA "Noor" Concierge — Real-Claude Assist Design

**Date:** 2026-06-20
**Status:** awaiting review
**Scope:** wire a dedicated, on-brand concierge into the existing static site (`site 2/`),
with Claude as a scoped assist behind a deterministic core. No change to the 3D pages,
nav, or any visual layout.

---

## Goal

Turn the concierge from a local-planner-only widget into a **dedicated SAÏA chatbot**:

1. A deterministic core ("Noor's own brain") that knows the common situations cold —
   instant, free, always perfectly on-brand.
2. A Claude **assist** that only wakes for messages the core doesn't recognise, is tightly
   scoped to SAÏA, and can both answer *and* drive bookings.

The concierge must never feel like "generic Claude in a box." Claude is the safety net;
the deterministic core is the product.

---

## Architecture — two-tier brain

```
                        send(text)
                            │
                            ▼
              TIER 1 — Noor's own brain (planner.js, expanded)
              deterministic intent engine, instant, free, on-brand
                            │
                  matched a known situation?
                     │                    │
                 YES │                    │ NO
                     ▼                    ▼
              scripted reply       TIER 2 — Claude assist (server.js)
              + actions            Haiku 4.5, scoped to SAÏA only,
              (no API call)        returns same {say, actions} shape
                     │                    │
                     └─────────┬──────────┘
                               ▼
                 Planner.applyActions(hire, actions)   ← UNCHANGED
                   → deterministic booking math, mutates hire panel
```

**Invariant:** `applyActions` (the booking executor) is never replaced. Both tiers
produce the same `{say, actions:[{tool,args}]}` shape, so quotes/totals stay deterministic
and can never be hallucinated by the model.

---

## Components

| File | Status | Responsibility |
|------|--------|----------------|
| `js/saia-knowledge.js` | **new** | Single source of truth for SAÏA facts (hire terms, classes, events, founder, location, contact, FAQs). Read by Tier 1 *and* injected into Tier 2's system prompt so they never drift. |
| `js/planner.js` | **expand** | Tier 1. Add `matched: boolean` to `localPlan`'s return. Expand intent coverage to ~10–12 curated situations with on-brand scripted replies sourced from `saia-knowledge`. `applyActions` unchanged. |
| `js/concierge-ui.js` | **edit** | `send()` becomes async. Call Tier 1; if `matched` → use it directly. If not → `await` Tier 2 endpoint; on any error → fall back to Tier 1's catch-all reply. Typing indicator shows during the await. |
| `server.js` | **new** | Tier 2. Tiny Node HTTP server (no framework). One route `POST /api/concierge`. Holds the key server-side, calls Claude with a scoped "Noor" system prompt + knowledge base, forces the `{say, actions}` schema via structured outputs, returns it. CORS for `:8000`. |
| `package.json` | **new** | One dependency: `@anthropic-ai/sdk`. |
| `.env` | **new, gitignored** | `ANTHROPIC_API_KEY=...`. Never reaches the browser. |
| `.gitignore` | **new/edit** | ignore `.env`, `node_modules/`. |

---

## Tier 2 endpoint contract

```
POST /api/concierge
  body  → { messages: [{role:"user"|"bot", text}], hire: {mats,guests,date,total,status} }
  reply ← { say: "<Noor's reply>", actions: [{tool, args}] }
```

- `messages` = the conversation so far (for context).
- `hire` = current live panel state (so Claude knows what's already booked).
- Response forced to the schema below via `output_config.format` (json_schema) — no parsing,
  no tool-call loop, single non-streaming call.

### Action vocabulary (same 11 tools as `applyActions`)

`add_mats` · `set_event` · `recommend` · `set_date` · `quote` · `book_delivery` ·
`checkout` · `confirm` · `rsvp_event` · `book_pilates` · `join_newsletter`

### Output schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["say", "actions"],
  "properties": {
    "say": { "type": "string" },
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["tool", "args"],
        "properties": {
          "tool": { "type": "string", "enum": [ ...the 11 tools ] },
          "args": { "type": "object", "additionalProperties": true }
        }
      }
    }
  }
}
```

---

## Keeping Tier 2 dedicated (the guardrails)

The system prompt enforces three things:

1. **Knowledge-grounded** — answer only from the injected `saia-knowledge` facts; never from
   general knowledge; never invent a price/term not in the facts.
2. **Hard scope** — "You are Noor, concierge for SAÏA London, nothing else. If asked about
   anything outside SAÏA (coding, news, other brands, chit-chat), warmly redirect to the club."
3. **Brand rules** — mats are **hire only, never for sale**; voice is warm, female-led,
   unpretentious; min 10 mats; £8.50/mat/2-day; NW3; WhatsApp 07444 611 914.

Model: **`claude-haiku-4-5`**. Adaptive thinking not needed (low-latency concierge replies);
`max_tokens` ~512.

---

## Model / API specifics

- SDK: `@anthropic-ai/sdk` (official), `client.messages.create` (non-streaming, short replies).
- Structured output via `output_config: { format: { type: "json_schema", schema: {...} } }`.
- Key from `process.env.ANTHROPIC_API_KEY`; run with `node --env-file=.env server.js`.

---

## How to run / verify

```bash
# terminal 1 — Tier 2 endpoint
cd "site 2" && npm install && node --env-file=.env server.js   # :8787

# terminal 2 — static site (unchanged)
cd "site 2" && python3 -m http.server 8000                     # :8000
```

Verify:
1. Common journeys (pricing, "30 women on Saturday", classes, events) answer **instantly**
   with no network call (Tier 1) — check the Network tab shows no request.
2. An off-script question ("what's the vibe like for total beginners?") triggers one
   `POST /api/concierge` and returns an on-brand reply.
3. An off-topic question ("what's the weather?") gets a warm redirect, not a real answer.
4. Stop `server.js` → off-script messages fall back to Tier 1's catch-all, no error.

---

## Build phases

1. **Knowledge file** — `saia-knowledge.js`, single source of truth.
2. **Tier 1 expansion** — richer intents + `matched` flag in `planner.js` (verify standalone).
3. **Tier 2 endpoint** — `server.js` + `package.json` + `.env` (verify with a curl).
4. **Wiring** — async `send()` + escalation + fallback in `concierge-ui.js` (verify end-to-end).

Each phase verified before the next.

---

## Out of scope

- No backend deployment (local dev only — host decision deferred).
- No change to 3D pages, nav, layout, or any visual element.
- No streaming (replies are short).
- Real event-photo drop-in, mobile WebGL pass — tracked separately in the handover.
