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
      delivery: 'Same-day Addison Lee courier from our NW3 base, priced by how far your event is from us. Delivery plus same-day collection is £80 for our nearest postcodes (NW, N, W1, W2, W9 to W11 and EC) and £110 across central and inner London; further out we quote per postcode. Or collect from and return to our NW3 base yourself, which is free. It is one or the other: either we handle both journeys or you do. We work to a 6-hour delivery window, so early or morning events are usually delivered the day before.',
      deliveryWindow: 6,                    // hours
      collection: 'We collect on the day of your event, once it has finished and the mats are rolled up, bagged and stacked ready for the courier. Leave a little time to pack up afterwards, as a small charge can apply if the courier is kept waiting. No cleaning needed, we take care of that. You can also drop them back at our NW3 warehouse in working hours.',
      twoDayBasis: 'The hire is charged as a 2-day hire even when the mats are delivered and collected on the same day, because we reserve the mats for you and hold a 6-hour delivery window.',
      overnightStorage: "If your venue can't take a delivery the day before, we can deliver to your office, home or a colleague instead, and you bring the mats over on the day.",
      accessories: 'We hire yoga mats only. We do not offer blocks, bolsters, blankets or any other props.',
      noSale: true,                         // HIRE ONLY — never for sale
      bespoke: 'Studios can commission bespoke mats made to order, in their own colours and branding. That is by enquiry only, by email to Cristina@saialondon.com, and never priced online.',
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
      booking: 'For a 1-2-1, tell me a day or two that suit and I’ll put a request to Cristina, who confirms directly. Group classes run as occasional events. Join the waitlist with your email and you’ll be first to hear when a session opens.',
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
    affiliate: 'We do have an affiliate programme. Email us at Cristina@saialondon.com and we will talk you through the details and set you up personally.',
  };

  /* ---- delivery bands + pricing (single source, lifted from the home estimator) ----
     Banded London courier pricing, matched 1:1 to the Shopify "Courier delivery" product.
     Every band price buys TWO Addison Lee journeys — delivery, then same-day collection
     once the event has finished. This is the ONLY courier option: either we handle both
     legs, or the customer handles both legs by collecting from and returning to NW3
     (free). There is no mixed "we deliver, you return" option.

     The bands come from real Addison Lee Small Van quotes out of NW3 (Aug 2026, inc VAT,
     per single journey — double them for the round trip we actually book):
       A   NW1 £32.70 · W1 £35.88 · N8 £39.00 · EC2 £39.00        → ≤ £78 round trip
       B   SW1 £42.18 · SE1 £45.30 · E8 £45.30 · SW11/W6 £51.67   → ≤ £104 round trip
       C   HA1 £64.27 · TW9 £76.87 · CR0 £83.24 · BR1 £95.84      → £129–£192 round trip
     Band C spans far too wide a range for one honest number, so it is quoted per
     postcode exactly like outside-London rather than priced up front.
     AL also charges for waiting time, which these figures do NOT include.
     Re-quote all four corners whenever AL moves its tariff. */
  KB.delivery = {
    // £ per hire, covering BOTH journeys. Band C is deliberately absent — it is quoted.
    bands: { bandA: 80, bandB: 110 },
    zones: {
      bandA: { key: 'bandA', short: 'Band A', label: 'Band A · Local London' },
      bandB: { key: 'bandB', short: 'Band B', label: 'Band B · Central & inner London' },
      outer: { key: 'outer', short: 'Band C', label: 'Band C · Outer London' },
    },
    /* Districts by area letter → the district numbers that sit in that band. Expressed as
       ranges rather than a flat list of strings so an unusual district (E20, N21, SE28)
       falls through to Band C — quoted — instead of being mispriced or read as non-London. */
    bandADistricts: {
      NW: [1, 2, 3, 5, 6, 8, 10, 11],
      N: [1, 2, 3, 4, 5, 6, 7, 8, 19, 22],
      W: [1, 2, 9, 10, 11],
      EC: [1, 2, 3, 4],
    },
    bandBDistricts: {
      WC: [1, 2],
      SW: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      SE: [1, 3, 5, 8, 10, 11, 13, 14, 15, 16, 17, 21, 22],
      E: [1, 2, 3, 5, 6, 8, 9, 14, 15, 16, 17],
      W: [3, 4, 5, 6, 7, 8, 12, 13, 14],
      N: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      NW: [4, 9],
    },
    london: ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'],
    outerBoroughs: ['BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD'],
  };

  // postcode -> zone object (or null if it can't be read)
  KB.classify = function (raw) {
    var D = KB.delivery;
    var pc = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (pc.length < 2) return null;
    var ow = pc.length > 3 ? pc.slice(0, pc.length - 3) : pc;
    var m = ow.match(/^([A-Z]{1,2})(\d{1,2})?/);
    if (!m) return null;
    var area = m[1], n = m[2] ? parseInt(m[2], 10) : null;
    function inBand(map) {
      var list = map[area];
      return !!(list && n !== null && list.indexOf(n) !== -1);
    }
    if (inBand(D.bandADistricts)) return D.zones.bandA;
    if (inBand(D.bandBDistricts)) return D.zones.bandB;
    if (D.london.indexOf(area) !== -1 || D.outerBoroughs.indexOf(area) !== -1) return D.zones.outer;
    return { key: 'outside', label: 'outside' };
  };

  /* ---- booking dates ----------------------------------------------------------
     Every booking carries four dates. The customer enters ONE (the event date);
     the other three are derived, so there is nothing extra to ask for.
       booking    = the day the order was placed
       event      = what the customer told us (the START of the event)
       delivery   = the day before the event (our 2-day hire basis)
       collection = the event day, plus any extra days beyond the 2-day base
     All maths runs on the Y/M/D parts as plain integers. Do NOT round-trip these
     through Date.toISOString(): a London date near a clock change slips by a day. */
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // 'YYYY-MM-DD' + n days -> 'YYYY-MM-DD'. Uses UTC internally so no DST shift is possible.
  function shiftISO(iso, n) {
    var m = ISO_RE.exec(iso || '');
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    d.setUTCDate(d.getUTCDate() + n);
    var mm = d.getUTCMonth() + 1, dd = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }

  KB.todayISO = function () {
    // 'en-CA' formats as YYYY-MM-DD; the timeZone keeps it a London date, not a UTC one.
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  };

  /* Two brains write hire.date in two shapes: the estimator's <input type="date"> gives
     ISO, while the concierge stores "16 July 2026" (planner.js, and the Tier-2 prompt
     orders DAY MONTH YEAR). Accept both, and formatDate's own "Thu 16 July 2026" output
     so a date can round-trip. Anything vague ("Saturday", "next month") stays null on
     purpose: a booking must never invent a day. */
  var MONTH_FULL = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  var DMY_RE = /^(?:[a-z]{3,9}\s+)?(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i;

  KB.toISODate = function (s) {
    var str = String(s == null ? '' : s).trim();
    if (ISO_RE.test(str)) return str;
    var m = DMY_RE.exec(str);
    if (!m) return null;
    var name = m[2].toLowerCase();
    var mi = -1;
    for (var i = 0; i < 12; i++) {
      if (MONTH_FULL[i] === name || MONTH_FULL[i].slice(0, 3) === name) { mi = i; break; }
    }
    if (mi < 0) return null;
    var day = parseInt(m[1], 10);
    var year = parseInt(m[3], 10);
    var d = new Date(Date.UTC(year, mi, day));
    // rejects impossible days ("32 July") that Date would otherwise roll into next month
    if (d.getUTCDate() !== day || d.getUTCMonth() !== mi || d.getUTCFullYear() !== year) return null;
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return year + '-' + p2(mi + 1) + '-' + p2(day);
  };

  KB.deriveDates = function (hire, todayISO) {
    hire = hire || {};
    var event = KB.toISODate(hire.date);
    if (!event) return null;
    var days = Math.max(KB.hire.hireDays, parseInt(hire.days, 10) || KB.hire.hireDays);
    return {
      booking: ISO_RE.test(String(todayISO || '')) ? todayISO : KB.todayISO(),
      event: event,
      delivery: shiftISO(event, -1),
      collection: shiftISO(event, days - KB.hire.hireDays),
    };
  };

  KB.formatDate = function (iso) {
    var m = ISO_RE.exec(iso || '');
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return DAY_NAMES[d.getUTCDay()] + ' ' + (+m[3]) + ' ' + MONTH_NAMES[+m[2] - 1] + ' ' + m[1];
  };

  KB.dateLabels = function (hire) {
    return (hire && hire.method === 'pickup')
      ? { delivery: 'Pickup from NW3', collection: 'Return to NW3' }
      : { delivery: 'Delivery date', collection: 'Collection date' };
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

    // Delivery is symmetric: we do both legs (banded London price) or the customer does
    // both legs (free NW3 pickup). hire.collection is legacy and deliberately ignored — an
    // old sessionStorage hire carrying collection:'one' must not resurrect a £45 price.
    // Band C (outer London) and outside London are both quoted, never priced here.
    var deliveryCost = null, deliveryLabel = null, quoteOnly = false;
    if (hire.method === 'pickup') {
      deliveryCost = 0; deliveryLabel = 'Pickup from NW3 · free';
    } else if (hire.zone === 'outside') {
      deliveryCost = null; deliveryLabel = 'Courier · by quote'; quoteOnly = true;
    } else if (hire.zone === 'outer') {
      deliveryCost = null; deliveryLabel = 'Courier · outer London · by quote'; quoteOnly = true;
    } else if (KB.delivery.bands[hire.zone] != null) {
      deliveryCost = KB.delivery.bands[hire.zone];
      deliveryLabel = 'Courier · delivery + same-day collection · '
        + KB.delivery.zones[hire.zone].short;
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
        label: 'Delivery & collection',
        detail: q.deliveryLabel,
        value: q.deliveryCost == null ? 'confirmed by us' : (q.deliveryCost === 0 ? 'free' : money(q.deliveryCost)),
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
    return 'Hi! I would like to book ' + mats + ' mats for ' + days + ' days, ' + loc +
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
    '- ONE exception to hire-only: studios can commission BESPOKE mats made to order. ' + KB.hire.bespoke + ' Never quote a price for bespoke mats, and never invent one.',
    '- ' + KB.hire.currency + KB.hire.pricePerMat.toFixed(2) + ' per mat for a ' + KB.hire.hireDays + '-day hire (the day before the event through the end of it).',
    '- Minimum ' + KB.hire.minMats + ' mats. Maximum ' + KB.hire.maxMats + ' (our current stock). Extra days are ' + KB.hire.currency + KB.hire.extraDayPerMat.toFixed(2) + ' per mat per day.',
    '- If someone needs more than ' + KB.hire.maxMats + ' mats, ask whether their classes run in staggered sessions (the same ' + KB.hire.maxMats + ' can be reused between groups). If everyone needs a mat at the same time, we cannot go beyond ' + KB.hire.maxMats + '. Never book past ' + KB.hire.maxMats + '.',
    '- A ' + KB.hire.currency + KB.hire.depositPerMat.toFixed(2) + ' per mat REFUNDABLE deposit is taken upfront and returned once the mats come back. It is not a hire cost.',
    '- Delivery: ' + KB.hire.delivery,
    '- Delivery is symmetric, and there are only two options: our courier does BOTH journeys (delivery plus same-day collection), or the customer does both journeys by collecting from and returning to NW3, which is free. There is no mixed option where we deliver and they return the mats.',
    '- Courier price depends on the postcode, and covers both journeys: ' + KB.hire.currency + KB.delivery.bands.bandA + ' for our nearest areas (NW1-3, NW5, NW6, NW8, NW10, NW11, N1-N8, N19, N22, W1, W2, W9-W11, EC1-EC4) and ' + KB.hire.currency + KB.delivery.bands.bandB + ' across central and inner London (WC, SW1-SW11, most of SE and E, W3-W14, N9-N18, NW4, NW9). Outer London and anywhere outside London are QUOTED per postcode, never priced up front — say we will confirm the courier and never invent a number.',
    '- Collection: ' + KB.hire.collection,
    '- Two-day basis: ' + KB.hire.twoDayBasis,
    '- Overnight storage: ' + KB.hire.overnightStorage,
    '- Accessories: ' + KB.hire.accessories,
    '- The mat: ' + KB.hire.mat.size + ', ' + KB.hire.mat.colour + ', ' + KB.hire.mat.material + '; ' + KB.hire.mat.features + '. (Retail value ~' + KB.hire.currency + KB.hire.retailReference + ' each, for reference only, still hire-only.)',
    '- Booking/urgent: email us at ' + KB.contact.email + '. Pickup at ' + KB.contact.pickup + '.',
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
    '- Email us: ' + KB.contact.email + ' · Instagram ' + KB.contact.social.instagram + ' · ' + KB.contact.area + ' (' + KB.contact.pickup + ').',
  ].join('\n');

  return KB;
});
