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
    var pairs = [];
    function attr(k, v) {
      if (v) pairs.push([k, v]);
    }
    attr('Event date', hire.date);
    attr('Method', hire.method === 'pickup' ? 'Pickup from NW3' : 'Delivery');
    attr('Postcode', String(hire.postcode || '').toUpperCase() || null);
    var q = kb.quoteLines(hire);
    attr('Delivery estimate', q.deliveryLabel);
    return { lines: lines, attrPairs: pairs };
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

  return { cartPermalink: cartPermalink, cartPayload: cartPayload };
}));
