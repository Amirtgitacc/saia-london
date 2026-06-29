/* SAÏA — mock checkout. Reads the hire handed over from the assistant
   (sessionStorage.saia_hire) and renders a pre-filled, demo-only order. */
(function () {
  var KB = (window.SAIA && window.SAIA.KB) || null;
  var root = document.getElementById('content');
  var money = function (v) { return '£' + Number(v).toFixed(2); };

  var hire = null;
  try { hire = JSON.parse(sessionStorage.getItem('saia_hire') || 'null'); } catch (e) { hire = null; }

  if (!hire || !KB || !KB.hireComplete || !KB.hireComplete(hire)) {
    root.innerHTML = '<div class="card"><p>Let’s build your hire first. Tell the SAÏA assistant your numbers and date and it will bring you back here.</p>' +
      '<p><a class="back" href="index.html">← Start with the assistant</a></p></div>';
    return;
  }

  var q = KB.quoteLines(hire);
  var el = function (tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  // order summary
  var sum = el('div', 'card');
  sum.appendChild(el('h2', null, 'Order summary'));
  var head = (hire.mats || 0) + ' mats · ' + (hire.days || 2) + '-day hire · ' +
    (hire.method === 'pickup' ? 'collect from NW3' : ('delivery ' + String(hire.postcode || '').toUpperCase())) +
    (hire.date ? (' · ' + hire.date) : '');
  sum.appendChild(el('div', 'muted', head));
  q.lines.forEach(function (l) {
    var r = el('div', 'row');
    r.appendChild(el('span', null, l.label + ' <span class="d">' + l.detail + '</span>'));
    r.appendChild(el('span', null, l.value));
    sum.appendChild(r);
  });
  var t = el('div', 'row total');
  t.appendChild(el('span', null, 'Total to pay'));
  t.appendChild(el('span', null, money(q.total)));
  sum.appendChild(t);
  sum.appendChild(el('div', 'muted', money(q.deposit) + ' of that is a refundable deposit, returned after collection.'));
  root.appendChild(sum);

  // details + payment form
  var form = el('div', 'card');
  form.appendChild(el('h2', null, 'Your details'));
  form.innerHTML += '<label>Name *</label><input id="f-name" autocomplete="name">' +
    '<label>Address *</label><input id="f-addr" autocomplete="street-address">' +
    '<label>Email</label><input id="f-email" type="email" autocomplete="email">' +
    '<label>Phone</label><input id="f-phone" type="tel" autocomplete="tel">' +
    '<div class="muted">* required · add an email or phone so we can confirm your booking.</div>' +
    '<h2 style="margin-top:18px">Payment · demo, no real charge</h2>' +
    '<div class="grid"><input placeholder="Card number" inputmode="numeric"><input placeholder="MM/YY"><input placeholder="CVC"></div>';
  var pay = el('button', 'pay', 'Pay ' + money(q.total) + ' →');
  pay.disabled = true;
  form.appendChild(pay);
  root.appendChild(form);

  // success panel
  var ok = el('div', 'ok');
  ok.innerHTML = '<h2>Booking received</h2><p class="muted">Thank you. We\'ll confirm your courier and be in touch shortly. (This is a demo — no payment was taken.)</p>';
  root.appendChild(ok);

  var name = document.getElementById('f-name');
  var addr = document.getElementById('f-addr');
  function check() { pay.disabled = !(name.value.trim() && addr.value.trim()); }
  name.addEventListener('input', check);
  addr.addEventListener('input', check);

  pay.addEventListener('click', function () {
    form.style.display = 'none';
    ok.style.display = 'block';
    try { sessionStorage.removeItem('saia_hire'); } catch (e) { /* ignore */ }
  });
})();
