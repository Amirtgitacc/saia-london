/* ============================================================
   SAÏA — shared knowledge base (single source of truth)
   Read by BOTH brains so they can never drift:
     • Tier 1 (planner.js)   — scripted, deterministic replies
     • Tier 2 (server.js)    — injected into the assistant system prompt
   Dual-mode: attaches to window.SAIA.KB in the browser and
   exports for Node (require) on the server.
   Facts sourced from the live saialondon.com (2026-06-20).
   PRIORITY ORDER: mat hire → community → yoga/Pilates.
   ============================================================ */
(function (root, factory) {
  var KB = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = KB;
  if (typeof window !== 'undefined') { (window.SAIA = window.SAIA || {}).KB = KB; }
})(this, function () {
  var KB = {
    /* ---- contact (one channel, one person) ---- */
    contact: {
      email: 'Cristina@saialondon.com',     // primary contact for hires + bookings
      whatsapp: '07444 611 914',           // Cristina — kept for booking handoffs only
      person: 'Cristina',
      area: 'London',
      pickup: 'NW3 (North London) warehouse, working hours only',
      forms: 'contact form on saialondon.com',
      social: { instagram: '@saialondon', facebook: 'saialondon', pinterest: 'saialondon' },
    },

    /* ---- PRIORITY #1 — MAT HIRE ---- */
    hire: {
      pricePerMat: 8.5,                     // £ per mat, 2-day hire
      currency: '£',
      hireDays: 2,                          // day before the event → end of event
      minMats: 10,
      extraDayPerMat: 1.5,                  // £ per mat per additional day
      depositPerMat: 1.5,                   // £ per mat, REFUNDABLE — returned after mats come back
      depositRefundable: true,
      maxMats: 50,                          // hard ceiling: our current stock
      delivery: 'Same-day Addison Lee courier from our NW3 base — £90 flat across London for delivery plus same-day collection after your event (the usual choice), or £45 delivery-only if you bring the mats back to NW3 yourself. Free if you pick up and return from NW3. We work to a 6-hour delivery window, so early or morning events are usually delivered the day before.',
      deliveryWindow: 6,                    // hours
      collection: 'We collect on the day of your event, once it has finished and the mats are rolled up, bagged and stacked ready for the courier. Leave a little time to pack up afterwards, as a small charge can apply if the courier is kept waiting. No cleaning needed, we take care of that. You can also drop them back at our NW3 warehouse in working hours.',
      twoDayBasis: 'The hire is charged as a 2-day hire even when the mats are delivered and collected on the same day, because we reserve the mats for you and hold a 6-hour delivery window.',
      overnightStorage: "If your venue can't take a delivery the day before, we can deliver to your office, home or a colleague instead, and you bring the mats over on the day.",
      accessories: 'We hire yoga mats only. We do not offer blocks, bolsters, blankets or any other props.',
      noSale: true,                         // HIRE ONLY — never for sale
      retailReference: 79,                  // £ retail value, reference only (not for sale)
      mat: {
        size: '68 × 185 cm, 4 mm thick',
        colour: 'black',
        material: 'ethically sourced, premium all-natural rubber base with a PU surface',
        features: 'non-slip, anti-odour, non-toxic and PVC-free',
      },
      tagline: 'If you are looking to organise a wellness event, you have landed in the right place.',
    },

    /* ---- PRIORITY #2 — COMMUNITY / THE CLUB ---- */
    club: {
      what: 'A female-led lifestyle brand empowering women through Fitness, Community and Mindset.',
      ethos: 'A SAÏA woman is not afraid to speak her truth, and is someone who inspires and lifts up other women.',
      join: 'Free guest list. Share your email to hear about upcoming experiences.',
      taglines: ['The SAÏA Club', 'Join the SAÏA Community'],
    },

    /* ---- PRIORITY #3 — YOGA / PILATES ---- */
    pilates: {
      instructor: 'Cristina',
      method: 'Classical Pilates and Reformer: small, slow and breath-led, drawn from Joseph Pilates’ Contrology. Pilates for women, every level; Cristina meets you where you are.',
      format: '1-2-1 classes in NW3 and group classes in Hampstead, London.',
      booking: 'For a 1-2-1, tell me a day or two that suit and I’ll put a request to Cristina, who confirms directly. Group classes run as occasional events — join the waitlist with your email and you’ll be first to hear when a session opens.',
    },

    /* ---- FOUNDER ---- */
    founder: {
      name: 'Cristina',
      bio: 'Cristina is an English-Mexican entrepreneur in London and an advocate for female empowerment. She founded SAÏA in 2020, starting with yoga mats and bags, then created the monthly SAÏA Brunch Club and grew it into dinner parties, book clubs and 5k runs in Hyde Park, and she attends every event herself.',
      meaning: 'SAÏA means “A Woman Who Wins”, inspired by her great-grandmother Calandita, a Mexican farm worker who sold a cow to finance her escape from farm life. Cristina credits her courage and self-belief.',
    },

    /* ---- EVENTS (recent SAÏA experiences) ---- */
    events: [
      'SAÏA Brunch Club at Mortimer House',
      'Watercolour Painting in Regent’s Park',
      'SAÏA Book Club & Afternoon Tea at Petersham Nurseries',
      'Talk & Bottomless Brunch with Self Love London',
      'Brunch Club at The Nest with Pilates by Riya',
    ],

    /* ---- PARTNERSHIPS (small business — measured, personal) ---- */
    collab: "We love supporting other businesses, but as a small business ourselves we're not taking on collaborations right now. If you'd like to create content featuring our mats, tag @saialondon and send it over, and we're happy to offer a 10% refund once we've received the agreed content.",
    affiliate: "We do have an affiliate programme. Email Cristina at Cristina@saialondon.com and she'll talk you through the details and set you up personally.",
  };

  /* ---- delivery zones + pricing (single source, lifted from the home estimator) ----
     Flat London courier pricing, matched 1:1 to the Shopify "Courier delivery" product:
       twoWay £90 = delivery + same-day collection (the DEFAULT — always ask, default to this)
       oneWay £45 = delivery only, customer returns the mats to NW3 themselves
     Zones only decide the label and the outside-London → quote-by-WhatsApp case now. */
  KB.delivery = {
    twoWay: 90,
    oneWay: 45,
    zones: {
      central: { key: 'central', label: 'Zone 1 · Central London' },
      greater: { key: 'greater', label: 'Zone 2 · Greater London' },
    },
    central: ['EC1', 'EC2', 'EC3', 'EC4', 'WC1', 'WC2', 'W1', 'SW1', 'SE1', 'N1', 'NW1', 'E1', 'W2'],
    london: ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'],
    outer: ['BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD'],
  };

  // postcode -> zone object (or null if it can't be read)
  KB.classify = function (raw) {
    var D = KB.delivery;
    var pc = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (pc.length < 2) return null;
    var ow = pc.length > 3 ? pc.slice(0, pc.length - 3) : pc;
    var m = ow.match(/^([A-Z]{1,2})(\d{1,2})?/);
    if (!m) return null;
    var area = m[1], key = area + (m[2] ? m[2] : '');
    if (D.central.indexOf(key) !== -1) return D.zones.central;
    if (D.london.indexOf(area) !== -1 || D.outer.indexOf(area) !== -1) return D.zones.greater;
    return { key: 'outside', label: 'outside' };
  };

  // full hire price — the ONE place totals are computed
  KB.priceHire = function (hire) {
    var H = KB.hire;
    hire = hire || {};
    // clamp once here so displayed prices always equal charged prices — matches the
    // cart's own clamp (js/shopify-cart.js) so estimator/quote/WhatsApp/checkout agree.
    var mats = Math.min(H.maxMats, Math.max(H.minMats, parseInt(hire.mats, 10) || 0));
    var days = parseInt(hire.days, 10) || H.hireDays;
    var matCost = mats * H.pricePerMat + mats * H.extraDayPerMat * Math.max(0, days - H.hireDays);
    var deposit = mats * H.depositPerMat;

    // collection: 'two' = courier both ways (DEFAULT), 'one' = delivery only, they return the mats
    var oneWay = hire.collection === 'one';
    var deliveryCost = null, deliveryLabel = null, quoteOnly = false;
    if (hire.method === 'pickup') {
      deliveryCost = 0; deliveryLabel = 'Pickup from NW3 · free';
    } else if (hire.zone === 'outside') {
      deliveryCost = null; deliveryLabel = 'Courier · by quote'; quoteOnly = true;
    } else if (hire.zone === 'central' || hire.zone === 'greater') {
      deliveryCost = oneWay ? KB.delivery.oneWay : KB.delivery.twoWay;
      deliveryLabel = (oneWay ? 'Courier · delivery only, you return the mats' : 'Courier · delivery + same-day collection')
        + ' · ' + (hire.zone === 'central' ? 'Central London' : 'Greater London');
    }

    var total = (deliveryCost == null) ? null : matCost + deliveryCost + deposit;
    return { matCost: matCost, deliveryCost: deliveryCost, deliveryLabel: deliveryLabel, deposit: deposit, total: total, quoteOnly: quoteOnly };
  };

  // is the hire ready to quote/book? (all required slots collected)
  KB.hireComplete = function (hire) {
    hire = hire || {};
    var H = KB.hire;
    var mats = parseInt(hire.mats, 10) || 0;
    var days = parseInt(hire.days, 10) || 0;
    if (mats < H.minMats) return false;
    if (days < H.hireDays) return false;
    if (hire.method === 'pickup') { /* no zone needed */ }
    else if (hire.method === 'deliver') { if (!hire.zone) return false; }
    else return false;
    if (!hire.date) return false;
    return true;
  };

  // itemised display rows for the quote card + checkout page (built from priceHire)
  KB.quoteLines = function (hire) {
    var H = KB.hire;
    hire = hire || {};
    var q = KB.priceHire(hire);
    var mats = Math.min(H.maxMats, Math.max(H.minMats, parseInt(hire.mats, 10) || 0));
    var days = parseInt(hire.days, 10) || H.hireDays;
    var money = function (v) { return H.currency + Number(v).toFixed(2); };
    var lines = [];
    lines.push({ label: 'Mats (' + H.hireDays + '-day hire)', detail: mats + ' × ' + money(H.pricePerMat), value: money(mats * H.pricePerMat) });
    if (days > H.hireDays) {
      lines.push({ label: 'Extra days', detail: mats + ' × ' + money(H.extraDayPerMat) + ' × ' + (days - H.hireDays), value: money(mats * H.extraDayPerMat * (days - H.hireDays)) });
    }
    if (q.deliveryLabel) {
      lines.push({
        label: hire.collection === 'one' ? 'Delivery only' : 'Delivery & collection',
        detail: q.deliveryLabel,
        value: q.deliveryCost == null ? 'confirmed by Cristina' : (q.deliveryCost === 0 ? 'free' : money(q.deliveryCost)),
      });
    }
    lines.push({ label: 'Refundable deposit', detail: mats + ' × ' + money(H.depositPerMat), value: money(q.deposit) });
    return { lines: lines, total: q.total, subtotal: q.matCost + q.deposit, deposit: q.deposit, quoteOnly: q.quoteOnly, deliveryLabel: q.deliveryLabel };
  };

  // a pre-filled WhatsApp enquiry for hires we can't price firmly (outside London)
  KB.buildWhatsAppText = function (hire) {
    var H = KB.hire;
    hire = hire || {};
    var q = KB.quoteLines(hire);
    var money = function (v) { return H.currency + Number(v).toFixed(2); };
    var mats = Math.min(H.maxMats, Math.max(H.minMats, parseInt(hire.mats, 10) || 0));
    var days = parseInt(hire.days, 10) || H.hireDays;
    var loc = hire.method === 'pickup' ? 'collecting from NW3' : ('delivery to ' + String(hire.postcode || '').toUpperCase());
    var sum = q.total != null ? (money(q.total) + ' total') : (money(q.subtotal) + ' plus courier to confirm');
    return 'Hi Cristina! I would like to book ' + mats + ' mats for ' + days + ' days, ' + loc +
      (hire.date ? (', on ' + hire.date) : '') + '. ' + sum + '. Please confirm availability.';
  };

  /* A compact markdown fact-sheet for the Tier-2 system prompt.
     Built from the structured fields above so it can never disagree. */
  KB.factSheet = [
    '## SAÏA LONDON: what you (the SAÏA assistant) know',
    '',
    'SAÏA is ' + KB.club.what + ' ' + KB.founder.meaning,
    '',
    '### Mat hire (your #1 priority: this is what most people want)',
    '- Mats are for HIRE ONLY. Never for sale.',
    '- ' + KB.hire.currency + KB.hire.pricePerMat.toFixed(2) + ' per mat for a ' + KB.hire.hireDays + '-day hire (the day before the event through the end of it).',
    '- Minimum ' + KB.hire.minMats + ' mats. Maximum ' + KB.hire.maxMats + ' (our current stock). Extra days are ' + KB.hire.currency + KB.hire.extraDayPerMat.toFixed(2) + ' per mat per day.',
    '- If someone needs more than ' + KB.hire.maxMats + ' mats, ask whether their classes run in staggered sessions (the same ' + KB.hire.maxMats + ' can be reused between groups). If everyone needs a mat at the same time, we cannot go beyond ' + KB.hire.maxMats + '. Never book past ' + KB.hire.maxMats + '.',
    '- A ' + KB.hire.currency + KB.hire.depositPerMat.toFixed(2) + ' per mat REFUNDABLE deposit is taken upfront and returned once the mats come back. It is not a hire cost.',
    '- Delivery: ' + KB.hire.delivery,
    '- Delivery choices (always ask which they want before quoting a delivery): courier BOTH ways at ' + KB.hire.currency + KB.delivery.twoWay + ' (delivery + same-day collection — the default, and what most people want), or delivery-only at ' + KB.hire.currency + KB.delivery.oneWay + ' if they will return the mats to NW3 themselves. NW3 pickup is free. Outside London is quoted by Cristina.',
    '- Collection: ' + KB.hire.collection,
    '- Two-day basis: ' + KB.hire.twoDayBasis,
    '- Overnight storage: ' + KB.hire.overnightStorage,
    '- Accessories: ' + KB.hire.accessories,
    '- The mat: ' + KB.hire.mat.size + ', ' + KB.hire.mat.colour + ', ' + KB.hire.mat.material + '; ' + KB.hire.mat.features + '. (Retail value ~' + KB.hire.currency + KB.hire.retailReference + ' each, for reference only, still hire-only.)',
    '- Booking/urgent: email ' + KB.contact.person + ' at ' + KB.contact.email + '. Pickup at ' + KB.contact.pickup + '.',
    '',
    '### Community / the club (#2)',
    '- ' + KB.club.ethos,
    '- Joining: ' + KB.club.join,
    '- Recent experiences: ' + KB.events.join('; ') + '.',
    '',
    '### Yoga / Pilates with Cristina (#3)',
    '- ' + KB.pilates.method + ' ' + KB.pilates.format,
    '- Booking: ' + KB.pilates.booking,
    '',
    '### Founder',
    '- ' + KB.founder.bio,
    '',
    '### Partnerships',
    '- Collaborations: ' + KB.collab,
    '- Affiliates: ' + KB.affiliate,
    '',
    '### Contact',
    '- Email ' + KB.contact.person + ': ' + KB.contact.email + ' · Instagram ' + KB.contact.social.instagram + ' · ' + KB.contact.area + ' (' + KB.contact.pickup + ').',
  ].join('\n');

  return KB;
});
