/* ============================================================
   SAÏA — Home page controller
   Faithful port of the prototype: scroll-driven CSS mat parallax
   ("unroll"), mobile nav drawer, and the Option B concierge
   (ink header, FAQ reply engine — no agentic actions).
   ============================================================ */
(function () {
  /* ---------- mobile nav drawer ---------- */
  const drawer = document.getElementById('mobileDrawer');
  const openDrawer = () => { drawer.style.display = 'block'; };
  const closeDrawer = () => { drawer.style.display = 'none'; };
  document.getElementById('navToggle').addEventListener('click', openDrawer);
  document.getElementById('navClose').addEventListener('click', closeDrawer);
  Array.prototype.slice.call(document.querySelectorAll('[data-drawer-link]')).forEach((a) =>
    a.addEventListener('click', closeDrawer));

  /* ---------- concierge (Option B, FAQ) ---------- */
  const panel = document.getElementById('homeChatPanel');
  const launcher = document.getElementById('homeChatLauncher');
  const thread = document.getElementById('homeThread');
  const input = document.getElementById('homeChatInput');

  const BOT = 'align-self:flex-start; max-width:84%; background:#fff; color:#2B2620; font-size:14px; line-height:1.55; padding:12px 15px; border:1px solid #DAD4C8; border-radius:3px 14px 14px 14px;';
  const USER = 'align-self:flex-end; max-width:84%; background:#B8624A; color:#F5F1E8; font-size:14px; line-height:1.55; padding:12px 15px; border-radius:14px 3px 14px 14px;';
  const TYPING = 'align-self:flex-start; background:#fff; border:1px solid #DAD4C8; padding:13px 16px; border-radius:3px 14px 14px 14px; display:flex; gap:5px;';
  const DOT = 'width:7px; height:7px; border-radius:50%; background:#B8624A;';

  const msgs = [{ from: 'bot', text: 'Welcome to SAÏA London. I can help you plan mat hire for an event, find an upcoming SAÏA experience, or answer a question. Where shall we begin?' }];
  let typing = false, replyTimer = null;

  function el(tag, style, text) { const n = document.createElement(tag); if (style) n.setAttribute('style', style); if (text != null) n.textContent = text; return n; }

  function render() {
    thread.innerHTML = '';
    msgs.forEach((m) => thread.appendChild(el('div', m.from === 'bot' ? BOT : USER, m.text)));
    if (typing) { const tw = el('div', TYPING); [0, .2, .4].forEach((d) => tw.appendChild(el('span', DOT + ' animation:saiaDot 1.2s infinite ' + d + 's;'))); thread.appendChild(tw); }
    thread.scrollTop = thread.scrollHeight;
  }

  function reply(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('which mat') || t.includes('right for me') || t.includes('recommend')) return 'Our signature mat suits every practice — 4mm of natural rubber with a non-slip, anti-odour PU top, 68 × 185 cm. For events we hire it from £8.50 a mat. How many people are you expecting?';
    if (t.includes('how') && (t.includes('hire') || t.includes('work') || t.includes('rent'))) return 'It’s simple: tell us your date and numbers, we deliver the day before your event (min. 10 mats, from £8.50 each for a 2-day hire) and collect once you’re done. Shall I start a quote for you?';
    if (t.includes('price') || t.includes('cost') || t.includes('quote') || t.includes('how much')) return '£8.50 per mat for a 2-day hire, with a minimum of 10. Extra days are £1.50 a mat, plus courier delivery across London. Over 60 mats? I can arrange a reduced rate.';
    if (t.includes('track') || t.includes('order') || t.includes('booking')) return 'Of course — share the email you booked with or your order number and I’ll check the status for you right away.';
    if (t.includes('return') || t.includes('collect') || t.includes('pick')) return 'We collect the mats the day after your event, or you’re welcome to drop them at our NW3 warehouse. No need to clean them — we handle that.';
    if (t.includes('event') || t.includes('community') || t.includes('club')) return 'Lovely — SAÏA hosts monthly experiences for women in London, from brunch clubs to movement mornings. Pop your email in our guest list and I’ll keep you posted.';
    return null; // not a known FAQ → escalate to the Claude assist
  }

  const GENERIC = 'Happy to help with that. Is it about hiring mats for an event, an upcoming SAÏA experience, or an existing booking?';

  // Tier 2 — Claude "Noor" assist for anything the FAQ engine doesn't cover.
  function askAssist() {
    const history = msgs.filter((m) => m.from === 'user' || m.from === 'bot')
      .map((m) => ({ role: m.from === 'user' ? 'user' : 'bot', text: m.text }));
    let done = false;
    const finish = (say) => { if (done) return; done = true; typing = false; msgs.push({ from: 'bot', text: say }); render(); };
    const guard = setTimeout(() => finish(GENERIC), 12000);
    fetch((window.SAIA_CONFIG && window.SAIA_CONFIG.conciergeEndpoint) || 'http://localhost:8787/api/concierge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, hire: null }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d) => { clearTimeout(guard); finish((d && d.say) || GENERIC); })
      .catch(() => { clearTimeout(guard); finish(GENERIC); });
  }

  function send(text) {
    if (!text || !text.trim()) return;
    msgs.push({ from: 'user', text: text.trim() });
    typing = true; render();
    const r = reply(text);
    if (r) {
      clearTimeout(replyTimer);
      replyTimer = setTimeout(() => { typing = false; msgs.push({ from: 'bot', text: r }); render(); }, 1100);
      return;
    }
    askAssist(); // long tail → Claude
  }

  launcher.addEventListener('click', () => { panel.style.display = 'flex'; render(); });
  document.getElementById('homeChatClose').addEventListener('click', () => { panel.style.display = 'none'; });
  document.getElementById('homeChatSend').addEventListener('click', () => { send(input.value); input.value = ''; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send(input.value); input.value = ''; } });
  Array.prototype.slice.call(document.querySelectorAll('.home-chip')).forEach((c) =>
    c.addEventListener('click', () => send(c.getAttribute('data-q'))));

  /* ---- single swappable hire entry point (Shopify rental checkout wires in here later) ---- */
  const NS = (window.SAIA = window.SAIA || {});
  NS.startHire = function () {
    panel.style.display = 'flex';
    render();
    if (input) input.focus();
  };
  Array.prototype.slice.call(document.querySelectorAll('[data-hire-cta]')).forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); NS.startHire(); }));
})();
