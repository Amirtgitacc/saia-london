/* ============================================================
   SAÏA — home agentic concierge (one brain, two surfaces)
   Brings the real Tier-1/Tier-2 brain to index.html and weaves it
   into the page: an inline designed-in block and the floating
   launcher share ONE conversation + ONE live hire basket.

     send(text)
       └─ Planner.localPlan() ── matched ─► use it (instant, free)
                               └─ miss ──► POST /api/concierge (Claude)
          both feed ─► Planner.applyActions(hire, actions) → basket

   Reuses js/planner.js unchanged. Exposed as window.SAIA.Concierge
   (+ a backward-compatible window.SAIA.startHire).
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});
  const KB = NS.KB || {};
  const H = KB.hire || { pricePerMat: 8.5, currency: '£', hireDays: 2, minMats: 10 };
  const money = (v) => (H.currency || '£') + Number(v || 0).toFixed(2);
  const EMAIL = (KB.contact && KB.contact.email) || 'Cristina@saialondon.com';

  /* ---- bubble + basket styles (home palette: cream / ink / terracotta) ---- */
  const BOT = 'align-self:flex-start; max-width:84%; background:#fff; color:#2B2620; font-size:14px; line-height:1.55; padding:12px 15px; border:1px solid #DAD4C8; border-radius:3px 14px 14px 14px; animation:saiaMsgIn .3s ease both;';
  const USER = 'align-self:flex-end; max-width:84%; background:#B8624A; color:#F5F1E8; font-size:14px; line-height:1.55; padding:12px 15px; border-radius:14px 3px 14px 14px; animation:saiaMsgIn .3s ease both;';
  const ACT = 'align-self:flex-start; max-width:90%; display:flex; gap:8px; align-items:center; font-size:12px; color:#6B6358; padding:1px 2px;';
  const ACTDOT = 'width:5px; height:5px; border-radius:50%; background:#B8624A; flex:none;';
  const TYPING = 'align-self:flex-start; background:#fff; border:1px solid #DAD4C8; padding:13px 16px; border-radius:3px 14px 14px 14px; display:flex; gap:5px;';
  const DOT = 'width:7px; height:7px; border-radius:50%; background:#B8624A;';
  const CHIPS = 'display:flex; flex-wrap:wrap; gap:8px; align-self:flex-start; margin-top:2px;';
  const CHIP = "font-family:'Inter',sans-serif; font-size:12px; color:#B8624A; border:1px solid #B8624A; background:none; border-radius:30px; padding:8px 13px; cursor:pointer;";
  const BASKET = 'align-self:stretch; margin-top:6px; background:#FBF8F1; border:1px solid #DAD4C8; border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:8px;';
  const BASKET_T = 'font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:#6B6358;';
  const BASKET_LINE = 'display:flex; justify-content:space-between; align-items:baseline; gap:12px; font-size:14px; color:#2B2620;';
  const BASKET_TOTAL = "font-family:'Playfair Display',serif; font-size:18px; color:#B8624A; white-space:nowrap;";
  const BASKET_STATUS = 'font-size:11px; letter-spacing:.04em; color:#6B6358;';
  const BASKET_BTN = "margin-top:2px; background:#2B2620; color:#F5F1E8; border:none; font-family:'Inter',sans-serif; font-size:11px; letter-spacing:.18em; text-transform:uppercase; padding:11px; border-radius:3px; cursor:pointer; width:100%;";
  const BASKET_DONE = 'margin-top:2px; font-size:13px; color:#6B6358;';

  function el(tag, style, text) {
    const n = document.createElement(tag);
    if (style) n.setAttribute('style', style);
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---- conversation logging (fire-and-forget — must never block or break the chat) ----
     Every turn is posted to /api/log (derived from the concierge endpoint) so real
     conversations can be reviewed later. One random id groups a visit into a thread. */
  let logSession = null;
  function logSessionId() {
    if (logSession) return logSession;
    try {
      logSession = sessionStorage.getItem('saia_chat_session');
      if (!logSession) {
        logSession = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem('saia_chat_session', logSession);
      }
    } catch (e) { logSession = logSession || 's-' + Math.random().toString(36).slice(2, 12); }
    return logSession;
  }
  function logTurn(role, message, tier) {
    if (!message || !String(message).trim()) return;
    try {
      const ep = ((window.SAIA_CONFIG && window.SAIA_CONFIG.conciergeEndpoint) || '/api/concierge')
        .replace(/\/concierge(\?.*)?$/, '/log');
      fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          session: logSessionId(),
          page: location.pathname,
          turns: [{ role: role, tier: tier || null, message: String(message) }],
        }),
      }).catch(function () {});
    } catch (e) { /* never let logging surface in the chat */ }
  }

  /* ---- one shared state for every surface ---- */
  const state = {
    msgs: [],
    typing: false,
    turns: 0,
    mode: 'default',
    greeted: false,
    hire: { mats: 0, guests: null, date: null, days: null, total: null, status: null },
  };
  const mounts = [];        // { node, kind:'panel'|'inline' }
  let panelEl = null, panelInput = null, panelSendBtn = null, inlineInputEl = null, inlineSendBtn = null;

  /* ---- one turn at a time ----
     A reply in flight rebases onto the LIVE state.hire when it lands, so two concurrent
     fetches land out of order and corrupt `awaiting` (the race that once flipped a live
     delivery to pickup). While a reply is pending the inputs are disabled and any message
     that still arrives (chips, programmatic send) waits in a 1-slot queue — only the LAST
     one is kept — and is dispatched the moment the pending reply lands. */
  let pending = false;      // a plan/fetch is in flight
  let queuedText = null;    // last message received while pending
  let refocusEl = null;     // the input the user was typing in, to restore focus

  function setInputsDisabled(dis) {
    [panelInput, panelSendBtn, inlineInputEl, inlineSendBtn].forEach(function (n) {
      if (!n) return;
      n.disabled = !!dis;                                        // real disabled = keyboard-safe too
      if (dis) n.setAttribute('aria-disabled', 'true'); else n.removeAttribute('aria-disabled');
    });
    if (!dis && refocusEl) {
      const back = refocusEl; refocusEl = null;
      try { back.focus({ preventScroll: true }); } catch (e) { try { back.focus(); } catch (e2) {} }
    }
  }

  const GENERIC = 'Happy to help. Is it mat hire for an event, an upcoming SAÏA experience, or Pilates with Cristina?';
  const INTENT_CHIPS = [
    { label: 'Hosting ~30', q: 'I am hosting 30 women' },
    { label: 'I run a studio', mode: 'studio' },
    { label: 'Just browsing', q: 'Tell me about SAÏA' },
  ];

  /* ---- greeting per mode (only while the conversation hasn't started) ---- */
  function greet(mode) {
    state.mode = mode || 'default';
    let text, chips = null;
    if (mode === 'hire') {
      text = 'Tell me about your event and I’ll help with the mats. How many are you expecting?';
      chips = INTENT_CHIPS;
    } else if (mode === 'studio') {
      text = 'A studio, wonderful. Tell me your studio name, the days you need mats and roughly how many, and I’ll arrange a recurring rate. Prefer to talk it through? Email Cristina at ' + EMAIL + '.';
      chips = [{ label: 'Around 40 mats', q: 'I need 40 mats' }];
    } else if (mode === 'estimate') {
      text = 'Let’s turn your estimate into a booking.';
    } else {
      text = "Hello, and welcome to SAÏA. I can plan mat hire for your event, share what’s on, or book Pilates with Cristina. What can I help with?";
      chips = INTENT_CHIPS;
    }
    state.msgs = [{ from: 'bot', text: text, chips: chips }];
    state.greeted = true;
  }

  function ensureGreeted(mode) {
    if (state.turns === 0) greet(mode || state.mode || 'default');
    else if (mode) state.mode = mode;
  }

  /* ---- the brain pipeline (shared by both tiers) ---- */
  function applyAndShow(plan, tier) {
    state.typing = false;
    // EVERY terminal path (fetch resolve, fetch reject, 12s timeout fallback) funnels through
    // here exactly once — unlock first so no failure below can ever leave the chat frozen.
    pending = false;
    setInputsDisabled(false);
    const exec = (NS.Planner && NS.Planner.applyActions)
      ? NS.Planner.applyActions(state.hire, plan.actions || [])
      : { hire: state.hire, acts: [] };
    state.hire = exec.hire;
    state.hire.awaiting = (plan && 'awaiting' in plan) ? plan.awaiting : state.hire.awaiting;
    state.msgs.push({ from: 'bot', text: plan.say });
    logTurn('bot', plan.say, tier || 'local');
    (exec.acts || []).forEach((a) => { state.msgs.push({ from: 'act', text: a }); logTurn('act', a, tier || 'local'); });
    render();
    // a message arrived while this reply was in flight → send it now, in order
    if (queuedText != null) { const q = queuedText; queuedText = null; dispatch(q); }
  }

  function askAssist(text) {
    const history = state.msgs.filter((m) => m.from === 'user' || m.from === 'bot')
      .map((m) => ({ role: m.from === 'user' ? 'user' : 'bot', text: m.text }));
    let done = false;
    const finish = (say, actions) => { if (done) return; done = true; applyAndShow({ say: say || GENERIC, actions: actions || [] }, 'claude'); };
    // Offline safety net: Claude unreachable → re-plan the raw message through the Tier-1
    // regex planner; if even that is missing, a single graceful generic line.
    const fallback = () => {
      if (done) return;
      done = true;
      const plan = (NS.Planner && NS.Planner.localPlan) ? NS.Planner.localPlan(text, state.hire) : { say: '', actions: [] };
      if (!plan.say || !plan.say.trim()) plan.say = GENERIC;   // localPlan emits '' to hand off — never render a blank bubble
      applyAndShow(plan);
    };
    const guard = setTimeout(fallback, 12000);
    fetch((window.SAIA_CONFIG && window.SAIA_CONFIG.conciergeEndpoint) || '/api/concierge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, hire: state.hire }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((d) => { clearTimeout(guard); finish((d && d.say) || GENERIC, (d && d.actions) || []); })
      .catch(() => { clearTimeout(guard); fallback(); });
  }

  function dispatch(clean) {
    const active = document.activeElement;
    refocusEl = (active === panelInput || active === inlineInputEl) ? active : null;
    pending = true;
    setInputsDisabled(true);
    state.msgs.push({ from: 'user', text: clean });
    logTurn('user', clean);
    state.turns++;
    state.typing = true;
    render();
    askAssist(clean);   // Claude reads EVERY message; localPlan is the offline fallback
  }

  function send(text) {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    if (pending) { queuedText = clean; return; }   // one turn at a time — keep only the LAST extra
    dispatch(clean);
  }

  /* ---- live hire basket ---- */
  function basketEl() {
    const h = state.hire;
    if (!NS.KB || !NS.KB.hireComplete || !NS.KB.hireComplete(h)) return null;   // nothing until complete
    if (!h.quoted) return null;   // …and not until the guest has opted in to see the quote
    const q = NS.KB.quoteLines(h);
    const wrap = el('div', BASKET);
    wrap.appendChild(el('div', BASKET_T, 'Your hire'));
    wrap.appendChild(el('div', BASKET_STATUS, (h.mats || 0) + ' mats · ' + (h.days || H.hireDays) + '-day hire' + (h.date ? ' · ' + h.date : '')));

    q.lines.forEach((l) => {
      const r = el('div', BASKET_LINE);
      r.appendChild(el('span', '', l.label));
      r.appendChild(el('span', '', l.value));
      wrap.appendChild(r);
    });

    const totalLine = el('div', BASKET_LINE);
    totalLine.appendChild(el('span', BASKET_T, q.quoteOnly ? 'Subtotal (excl. courier)' : 'Total to pay'));
    totalLine.appendChild(el('span', BASKET_TOTAL, q.quoteOnly ? money(q.subtotal) : money(q.total)));
    wrap.appendChild(totalLine);
    wrap.appendChild(el('div', BASKET_STATUS, q.quoteOnly
      ? 'Cristina will confirm your courier and total.'
      : money(q.deposit) + ' of that is returned after collection.'));

    const btn = el('button', BASKET_BTN, q.quoteOnly ? 'Book — confirm with Cristina →' : 'Book this hire →');
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', () => { if (NS.bookHire) NS.bookHire(state.hire); });
    wrap.appendChild(btn);
    return wrap;
  }

  function chipsEl(chips) {
    const row = el('div', CHIPS);
    chips.forEach((c) => {
      const b = el('button', CHIP, c.label);
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => { if (c.mode) open({ mode: c.mode }); else send(c.q); });
      row.appendChild(b);
    });
    return row;
  }

  /* ---- paint every mounted surface from the one state ---- */
  function render() {
    const last = state.msgs[state.msgs.length - 1];
    mounts.forEach(({ node }) => {
      node.innerHTML = '';
      state.msgs.forEach((m) => {
        if (m.from === 'bot') node.appendChild(el('div', BOT, m.text));
        else if (m.from === 'user') node.appendChild(el('div', USER, m.text));
        else if (m.from === 'act') {
          const a = el('div', ACT);
          a.appendChild(el('span', ACTDOT, ''));
          a.appendChild(el('span', '', m.text));
          node.appendChild(a);
        }
      });
      if (!state.typing && last && last.chips && last.chips.length) node.appendChild(chipsEl(last.chips));
      if (state.typing) {
        const tw = el('div', TYPING);
        [0, 0.2, 0.4].forEach((d) => tw.appendChild(el('span', DOT + ' animation:saiaDot 1.2s infinite ' + d + 's;')));
        node.appendChild(tw);
      }
      const b = basketEl();
      if (b) node.appendChild(b);
      node.scrollTop = node.scrollHeight;
    });
  }

  /* ---- public surface ---- */
  function seedEstimate(seed) {
    seed = seed || {};
    const mats = parseInt(seed.mats, 10) || 0;
    const days = parseInt(seed.days, 10) || null;
    const acts = [];
    if (mats) acts.push({ tool: 'add_mats', args: { n: mats } });
    if (days) acts.push({ tool: 'set_days', args: { n: days } });
    if (seed.postcode) acts.push({ tool: 'set_postcode', args: { pc: seed.postcode } });
    if (acts.length && NS.Planner && NS.Planner.applyActions) {
      const exec = NS.Planner.applyActions(state.hire, acts);
      state.hire = exec.hire;
    }
    const parts = [];
    if (mats) parts.push(mats + ' mats');
    if (days) parts.push('for ' + days + ' days');
    if (seed.postcode) parts.push('delivering to ' + seed.postcode);
    state.msgs.push({ from: 'user', text: 'From my estimate: ' + (parts.join(' ') || 'mat hire') + '.' });
    logTurn('user', 'From my estimate: ' + (parts.join(' ') || 'mat hire') + '.');
    state.turns++;
    // ask the brain for the next missing slot, seeded with what we already know
    applyAndShow((NS.Planner && NS.Planner.localPlan)
      ? NS.Planner.localPlan("hire", state.hire)
      : { say: "Tell me your event date and I’ll finish your quote.", actions: [], matched: false, awaiting: null });
  }

  /* ---- mobile keyboard handling ----
     The chat is a position:fixed floating card. On a phone the on-screen keyboard
     shrinks the *visual* viewport but not the *layout* viewport, so a fixed card
     anchored to the layout bottom is left behind the keyboard — and the browser then
     auto-scrolls the page to chase the focused input, which makes it flicker and shift.
     Fix: pin the dock above the keyboard using the VisualViewport API, cap the card to
     the visible height, and lock the page behind it so it can't drift. */
  let vpBound = false;
  const isMobile = () => window.innerWidth <= 560;

  function syncViewport() {
    const dock = document.getElementById('homeChatDock');
    if (!dock || !panelEl || panelEl.style.display === 'none') return;
    const vv = window.visualViewport;
    if (!vv) return;
    // height of the keyboard (+ any bottom browser chrome) hidden below the visual viewport
    const bottomGap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    dock.style.bottom = (bottomGap + (isMobile() ? 12 : 24)) + 'px';
    // never let the card exceed what's actually visible above the keyboard
    panelEl.style.maxHeight = Math.max(220, vv.height - (isMobile() ? 24 : 96)) + 'px';
  }

  function bindViewport() {
    if (vpBound || !window.visualViewport) return;
    vpBound = true;
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }

  function unbindViewport() {
    const dock = document.getElementById('homeChatDock');
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', syncViewport);
      window.visualViewport.removeEventListener('scroll', syncViewport);
    }
    vpBound = false;
    if (dock) dock.style.bottom = '24px';        // restore the rest anchor (it lives inline, not in CSS — clearing it drops the fixed dock to page bottom)
    if (panelEl) panelEl.style.maxHeight = '';
  }

  function open(opts) {
    opts = opts || {};
    const mode = opts.mode || 'default';
    ensureGreeted(mode);
    if (panelEl) panelEl.style.display = 'flex';
    if (isMobile()) document.body.style.overflow = 'hidden';   // stop the page drifting behind
    bindViewport();
    syncViewport();
    if (opts.seed && mode === 'estimate') seedEstimate(opts.seed);
    else render();
    if (panelInput) {
      try { panelInput.focus(); } catch (e) {}
      // the keyboard animates in after focus — re-pin once it has settled
      setTimeout(syncViewport, 250);
    }
  }

  function close() {
    if (panelEl) panelEl.style.display = 'none';
    document.body.style.overflow = '';
    unbindViewport();
  }

  function mount(node, kind) {
    if (!node) return;
    mounts.push({ node: node, kind: kind || 'inline' });
    render();
  }

  /* ---- wire the page surfaces ---- */
  function init() {
    panelEl = document.getElementById('homeChatPanel');
    panelInput = document.getElementById('homeChatInput');
    const thread = document.getElementById('homeThread');
    const panelSend = panelSendBtn = document.getElementById('homeChatSend');
    const launcher = document.getElementById('homeChatLauncher');
    const closeBtn = document.getElementById('homeChatClose');
    const inlineThread = document.getElementById('homeInlineConcierge');
    const inlineInput = inlineInputEl = document.getElementById('homeInlineInput');
    const inlineSend = inlineSendBtn = document.getElementById('homeInlineSend');

    if (!state.greeted) greet('default');   // inline block shows intent chips at rest
    if (thread) mount(thread, 'panel');
    if (inlineThread) mount(inlineThread, 'inline');

    // Don't let the inline chat log hijack page scroll. The thread is overflow:auto,
    // so the wheel normally scrolls it instead of the page once the cursor is over it.
    // Forward the wheel to the page UNLESS the user has actually clicked into the card.
    if (inlineThread) {
      let chatActive = false;
      const card = inlineThread.closest('.ca-card') || inlineThread;
      card.addEventListener('pointerdown', () => { chatActive = true; });
      document.addEventListener('pointerdown', (e) => { if (!card.contains(e.target)) chatActive = false; });
      inlineThread.addEventListener('wheel', (e) => {
        if (chatActive) return;          // clicked in → let the log scroll
        e.preventDefault();              // otherwise keep the page scrolling
        window.scrollBy(0, e.deltaY);
      }, { passive: false });
    }

    if (launcher) launcher.addEventListener('click', () => open({}));
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (panelSend && panelInput) panelSend.addEventListener('click', () => { send(panelInput.value); panelInput.value = ''; });
    if (panelInput) panelInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send(panelInput.value); panelInput.value = ''; } });
    if (inlineSend && inlineInput) inlineSend.addEventListener('click', () => { send(inlineInput.value); inlineInput.value = ''; });
    if (inlineInput) inlineInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send(inlineInput.value); inlineInput.value = ''; } });

    Array.prototype.slice.call(document.querySelectorAll('[data-hire-cta]')).forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        open({ mode: b.getAttribute('data-hire-cta') === 'studio' ? 'studio' : 'hire' });
      }));
  }

  NS.Concierge = { open: open, close: close, send: send, mount: mount };
  NS.startHire = function (opts) { open(Object.assign({ mode: 'hire' }, opts || {})); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
