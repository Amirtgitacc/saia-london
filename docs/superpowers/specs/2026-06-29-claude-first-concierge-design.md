# Claude-first concierge — design

**Date:** 2026-06-29
**Status:** Approved (brainstorm), pending implementation
**Scope:** `js/home-concierge.js` (behaviour change) + one new test. Everything else unchanged.

## Goal

Make the SAÏA concierge read **every** message with Claude instead of letting the Tier-1
regex planner answer common cases itself. The aim is fewer mistakes: the regex matcher is
rigid and occasionally picks the wrong scripted reply, whereas Claude reads the whole
message (typos, compound questions) and decides. The pre-written phrases stop being hard
matches and become reference Claude may use as-is or reword — which is exactly what the
existing few-shot examples already provide.

## Decisions (locked during brainstorm)

| Decision | Choice | Why |
|---|---|---|
| Model | **Keep Haiku 4.5** (unchanged) | Cost stays near-zero; lean on examples/prompt for quality. |
| Fallback when Claude is unreachable | **Keep full Tier 1 as offline backup** | Most resilient — a Vercel hiccup, missing key, or timeout still gives a working reply. |
| Preset phrases | **Leave as-is** | `saia-examples.js` already feeds Claude adaptable gold examples; `planner.js` scripts live on as the fallback. Grow `saia-examples.js` later only if a reply feels off. |

## The change

Today, `send()` in `home-concierge.js` calls `Planner.localPlan()` first and only escalates
to Claude on a miss. We invert that: Claude runs on every message; the regex planner is
demoted to a fallback that fires only when the network call fails.

### Before

```
send(text)
  └─ Planner.localPlan(text, hire)  ← Tier 1 regex, gatekeeper
       matched? ── yes ─► applyAndShow(plan)            (instant, free)
                └─ no ──► askAssist()  → POST /api/concierge (Claude)
  └─ applyActions(hire, actions) → basket
```

### After

```
send(text)
  └─ askAssist()  → POST /api/concierge   ← Claude reads EVERY message
       ok?  ── yes ─► applyAndShow({say, actions})
            └─ no (down / no key / 12s timeout)
                 └─► Planner.localPlan(text, hire) → applyAndShow(plan)   ← offline safety net
  └─ Planner.applyActions(hire, actions) → basket   ← unchanged
```

### Concrete edits (all in `js/home-concierge.js`)

1. **`send(text)`** — remove the `localPlan` gate. After pushing the user message and
   showing the typing indicator, call `askAssist(text)` directly. (Pass the raw `text`
   through so the fallback can re-plan from it.)
2. **`askAssist(text)`** — on the success path, unchanged (`applyAndShow` with Claude's
   `{say, actions}`). On the **failure/timeout path**, instead of `finish(GENERIC)`, run
   `Planner.localPlan(text, state.hire)` and `applyAndShow` its result. If `localPlan`
   itself is unavailable, fall back to the existing `GENERIC` line.
3. Keep the 12s guard timeout; it now routes to the `localPlan` fallback rather than a bare
   generic string.

### Untouched on purpose

- `js/planner.js` — `localPlan()` and `applyActions()` both stay. `localPlan` is now the
  offline fallback; `applyActions` remains the deterministic price rail (Claude never
  computes a total).
- `js/concierge-core.js`, `server.js`, `api/concierge.js` — model stays `claude-haiku-4-5`;
  prompt, schema, and quote-gating logic unchanged.
- `js/saia-examples.js`, `js/saia-knowledge.js` — unchanged.
- Greeting, intent chips, basket rendering, mobile-keyboard handling — all local UI, unchanged.
- `seedEstimate()` — keeps its local opening line (deterministic slot prompt); the guest's
  first real reply afterwards goes through `send()` → Claude as normal.

## Trade-offs

- **Latency:** every message is now a network round-trip (~1s + typing dots) instead of some
  being instant. Expected and acceptable.
- **Cost:** every message hits the API. On Haiku at this site's traffic, still pennies.
- **No new abuse guard** (per-IP rate limit) — out of scope for this first try; note for later
  if traffic warrants.

## Testing

Add one focused test for the new fallback path (the only genuinely new behaviour):

- **Claude fails → `localPlan` answer renders.** Simulate `/api/concierge` rejecting (or
  timing out); assert the chat shows a `localPlan`-derived reply (not a dead/blank state)
  and that `applyActions` still runs on any actions it returns.

No tests for the happy path UI or the unchanged booking math (already covered / out of the
"critical path" testing rule).

## Verify

Run the site + endpoint (`npm start` + `python3 -m http.server 8000`), open `index.html`,
send a normal hire question → confirm it now goes through Claude (typing dots, then reply).
Then stop `server.js` and send another message → confirm the offline fallback still answers.
