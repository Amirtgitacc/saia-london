# Claude Code prompt — full end-to-end test of the live SAÏA site

Copy everything below the line into a **fresh Claude Code session** (in this repo, with the
browser tools available). It drives the live storefront + concierge as five real customers,
verifies checkout maths, and reports a pass/fail table.

> Updated 2026-07-22 after a launch fix pass. The theme is now **published/live**, and the
> concierge voice + flat-rate pricing fixes are **deployed**. This run should confirm those fixes
> hold on the live site (regression check) and that everything else works.

---

You are QA-testing the **live** SAÏA London site. Be thorough, skeptical, and report exactly what
you observe — do not assume anything passes without seeing it on screen.

## Environment & safety (read first)
- Live storefront: **https://www.saialondon.com/** (Shopify theme "SAÏA v2", id 182035448187 — now
  the LIVE theme). A "SAÏA v2 (draft)" preview bar at the bottom only shows to logged-in staff, not
  real customers — ignore it.
- Concierge: the "Questions? Chat here" widget (bottom-right). Tier 1 = `js/planner.js` (in the
  browser), Tier 2 = Vercel `/api/concierge` (Claude). Widget greeting + UI = `js/home-concierge.js`.
  Facts live in `js/saia-knowledge.js`.
- **Payments are LIVE (not test mode). NEVER place a real paid order with a real card.** To complete
  a checkout without charge, use a **100%-off discount code**:
  - Ask the store owner to create a single-use "amount off order, 100%, ends today" code and give it
    to you (the earlier `QATEST100` was deleted after the last run — assume it no longer exists).
  - OR drive each flow only up to the payment step and stop.
  - OR use a **draft order** in admin.
  Complete **at least one** full order (via the 100%-off code) to prove the order pipeline, then
  tell the owner to disable the code and archive the test order afterwards.
- Use the browser automation tools. Screenshot each key step, record a GIF of at least one full
  hire flow, and read the console + network tab for errors on every page.

## Recent fixes to CONFIRM still hold (regression checks — flag as FAIL if broken)
1. **Greeting** opens with "Hello, and welcome to SAÏA… What can I help with?" — it must NOT say
   "Hello, lovely" or "What brings you in?".
2. **Voice is professional & friendly, British, no em dashes (—).** No "lovely"/"Perfect —"/"Ha"
   openers, no gushing. If ANY concierge reply contains an em dash, that's a FAIL.
3. **Delivery price in chat text is flat £90 (two-way) / £45 (one-way).** The old per-zone "£35"
   must NEVER appear. If you see "£35" anywhere in a delivery quote, that's a FAIL.
4. **The chat text and the price card/cart must agree** on every number (previously the text said
   £35 while the card charged £90 — verify they now match).

## Known facts to assert against (verify against js/saia-knowledge.js, don't trust memory)
- Mats are **HIRE ONLY** (never "buy"/"for sale"). £8.50/mat, 2-day base, +£1.50/mat per extra day.
  **Min 10, max 50** (no bulk discount; over 50 → staggered sessions, never book past 50).
- Refundable deposit **£1.50/mat**. Collection is **same day, after the event** (not next day).
- Courier: flat London — **£90 two-way** (default) / **£45 one-way**. NW3 pickup free. Outside
  London → email quote (no invented price).
- Contact everywhere: **Cristina@saialondon.com**, WhatsApp 07444 611 914, NW3.
- Delivery choice (two-way vs one-way) is asked in the assistant via `set_collection`, before the quote.
- Cart shipping is **weight-gated**: a cart WITH a courier line shows the free "Courier — already
  included in your hire total" rate; a cart WITHOUT one (direct product buy) shows a paid rate.
  There must be **no free-shipping loophole** and **no double-charge** (courier line £90 + a second
  £90 shipping fee would be a FAIL).

## The five customers (run each as a separate conversation, reload the page to reset)

**Customer 1 — Straightforward London hire (happy path, complete the order).**
30 guests, a concrete near-future Saturday, courier to an EC2 postcode, collect after, 2 days. Take
it all the way through **Book this hire → cart → checkout → 100%-off code → completed order**.
- Assert: recommend ~33 mats; slot order mats/guests → days → method → postcode → collection → date;
  date confirmed back; quote gated (asks before revealing); price card = 33×£8.50 (£280.50) + £90
  courier + 33×£1.50 deposit (£49.50) = **£420.00**; cart has all 3 lines + attributes (method,
  return journey, postcode, event date); checkout shipping = free "already included" rate; order
  confirms at £0 with the code.

**Customer 2 — Price-sensitive + objection.**
"any chance of a discount?", then "seems a bit pricey", then "is delivery a flat rate?".
- Assert: no discount invented; £8.50 flat held; the delivery answer is **flat £90/£45** (not £35);
  a pricing QUESTION is answered in words WITHOUT revealing the quote (quote reveals only on a clear
  opt-in). Deposit explained as refundable.

**Customer 3 — Edge cases / limits.**
"I only need 5 mats" (→ sets 10, the minimum); fresh chat: "I need about 80 mats" (→ refuse past 50,
suggest staggered/reused sessions, never book 80); fresh chat: "can you deliver to Brighton?"
(→ outside London → email Cristina, no invented price).

**Customer 4 — One-way delivery + extra days + a date that needs confirming.**
"40 women, delivering to SW1, but we'll bring the mats back ourselves", "3 days", event "the 26th
next month".
- Assert: `set_collection` one-way (£45); extra-day maths (+£1.50/mat for the 3rd day); the vague
  date resolved to a full DAY MONTH YEAR and confirmed before booking; cart uses the one-way courier
  line (£45, not £90).

**Customer 5 — Community / Pilates / guest list (no purchase).**
Ask "what events have you got coming up?" and join the guest list with a test email; fresh chat:
"do you do pilates classes?" → ask for a 1-2-1; another chat → join the group waitlist with a test email.
- Assert: newsletter signup fires (join_newsletter); 1-2-1 → a request to Cristina (request_pilates,
  not an instant booking); group class → waitlist (join_pilates_list). Note: signup emails are
  captured as log rows in Supabase `chat_logs` (there is no separate mailing-list integration) — if
  you can, confirm the row appears; a rare transient `/api/log` 503 under burst is acceptable, but
  repeated 503s are a FAIL.

## Also test directly (not via the assistant)
1. **Direct product-page buy** (if a mat product is reachable): add to cart WITHOUT the assistant;
   assert shipping shows the **paid** courier rate (no free-shipping loophole).
2. **Storefront pages render**: Home, Events, Our Story, Pilates with Cristina, Hire Mats — each
   200, no broken images, no console errors, correct nav, contact email = Cristina@saialondon.com.
3. **Chat logging**: watch the network tab — `/api/concierge` should be 200 and `/api/log` should be
   204 (occasional transient 503 under rapid bursts is tolerable, persistent 503 is a FAIL).
4. **Mobile viewport**: repeat Customer 1 at ~390px width; assert layout + chat still usable.

## Report format
Produce ONE markdown table: `Scenario | Steps | Expected | Observed | PASS/FAIL | Evidence`. List
every FAIL with the exact broken behaviour, the URL, and any console/network error text. Put the
four regression checks (greeting, no em dashes, £90 not £35, text=card) at the top. End with a
short prioritized fix list. Do not claim a scenario passed unless you saw the expected result on screen.
