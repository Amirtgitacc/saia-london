# Concierge voice retune — "Polished warmth"

**Date:** 2026-07-22
**Status:** Approved design, pending implementation plan
**Trigger:** Client feedback — the SAÏA assistant reads as too casual. Wants it to sound
**professional and friendly**. (Cristina's tone questionnaire results are not yet back; this pass
uses judgment now and can be fine-tuned when they arrive.)

## Goal

Shift the concierge voice from *playful-casual* to **polished warmth**: composed, courteous,
British — a friendly boutique concierge, not a call-centre script and not an over-familiar friend.
Keep genuine warmth and contractions; remove endearments, slang, and playful filler.

**Wording only.** No fact, price, action, tool name, slot logic, or control-flow change anywhere.

## The voice rule (applied identically in all three places)

Warm, courteous, British English, 1–3 sentences, one clear next step per reply.

| Cut (too casual) | Keep / replace with |
|---|---|
| "Hello, lovely" · "the mats, lovely" (endearment as **address**) | "Hello — welcome to SAÏA" · plain sentence |
| "Ha — I'll stay in my lane" | "That's a little outside what I cover" |
| "Leave that with me", "pencil that in", "sort your day" | "Of course", "note that down", "help with" |
| "Love that", "How lovely / sweet / exciting", "What a lovely idea" (exclamatory openers) | Lead with substance; "That sounds like a lovely occasion" is fine |
| Exclamation-mark warmth ("Perfect!", pile-ups) | Measured full stops |

**Keep (this is the "friendly" half — do not strip):**
- Contractions: I'll, you're, that's, we'll.
- Courteous warmth: "Of course", "Happy to", "No trouble at all".
- "lovely" as a genuine **adjective** ("the mats are lovely for a yoga event") — only the
  endearment-address form is cut.
- The existing structure: answer → one warm next step / question.
- Every fact, price, £ amount, action, and Cristina@ email exactly as-is.

**Register reference (approved):**
- Greeting → "Hello — welcome to SAÏA. I can plan mat hire for an event, share what's on, or book
  you in for Pilates with Cristina. What can I help with?"
- Off-topic → "That's a little outside what I cover — I'm here for SAÏA: mat hire, our community,
  or Pilates with Cristina. What can I help with?"
- Recommend → "Of course — for 30 guests I'd allow a few spare, so around 33 mats. Shall I note
  that down?"

## Scope — three files, in order

1. **`js/concierge-core.js` → `systemPrompt()`** — rewrite the "YOUR VOICE" block. Replace
   "a touch playful… like a knowledgeable friend… Hello, lovely" with the polished-warmth rule
   above. Abstract instruction only; scope/gating/rules blocks untouched.

2. **`js/saia-examples.js`** — strongest lever (Claude imitates these few-shots more than the
   abstract prompt). Rewrite the `say:` text of **every** example carrying a casual marker
   (all ~60, thorough pass). **`u:` prompts, `actions`, facts, prices stay byte-for-byte** —
   only `say:` wording changes.

3. **`js/planner.js` → `localPlan()` / `m()` strings** — rewrite scripted `say` strings with the
   same markers (e.g. line ~228 "lovely", ~320 "Hello, lovely", ~332 "lovely", plus "Perfect —",
   "Lovely —", "pencil" openers). Slot logic, `awaiting` states, actions, `matched` branches,
   facts untouched.

## Guardrails / non-negotiables

- Greeting **triggers** stay (`hi|hey|hello|yo|hiya|…`) — a guest may still type "hiya"; only the
  bot's **reply** becomes composed.
- No change to: facts, £ amounts, tool names, action args, slot order, gating logic, `matched`
  flags, `awaiting` values, KB references.
- Tests: `node --test tests/*.test.js` must stay green. Some tests may assert on scripted
  strings — where an assertion matches a phrase we changed, update the **assertion** to the new
  wording (never weaken a behavioural test).
- **Theme mirror:** after editing `js/`, re-copy the shared files into `theme/assets/`
  (`planner.js`, `saia-knowledge.js` are mirrored; `concierge-core.js`/`saia-examples.js` are
  server-side only, not in the theme). Confirm which of the edited files exist under
  `theme/assets/` and re-copy exactly those.

## Verification

1. `node --test tests/*.test.js` → all green.
2. Before/after table of **every** changed `say:` line, presented for user sign-off **before any
   commit**.
3. Spot-check: grep the three files for residual markers (`lovely,`, `hiya`, `Ha —`, `Leave that`,
   `Love that`, `pencil`, `!`) — only intentional keeps remain.

## Out of scope

- Cristina's questionnaire-driven fine-tune (later pass, once results return).
- Any UI, layout, pricing, or booking-flow change.
- The two bulk-discount lines flagged earlier — already fixed in commit 7dd6eb7; not revisited here.
