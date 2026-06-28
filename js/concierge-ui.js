/* ============================================================
   SAÏA — agentic concierge UI (shared: Journey + Hero)
   Renders the message thread, typing indicator and action pills,
   drives the local planner, and mutates the live hire panel —
   faithful to the prototype's send() flow.
   Exposed as window.SAIA.createAgenticConcierge
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});

  function el(tag, style, text) {
    const n = document.createElement(tag);
    if (style) n.setAttribute('style', style);
    if (text != null) n.textContent = text;
    return n;
  }

  const BOT = 'align-self:flex-start; max-width:88%; background:#fff; color:#2B2620; font-size:13.5px; line-height:1.55; padding:11px 14px; border:1px solid #ECE7DC; border-radius:3px 13px 13px 13px; animation:saiaMsgIn .3s ease both;';
  const USER = 'align-self:flex-end; max-width:88%; background:#2B2620; color:#F5F1E8; font-size:13.5px; line-height:1.55; padding:11px 14px; border-radius:13px 3px 13px 13px; animation:saiaMsgIn .3s ease both;';
  const ACT = 'align-self:flex-start; max-width:90%; display:flex; gap:8px; align-items:center; font-size:12px; color:#6B6358; padding:2px; animation:saiaMsgIn .3s ease both;';
  const TYPING = 'align-self:flex-start; background:#fff; border:1px solid #ECE7DC; padding:12px 15px; border-radius:3px 13px 13px 13px; display:flex; gap:5px;';
  const DOT = 'width:6px; height:6px; border-radius:50%; background:#B8624A;';

  NS.createAgenticConcierge = function (opts) {
    const Planner = NS.Planner;
    const state = {
      msgs: [],
      typing: false,
      hire: { mats: 0, guests: null, date: null, days: null, method: null, postcode: null, zone: null, total: null, deposit: null, status: 'No hire yet', awaiting: null },
    };
    let replyTimer = null, greeted = false;

    function renderThread() {
      const t = opts.threadEl; if (!t) return;
      t.innerHTML = '';
      state.msgs.forEach((m) => {
        if (m.from === 'bot') { t.appendChild(el('div', BOT, m.text)); }
        else if (m.from === 'user') { t.appendChild(el('div', USER, m.text)); }
        else if (m.from === 'act') {
          const wrap = el('div', ACT);
          const badge = el('span', 'width:18px; height:18px; border-radius:50%; background:#E9C3B6; color:#7A3F2E; display:flex; align-items:center; justify-content:center; font-size:11px; flex:none;', '✓');
          const txt = el('span', 'font-style:italic;', m.text);
          wrap.appendChild(badge); wrap.appendChild(txt); t.appendChild(wrap);
        }
      });
      if (state.typing) {
        const tw = el('div', TYPING);
        [0, .2, .4].forEach((d) => tw.appendChild(el('span', DOT + ' animation:saiaDot 1.2s infinite ' + d + 's;')));
        t.appendChild(tw);
      }
      t.scrollTop = t.scrollHeight;
    }

    function renderHire() {
      const h = state.hire, v = opts.hireValueEls || {};
      const complete = !!(NS.KB && NS.KB.hireComplete && NS.KB.hireComplete(h));
      const q = complete && NS.KB.quoteLines ? NS.KB.quoteLines(h) : null;   // total/deposit from the single source
      if (v.mats) v.mats.textContent = String(h.mats || 0);
      if (v.date) v.date.textContent = h.date || 'No date';
      // priced chips appear only when the hire is complete
      if (v.total) {
        const showTotal = !!(q && q.total != null);
        v.total.textContent = showTotal ? '£' + q.total.toFixed(2) : '£—';
        v.total.style.display = showTotal ? '' : 'none';
      }
      if (v.deposit) {
        const showDep = !!(q && q.deposit != null);
        v.deposit.textContent = showDep ? '+£' + q.deposit.toFixed(2) + ' deposit (refundable)' : '';
        v.deposit.style.display = showDep ? '' : 'none';
      }
      if (v.status) v.status.textContent = complete ? (q && q.quoteOnly ? 'Ready — confirm with Cristina' : 'Ready to book') : (h.mats ? 'Collecting your details…' : h.status);
      const bookEl = opts.bookEl || document.querySelector('[data-hire-book]');
      if (bookEl) bookEl.style.display = complete ? '' : 'none';
    }

    function flashHire() {
      const e = opts.hireFlashEl; if (!e) return;
      e.style.animation = 'none'; void e.offsetWidth; e.style.animation = 'saiaFlash .85s ease';
    }

    function applyAndRender(say, actions, awaiting) {
      const res = Planner.applyActions(state.hire, actions || []);
      state.typing = false;
      state.hire = res.hire;
      if (awaiting !== undefined) state.hire.awaiting = awaiting;
      state.msgs.push({ from: 'bot', text: say });
      res.acts.forEach((a) => state.msgs.push({ from: 'act', text: a }));
      renderThread(); renderHire(); flashHire();
    }

    // Tier 2 — Claude "Noor" assist, only for messages Tier 1 didn't recognise.
    function askAssist(plan) {
      const endpoint = opts.endpoint || 'http://localhost:8787/api/concierge';
      const history = state.msgs
        .filter((m) => m.from === 'user' || m.from === 'bot')
        .map((m) => ({ role: m.from === 'user' ? 'user' : 'bot', text: m.text }));
      let done = false;
      const fallback = () => { if (done) return; done = true; applyAndRender(plan.say, []); };
      const guard = setTimeout(fallback, 12000); // never hang the typing dots
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, hire: state.hire }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
        .then((data) => { if (done) return; done = true; clearTimeout(guard); applyAndRender(data.say || plan.say, data.actions || []); })
        .catch(() => { clearTimeout(guard); fallback(); });
    }

    function send(text) {
      if (!text || !text.trim()) return;
      const t = text.trim();
      state.msgs.push({ from: 'user', text: t });
      state.typing = true; renderThread();
      const plan = Planner.localPlan(t, state.hire);
      if (plan.matched) {
        // Tier 1 — instant, scripted, on-brand (keep the natural reply beat)
        clearTimeout(replyTimer);
        replyTimer = setTimeout(() => applyAndRender(plan.say, plan.actions, plan.awaiting), opts.replyDelay || 720);
        return;
      }
      askAssist(plan); // long tail → Claude assist (network is the delay)
    }

    function greet() {
      if (greeted) return; greeted = true;
      state.msgs.push({ from: 'bot', text: opts.greeting });
      renderThread();
    }

    // wiring
    if (opts.sendBtn) opts.sendBtn.addEventListener('click', () => {
      if (opts.inputEl) { send(opts.inputEl.value); opts.inputEl.value = ''; }
    });
    if (opts.inputEl) opts.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { send(opts.inputEl.value); opts.inputEl.value = ''; }
    });
    (opts.chipEls || []).forEach((c) => c.addEventListener('click', () => send(c.getAttribute('data-q'))));

    const bookBtn = opts.bookEl || document.querySelector('[data-hire-book]');
    if (bookBtn) bookBtn.addEventListener('click', () => { if (window.SAIA && window.SAIA.bookHire) window.SAIA.bookHire(state.hire); });

    renderHire();
    return { send, greet, state };
  };
})();
