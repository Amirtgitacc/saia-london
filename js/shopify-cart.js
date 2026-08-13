/* SAÏA — builds a real Shopify cart (permalink or AJAX-cart payload) from a hire object.
   Line quantities: mats (2-day hire) + mats×extraDays (extra day) + mats (deposit).
   Never computes a price — Shopify's own line prices do the money. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./saia-knowledge.js'));
  } else {
    root.SAIA = root.SAIA || {};
    // Resolve KB lazily at call time (not at load time) — shopify-cart.js may load
    // before saia-knowledge.js sets window.SAIA.KB, so capturing it here would freeze
    // it at undefined.
    var mod = factory(function () { return root.SAIA.KB; });
    root.SAIA.cartPermalink = mod.cartPermalink;
    root.SAIA.cartPayload = mod.cartPayload;
    root.SAIA.cartCourierMissing = mod.cartCourierMissing;
  }
}(typeof self !== 'undefined' ? self : this, function (KB) {
  // Shared core: clamps mats/days, builds the mat/extra-day/deposit lines and the
  // attribute list once. cartPermalink() and cartPayload() just map the same result
  // into their own shapes — no duplicated math.
  function buildCart(hire, cfg) {
    hire = hire || {}; cfg = cfg || {};
    var kb = typeof KB === 'function' ? KB() : KB;
    var H = kb.hire;
    var mats = Math.min(H.maxMats, Math.max(H.minMats, parseInt(hire.mats, 10) || 0));
    var days = parseInt(hire.days, 10) || H.hireDays;
    var extraDays = Math.max(0, days - H.hireDays);
    var lines = [{ variant: cfg.matHireVariant, qty: mats }];
    if (extraDays > 0) lines.push({ variant: cfg.extraDayVariant, qty: mats * extraDays });
    lines.push({ variant: cfg.depositVariant, qty: mats });
    // courier as a REAL cart line (priced by its Shopify variant), so the delivery the
    // guest chose in the estimator/assistant is in the total before checkout — the
    // checkout shipping rate is then the free "already included" one (weight-gated).
    // One variant per priced band; both cover BOTH legs. hire.collection is legacy and
    // ignored, so a stale session can never resurrect the deleted one-way variant.
    // Band C (zone 'outer') and outside London have no variant on purpose — they are
    // quoted, so their carts carry no courier line and fall to the paid checkout rate.
    var courierVariant = { bandA: cfg.courierBandAVariant, bandB: cfg.courierBandBVariant }[hire.zone];
    // A PRICED band (A/B) whose variant is not configured must never quietly produce a
    // courier-free cart: the guest would pay nothing for delivery we just quoted them,
    // and the 0g cart would fall through to the paid fallback shipping rate. Flag it and
    // let checkout-handoff.js route the booking to the WhatsApp quote instead — the same
    // path Band C already takes. Band C/outside are quote-only BY DESIGN, so they are not
    // "missing" anything and must not trip this.
    var bands = (kb.delivery && kb.delivery.bands) || {};
    var courierMissing = hire.method !== 'pickup' && bands[hire.zone] != null && !courierVariant;
    if (hire.method !== 'pickup' && courierVariant) {
      lines.push({ variant: courierVariant, qty: 1 });
    }
    // pickup hires weigh 0g without a plumbing line, which wrongly shows the paid
    // fallback shipping rate (weight-gated checkout) — this hidden £0 variant
    // gives pickup carts the same 1kg signal the courier line gives delivery carts.
    if (hire.method === 'pickup' && cfg.pickupVariant) lines.push({ variant: cfg.pickupVariant, qty: 1 });

    var pairs = [];
    function attr(k, v) {
      if (v) pairs.push([k, v]);
    }
    // four dates on every booking: one asked for, three derived (js/saia-knowledge.js)
    var dates = kb.deriveDates ? kb.deriveDates(hire, cfg.todayISO) : null;
    var labels = kb.dateLabels ? kb.dateLabels(hire) : { delivery: 'Delivery date', collection: 'Collection date' };
    if (dates) {
      attr('Booking date', kb.formatDate(dates.booking));
      attr('Event date', kb.formatDate(dates.event));
      attr(labels.delivery, kb.formatDate(dates.delivery));
      attr(labels.collection, kb.formatDate(dates.collection));
    } else {
      attr('Event date', hire.date);   // free-text date ("Saturday") — pass it through as given
    }
    attr('Method', hire.method === 'pickup' ? 'Pickup from NW3' : 'Delivery');
    attr('Postcode', String(hire.postcode || '').toUpperCase() || null);
    var q = kb.quoteLines(hire);
    attr('Delivery estimate', q.deliveryLabel);
    return { lines: lines, attrPairs: pairs, courierMissing: courierMissing };
  }

  // "Is this hire unsellable through the cart?" — true when the band has a price we
  // quoted but no Shopify variant to charge it with. Callers route these to the quote.
  function cartCourierMissing(hire, cfg) {
    return buildCart(hire, cfg).courierMissing;
  }

  function cartPermalink(hire, cfg) {
    var built = buildCart(hire, cfg);
    var items = built.lines.map(function (l) { return l.variant + ':' + l.qty; });
    var attrs = built.attrPairs.map(function (p) {
      return 'attributes[' + encodeURIComponent(p[0]) + ']=' + encodeURIComponent(p[1]);
    });
    return '/cart/' + items.join(',') + (attrs.length ? '?' + attrs.join('&') : '');
  }

  function cartPayload(hire, cfg) {
    var built = buildCart(hire, cfg);
    var items = built.lines.map(function (l) { return { id: Number(l.variant), quantity: l.qty }; });
    var attributes = {};
    built.attrPairs.forEach(function (p) { attributes[p[0]] = p[1]; });
    return { items: items, attributes: attributes };
  }

  return { cartPermalink: cartPermalink, cartPayload: cartPayload, cartCourierMissing: cartCourierMissing };
}));
