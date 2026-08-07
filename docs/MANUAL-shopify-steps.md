# Manual steps — August 2026 release

These are the jobs the code cannot do for you. They need the Shopify admin or the Vercel
dashboard, so they need your login.

Work top to bottom. Step 1 is the one that costs real money if it is skipped.

---

## 1. Delete the £45 delivery rate in Shopify — DO THIS FIRST

**Why it matters:** the site no longer offers a £45 "we deliver, you return them" option.
Delivery is now symmetric: either our courier does both journeys for £90, or the customer
collects from and returns to NW3 for free. If the old £45 rate is still sitting in your
shipping profile, it reappears as a shipping choice at checkout and **undercuts the £90 that
is already in the customer's cart**. They would pay £45 for a £90 service, and we would eat
the difference on every booking.

Code cannot remove it. Only you can.

1. Shopify admin → **Settings** → **Shipping and delivery**.
2. Under **Shipping**, open the profile named **SAÏA mat hire (checkout plumbing)**.
3. Find the United Kingdom / London zone.
4. You should see these rates. Delete the one marked ❌:

   | Rate name | Price | Action |
   |---|---|---|
   | Courier — already included in your hire total | £0.00 | ✅ keep |
   | Courier delivery + same-day collection | £90.00 | ✅ keep |
   | Courier delivery only (customer returns mats) | £45.00 | ❌ **delete this one** |

5. Click the **…** menu beside the £45 rate → **Delete rate** → confirm.

**How you know it worked:** the profile lists two rates, not three, and no rate anywhere
says £45.

---

## 2. Archive the one-way courier product

The £45 rate had a matching hidden product. Nothing adds it to a cart any more, but leaving
it published means someone could still find it.

1. Shopify admin → **Products**.
2. Search for **Courier delivery only** (variant ID `56340398670203`).
3. Open it → **…** menu (top right) → **Archive product**.

Do **not** archive "Courier delivery + same-day collection" — that one is still in use.

**How you know it worked:** searching Products for "Courier" shows the two-way courier as
Active and the one-way as Archived.

---

## 3. Add three environment variables in Vercel

Without these, Cristina's chat transcript page shows an error and never opens.

1. Go to **vercel.com** → the **saia-london** project → **Settings** → **Environment
   Variables**.
2. Add each of the following. Set all three to **Production, Preview and Development**.

   | Name | Value | What it does |
   |---|---|---|
   | `BLOB_READ_WRITE_TOKEN` | see step 3a | Lets the site save chat transcripts |
   | `CHAT_LOG_PASSWORD` | a password you choose | What Cristina types to read them |
   | `CHAT_LOG_SECRET` | a long random string | Keeps her login cookie tamper-proof |

   Optional: `RL_CHATLOG_PER_15` limits password attempts. Leave it out and it allows 10
   tries per 15 minutes, which is a sensible default.

   **3a. Getting the blob token:** in the same Vercel project go to the **Storage** tab →
   **Create** → **Blob** → name it `saia-chat-logs`. Vercel then offers to connect it to the
   project, which creates `BLOB_READ_WRITE_TOKEN` for you automatically. If it does, you can
   skip adding that one by hand.

   **Choosing `CHAT_LOG_SECRET`:** any long random string, 32+ characters. It is never shown
   to anyone. If you change it later, Cristina simply has to log in again.

3. **Redeploy** — Vercel only picks up new variables on the next deploy. Go to
   **Deployments** → the newest one → **…** → **Redeploy**.

**How you know it worked:** open `https://saia-london.vercel.app/chat-log.html`. You should
get a password box. Type the password from `CHAT_LOG_PASSWORD` and you should see the list
of conversations. If you get an error message instead, one of the three variables is
missing or the redeploy has not finished.

---

## 4. Give Cristina the transcript page

Once step 3 works, send her:

- the link: `https://saia-london.vercel.app/chat-log.html`
- the password you chose

Worth telling her plainly: **the transcripts contain real customers' names, postcodes and
email addresses.** The page is password-protected and hidden from Google, but the password
should not be shared or reused anywhere else.

She only needs to type it once every 8 hours.

---

## 5. Check the courier price still agrees in three places

Only relevant if you ever change the £90. All three must match or a customer sees a
different delivery price depending on how they reached checkout:

1. `KB.delivery.twoWay` in `js/saia-knowledge.js` (a developer changes this)
2. the **Courier delivery + same-day collection** product's price in Shopify
3. the **£90 rate** inside the "SAÏA mat hire (checkout plumbing)" shipping profile

Nothing to do today — the three already agree at £90. This is here so the next person
knows all three exist.

---

## 6. Publish the theme (when you are ready)

The work is on draft theme **182035448187**. Publishing is your call and is not part of this
release.

Before you publish, preview the draft and check:

- the homepage estimator asks for an event date and shows four dates on the booking
- there is no "after your event" delivery toggle anywhere
- nothing on the site says £45, "one-way" or "delivery only"
- the contact page says "Message us directly", and the Pilates page still says
  "Pilates with Cristina" throughout

To publish: Shopify admin → **Online Store** → **Themes** → find the draft → **Actions** →
**Publish**.
