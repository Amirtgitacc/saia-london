# SAÏA live-site QA results — 2026-07-22

Tested the live storefront (theme "SAÏA v2", published today) as real customers, including a
completed £0 test order via the `QATEST100` discount. Driven with browser automation.

## Result summary

| # | Scenario | Expected | Observed | Verdict |
|---|----------|----------|----------|---------|
| 1 | New theme live | New "Yoga mat hire" design for everyone | Home + Events pages render correctly, nav works | ✅ PASS |
| 2 | Concierge — recommend | 30 guests → ~33 mats | "Recommended 33 mats for 30 guests" | ✅ PASS |
| 3 | Concierge — date parse/confirm | Resolve + confirm a concrete date | "Set date to 8 August 2026", confirmed back | ✅ PASS |
| 4 | Concierge — slot flow + quote gate | Ask slots one at a time, ask before revealing quote | Asked pickup/courier, days, then "Shall I pull your quote together?" | ✅ PASS |
| 5 | Price card maths | 33×£8.50 + £90 courier + 33×£1.50 = £420 | Card: £280.50 + £90.00 + £49.50 = **£420.00** | ✅ PASS |
| 6 | Book → Shopify cart | Correct 3 lines + hire attributes | Cart exact, attributes (method/return/postcode/date) attached | ✅ PASS |
| 7 | Checkout shipping (weight-gate) | Free "included" rate, no double-charge | "Courier — already included in your hire total — FREE" | ✅ PASS |
| 8 | Discount + order completion | £0 total, order confirmed | `QATEST100` → £0.00, order **#RMIEZ05RZ** confirmed | ✅ PASS |
| 9 | Mat cap (>50) | Refuse 80, suggest staggered | "up to 50… 80 all at once is beyond our stock… staggered slots" | ✅ PASS |
| 10 | Guest-list action | Signup fires + email captured | Action fired, BUT email persisted nowhere (see F5) | ⚠️ PARTIAL |
| 11 | Concierge voice (retune) | Professional, no em dashes | Old casual voice + em dashes throughout | ❌ FAIL (F1) |
| 12 | Delivery price in chat text | Flat £90/£45 | Bot said "**£35** courier" while card charged £90 | ❌ FAIL (F2) |
| 13 | Chat logging | Turns logged to Supabase | `/api/log` → **503** every call | ❌ FAIL (F4) |

**The commerce pipeline (2→8) works end to end.** A real customer can plan a hire, book, and
check out with correct maths and no shipping loophole. The failures are all about the concierge
*text* and *logging*, not the money path.

## Failures / issues (prioritized)

### F1 + F2 — ROOT CAUSE: the launch-fix branch isn't deployed to production
The Tier-2 assistant (Vercel `/api/concierge`) still runs the OLD code, because the branch
`fix/launch-blockers-2026-07-19` (which has BOTH the flat-rate £90/£45 pricing AND the voice
retune) is committed but **not merged to `main` / not deployed**. Vercel production serves `main`.
Consequences seen live:
- **F2 (worst):** bot's chat text quotes the old "**£35** courier delivery" while the price card
  and cart correctly charge **£90**. A customer sees a direct contradiction (£35 said, £90 charged).
- **F1:** old casual voice everywhere in Tier-2 ("Lovely —", "Perfect —", em dashes) — the exact
  thing the retune fixed.
**Fix:** merge `fix/launch-blockers-2026-07-19` → `main` and let Vercel redeploy. One action clears
both F1 and F2 for the Tier-2 assistant.

### F3 — Concierge greeting is hardcoded old voice
`js/home-concierge.js:134` (and `theme/assets/home-concierge.js:134`) hardcodes
"Hello, lovely… What brings you in?" — never touched by the retune. Shows on every chat open.
**Fix:** update that string in both files to the polished-warmth greeting; re-push theme asset.

### F4 — Chat logging is down (`/api/log` → 503)
Every `/api/log` POST returns 503 in production. No conversations are being saved. Almost
certainly the `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars are missing on Vercel.
**Fix:** set those two env vars in the Vercel project and redeploy; re-test that logs land in the
`chat_logs` table.

### F5 — Guest-list / newsletter emails are not persisted
The concierge says "you're on the guest list", but the only network call on signup is `/api/log`
(which is 503). There is no mailing-list / Shopify-customer / Klaviyo integration. Every guest-list
signup and Pilates-waitlist email is currently lost.
**Fix:** decide where these should go (a) fix `/api/log` (F4) so at least the `chat_logs` capture
works and Cristina reviews it there, and/or (b) wire `join_newsletter` to a real list.

### Minor
- Live theme is still **named** "SAÏA v2 (draft)" — cosmetic; rename in admin to avoid confusion
  (the "(draft)" preview bar only shows to logged-in staff, not customers).
- Test order **#RMIEZ05RZ** (£0) sits in admin — cancel/archive it when convenient.
- `QATEST100` is still active — **disable/delete it** now testing is done (free-mats risk).

## What was NOT run to completion
- Full paid checkout for Customers 2–5 (only Customer 1 taken to a completed order, to avoid
  cluttering the store; the other behaviours — objections, one-way delivery, Pilates — were
  spot-checked in chat, all functionally sound but in the old Tier-2 voice per F1).
- Mobile-viewport pass.
