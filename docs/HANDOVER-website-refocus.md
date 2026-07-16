# Handover — Website refocus: Pilates scroll section → "the person behind the business"

**Date:** 2026-07-15
**Status:** Not started. Chatbot updates shipped first (commit `508f3c3`); this is the next job.
**Prereq reading:** `docs/HANDOVER-home-redesign.md` (current home layout/flow), and the
"Cristina figure pipeline" memory (how the watercolour flow animation is built).

---

## 1. What the client asked for

Cristina wants the site refocused on the **mat-hire business**, and de-emphasised on Pilates /
her as an instructor ("I'm not teaching at the moment, and don't know if I will again"). But she
**loves the watercolour animation** (the mat unrolling into a figure flowing through poses) and
wants to **keep it** for its premium feel.

Her direction: keep the same visual, remove the "Practice / Pilates with Cristina" framing, and
replace it with a small section introducing her as the **person behind the business**. Her words:

> "SAÏA Mats is run by Cristina, who personally manages every booking from enquiry through to
> delivery and collection, ensuring every client receives a smooth, reliable and personal service."

Reasoning she gave: reassures customers they're dealing directly with a small-business owner, makes
it feel personal, and fills the space left once the Pilates content is removed.

## 2. Decision already made (from the client Q&A, 2026-07-15)

**Scope = "Site copy only."** This is a **copy reframe over the existing animation**, nothing more:

| Keep untouched | Change |
|---|---|
| The watercolour scroll animation + scrub logic (poses, frame sequence, timing) | The **text** overlaid on the 5 scroll bands (desktop + mobile) |
| The concierge's Pilates answers (1-2-1, waitlist) | The end-of-flow email form's framing ("Train with Cristina") |
| The standalone `pilates-with-cristina.html` page | |
| The Pilates nav links (header + drawer) | |

So: **do not** touch the animation, the nav, the standalone page, or the bot. Only swap the copy
in the flow bands and reframe the closing CTA. Easy to reverse if she teaches again.

## 3. File + line map (both desktop and mobile carry the copy — keep them in sync)

Like the two-tier concierge, the flow copy is **duplicated** across desktop and mobile. Both must change.

### Desktop — `index.html`, the `.flow-rail` bands (~lines 809-890)
Five bands, each pinned to a scroll range (`data-band`) over a pose moment:

| Band | `data-band` | Pose | Current eyebrow / headline |
|---|---|---|---|
| L1 | 0.576,0.66 | stands | "Fitness" / "Pilates with Cristina." |
| L2 | 0.675,0.755 | reaches up | "The method" / "Strengthen, heal, realign." |
| L3 | 0.778,0.86 | folds → downward dog | "Where" / "NW3 & Hampstead." + **NW3 tube-map SVG** |
| L4 | 0.882,0.955 | low lunge | "Every body" / "For every body." |
| L5 | 0.972,1 | seated, hands to heart | card "Train with Cristina" / "Work out together." + **email form** (`[data-guest-form]`) |

### Mobile — `js/home-mobile-journey.js`
- **Bands array** (~lines 31-34): mirror of L1/L2/L3/L4 copy as JS strings (`e`/`t`/`x` = eyebrow/title/body).
- **End CTA** (~lines 57-63): `.mj-endcta` "Train with Cristina" + email → submits to `guest-list.html` (line 88).
- Remember to **bump `?v=` for `home-mobile-journey.js`** if it's referenced with a version query,
  and for `index.html`'s inline change (see the "Static JS cache-busting" memory).

## 4. Proposed new copy (DRAFT — get Cristina's sign-off before building)

Retell the same 5 animation beats as "the founder who runs it all," not "the instructor who teaches you."
Drafts are humanized / **dash-free** per the approved voice (see the humanizer skill the client asked us to use).

| Beat | Eyebrow | Headline | Body |
|---|---|---|---|
| L1 (stands) | The person behind SAÏA | Run by Cristina. | SAÏA Mats is run by Cristina, who looks after every hire herself, from your first enquiry to the moment the mats come home. |
| L2 (reaches) | Personal service | Every booking, by hand. | No call centre and no queue. Cristina manages each order personally, so your event is planned with care and nothing slips. |
| L3 (downward dog) | Where we are | Based in NW3. | We're a North London business, delivering across the city, with free pickup from our NW3 warehouse. |
| L4 (low lunge) | Why it matters | Smooth and reliable. | From enquiry to delivery to collection, one person sees it through, so it goes beautifully every time. |
| L5 (seated, CTA) | Start your hire | Let's plan your event. | Tell Cristina what you're planning and she'll take it from there. |

Notes on the drafts:
- Keeps each beat congruent with the figure's movement, but reframed to service/ownership.
- L3 keeps the NW3 map, recaptioned as "where we're based / delivery reach" instead of "where she teaches."
- L5 becomes a **hire CTA**, not a class waitlist (see open decision below).

## 5. Open decisions to confirm before building

1. **The L5 / mobile end form.** It currently captures email "for classes" and (mobile) routes to
   `guest-list.html`. Options: (a) turn it into a **"start a hire" CTA** that jumps to the concierge /
   estimator, (b) keep an email capture but reword to "hear about SAÏA," or (c) hybrid: a hire button
   + a smaller "or join the guest list." **Recommend (c).** Needs Cristina's call.
2. **The NW3 tube-map (L3).** Keep it (recaptioned as home base / delivery) or drop it as too
   Pilates-locational? **Recommend keep, recaption.**
3. **Eyebrows/section labels.** Replace "Fitness / The method / Every body" with the hire-focused
   ones above? **Recommend yes.**
4. **Standalone `pilates-with-cristina.html` + nav links.** Decision was to **leave them**. Confirm
   still true (if she wants them gone later, that's a separate small task: remove 2 nav links + the page).

## 6. Constraints / gotchas

- **Only text nodes change.** Do not alter `data-band` ranges, the canvas/scrub JS, or pose timing,
  or the copy will drift off its pose moment.
- **Copy length affects layout.** Band inners are ~460–520px max-width; keep headlines to ~2 short
  lines and bodies to 1–2 sentences so nothing overflows the pinned band.
- **Mobile copy lives in JS strings** — escape apostrophes/quotes correctly; the mobile bands use
  `<br>` in titles.
- **Accessibility:** keep the form's `aria-label`s and `[data-guest-msg]` live region; keep alt/aria
  on the map SVG. British English, Playfair Display + Inter, palette cream/ink/terracotta.
- **Keep desktop and mobile wording identical in meaning** so the two experiences don't disagree.

## 7. Verify when done

```bash
python3 -m http.server 8000   # open http://localhost:8000/
```
- **Desktop:** scroll slowly through the flow section. Each of the 5 bands should read as
  "the person behind the business," copy still landing on its pose, no overflow. The end card is a
  hire CTA (or agreed hybrid) and submits cleanly.
- **Mobile (≤767px, or DevTools device mode):** the `#mobileJourney` bands + closing CTA show the
  same reframed copy; the CTA still works.
- **Confirm intentionally-kept Pilates:** the concierge still answers Pilates questions, and
  `pilates-with-cristina.html` + its nav links are still there. The *home scroll section* is the only
  place the Pilates framing is gone.