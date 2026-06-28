/* SAÏA — Book handoff. Firm-total hires go to the mock checkout page;
   outside-London (quote-only) hires open a pre-filled WhatsApp to Cristina. */
(function () {
  var NS = (window.SAIA = window.SAIA || {});
  NS.bookHire = function (hire) {
    var KB = NS.KB;
    if (!KB || !KB.quoteLines) return;
    var q = KB.quoteLines(hire);
    if (q.quoteOnly) {
      var text = KB.buildWhatsAppText(hire);
      window.open('https://wa.me/447444611914?text=' + encodeURIComponent(text), '_blank');
      return;
    }
    try { sessionStorage.setItem('saia_hire', JSON.stringify(hire)); } catch (e) { /* ignore */ }
    window.location.href = 'checkout.html';
  };
})();
