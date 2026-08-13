/* SAÏA — Book handoff. Firm-total hires go to the mock checkout page;
   outside-London (quote-only) hires open a pre-filled WhatsApp to Cristina. */
(function () {
  var NS = (window.SAIA = window.SAIA || {});
  NS.bookHire = function (hire) {
    var KB = NS.KB;
    if (!KB || !KB.quoteLines) return;
    var q = KB.quoteLines(hire);
    var cfg = window.SAIA_CONFIG || {};
    // Two ways a hire cannot go through the cart:
    //   quoteOnly       — Band C / outside London, priced by us on purpose
    //   courierMissing  — a PRICED band whose Shopify courier variant is not configured,
    //                     so the cart would silently drop the delivery charge we quoted
    // Both take the same route: a pre-filled WhatsApp quote, never a cart.
    var courierMissing = NS.cartCourierMissing ? NS.cartCourierMissing(hire, cfg) : false;
    if (q.quoteOnly || courierMissing) {
      var text = KB.buildWhatsAppText(hire);
      window.open('https://wa.me/447444611914?text=' + encodeURIComponent(text), '_blank');
      return;
    }
    try { sessionStorage.setItem('saia_hire', JSON.stringify(hire)); } catch (e) { /* ignore */ }
    if (cfg.matHireVariant && cfg.depositVariant && NS.cartPermalink) {
      // AJAX cart build: land the customer on the on-brand /cart page (deposit note,
      // "delivery confirmed by Cristina" messaging, qty clamp backstop) instead of a
      // /cart/{variant}:{qty} permalink, which 302s straight into Shop Pay accelerated
      // checkout on the live store and skips all of that.
      var toPermalink = function () { window.location.href = NS.cartPermalink(hire, cfg); };
      if (!NS.cartPayload) { toPermalink(); return; }
      var payload = NS.cartPayload(hire, cfg);
      fetch('/cart/clear.js', { method: 'POST' })
        .then(function (res) { if (!res.ok) throw new Error('clear failed'); return res; })
        .then(function () {
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payload.items })
          });
        })
        .then(function (res) { if (!res.ok) throw new Error('add.js failed'); return res; })
        .then(function () {
          return fetch('/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attributes: payload.attributes })
          });
        })
        .then(function (res) { if (!res.ok) throw new Error('update.js failed'); })
        .then(function () { window.location.href = '/cart'; })
        .catch(toPermalink);          // any failure → still completes a purchase, just without the cart page
      return;
    }
    window.location.href = 'checkout.html';                 // local/Vercel demo
  };
})();
