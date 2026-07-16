/* SAÏA — builds a real Shopify cart permalink from a hire object.
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
    root.SAIA.cartPermalink = factory(function () { return root.SAIA.KB; }).cartPermalink;
  }
}(typeof self !== 'undefined' ? self : this, function (KB) {
  function cartPermalink(hire, cfg) {
    hire = hire || {}; cfg = cfg || {};
    var kb = typeof KB === 'function' ? KB() : KB;
    var H = kb.hire;
    var mats = Math.min(H.maxMats, Math.max(H.minMats, parseInt(hire.mats, 10) || 0));
    var days = parseInt(hire.days, 10) || H.hireDays;
    var extraDays = Math.max(0, days - H.hireDays);
    var items = [cfg.matHireVariant + ':' + mats];
    if (extraDays > 0) items.push(cfg.extraDayVariant + ':' + (mats * extraDays));
    items.push(cfg.depositVariant + ':' + mats);
    var attrs = [];
    function attr(k, v) {
      if (v) attrs.push('attributes[' + encodeURIComponent(k) + ']=' + encodeURIComponent(v));
    }
    attr('Event date', hire.date);
    attr('Method', hire.method === 'pickup' ? 'Pickup from NW3' : 'Delivery');
    attr('Postcode', String(hire.postcode || '').toUpperCase() || null);
    var q = kb.quoteLines(hire);
    attr('Delivery estimate', q.deliveryLabel);
    return '/cart/' + items.join(',') + (attrs.length ? '?' + attrs.join('&') : '');
  }
  return { cartPermalink: cartPermalink };
}));
