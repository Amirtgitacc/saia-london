/* ============================================================
   SAÏA — concierge "Noor" deterministic brain (Tier 1)
   The dedicated core: knows the common situations cold —
   instant, free, always on-brand. Returns {say, actions, matched, awaiting}.
   When `matched` is false the UI escalates to the Tier-2 Claude
   assist (server.js); Claude is the safety net, this is the product.
   Facts come from window.SAIA.KB (saia-knowledge.js) so the two
   brains can never drift. applyActions is unchanged — it stays the
   single deterministic booking executor for BOTH tiers.
   Exposed on window.SAIA.Planner
   ============================================================ */
(function (root, factory) {
  var P = factory(typeof require === 'function'
    ? require('./saia-knowledge.js')
    : ((root.SAIA && root.SAIA.KB) || null));
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  if (typeof window !== 'undefined') { (window.SAIA = window.SAIA || {}).Planner = P; }
})(typeof self !== 'undefined' ? self : this, function (KBin) {
  // Minimal fallback so scripted replies still work if the KB ever fails to load.
  const KB = KBin || {
    hire: { pricePerMat: 8.5, currency: '£', hireDays: 2, minMats: 10, extraDayPerMat: 1.5, depositPerMat: 1.5, depositRefundable: true, bulkThreshold: 60,
      mat: { size: '68 × 185 cm, 4 mm thick', colour: 'black', material: 'natural rubber with a PU surface', features: 'non-slip and anti-odour' },
      delivery: 'Same-day courier across London from our Central London warehouse.',
      collection: 'We collect the day after. No need to clean them, we handle that.' },
    contact: { email: 'support@saialondon.com', whatsapp: '07444 611 914', person: 'Cristina', pickup: 'NW3 warehouse' },
    club: { ethos: 'women who lift each other up', join: 'pop your email in to hear about gatherings' },
    pilates: { method: 'small, slow and breath-led', format: '1-2-1 in NW3, group in Hampstead' },
    founder: { name: 'Cristina', bio: 'Cristina founded SAÏA in 2020.', meaning: 'SAÏA means “A Woman Who Wins”.' },
    events: ['the Brunch Club', 'a watercolour morning', 'Book Club with afternoon tea'],
  };

  const H = KB.hire;
  const money = (v) => H.currency + Number(v).toFixed(2);

  function total(h) { return KB.priceHire ? KB.priceHire(h).total : (h.mats ? h.mats * H.pricePerMat : null); }

  /* ---- booking executor — deterministic, shared by both tiers (unchanged) ---- */
  function applyActions(hireState, actions) {
    let hire = Object.assign({}, hireState); const acts = [];
    (actions || []).forEach((a) => {
      const args = a.args || {};
      switch (a.tool) {
        case 'add_mats':
          hire.mats = Math.max(0, parseInt(args.n, 10) || 0); hire.total = total(hire);
          acts.push('Added ' + hire.mats + ' mats to your hire'); break;
        case 'set_days':
          hire.days = Math.max(H.hireDays, parseInt(args.n, 10) || H.hireDays); hire.total = total(hire);
          acts.push('Set hire length to ' + hire.days + ' days'); break;
        case 'set_method':
          hire.method = (args.method === 'pickup') ? 'pickup' : 'deliver';
          if (hire.method === 'pickup') { hire.postcode = null; hire.zone = null; }
          hire.total = total(hire);
          acts.push(hire.method === 'pickup' ? 'Collection from NW3 selected' : 'Courier delivery selected'); break;
        case 'set_postcode': {
          hire.postcode = args.pc || hire.postcode; hire.method = 'deliver';
          const z = KB.classify ? KB.classify(hire.postcode) : null;
          hire.zone = z ? z.key : null; hire.total = total(hire);
          acts.push('Delivery to ' + String(hire.postcode || '').toUpperCase() + (z && z.key !== 'outside' ? ' · ' + z.label : '')); break;
        }
        case 'set_event':
          if (args.guests) hire.guests = parseInt(args.guests, 10) || hire.guests;
          if (args.date) hire.date = args.date;
          acts.push('Logged your event' + (hire.guests ? ' · ' + hire.guests + ' guests' : '') + (args.date ? ' · ' + args.date : '')); break;
        case 'recommend': {
          const g = parseInt(args.guests, 10) || hire.guests || 0;
          const rec = Math.max(H.minMats, Math.ceil(g * 1.1));
          hire.guests = g || hire.guests; hire.mats = rec; hire.total = total(hire);
          acts.push('Recommended ' + rec + ' mats for ' + (g || '—') + ' guests'); break;
        }
        case 'set_date': hire.date = args.date; acts.push('Set date to ' + args.date); break;
        case 'quote': hire.total = total(hire); hire.status = 'Quoted'; hire.quoted = true; acts.push('Prepared your quote'); break;
        case 'book_delivery': if (args.date) hire.date = args.date; hire.status = 'Delivery scheduled'; acts.push('Scheduled delivery' + (hire.date ? ' · ' + hire.date : '')); break;
        case 'checkout': if (hire.total == null) hire.total = total(hire); hire.status = 'Checkout link ready'; hire.quoted = true; acts.push('Generated a secure Shopify checkout link'); break;
        case 'confirm': if (hire.total == null) hire.total = total(hire); hire.status = 'Confirmed'; hire.quoted = true; acts.push('Hire confirmed. Confirmation on its way'); break;
        case 'rsvp_event': acts.push('Reserved your place · ' + (args.event || 'SAÏA event')); break;
        case 'request_pilates': acts.push('Pilates request sent to Cristina' + (args.type ? ' · ' + args.type : '') + (args.date ? ' · ' + args.date : '') + ' — she\'ll confirm'); break;
        case 'join_pilates_list': acts.push('Added you to the Pilates waitlist' + (args.email ? ' · ' + args.email : '') + ' — updates when a session opens'); break;
        case 'join_newsletter': acts.push('Added you to the SAÏA guest list' + (args.email ? ' · ' + args.email : '')); break;
        default: break;
      }
    });
    return { hire, acts };
  }

  /* ---- the brain: stateful for the hire flow, scripted for everything else ---- */
  function localPlan(text, hire) {
    const t = (text || '').toLowerCase().trim();
    hire = hire || {};
    const has = (re) => re.test(t);
    const nb = (re) => { const mm = t.match(re); return mm ? parseInt(mm[1], 10) : null; };
    const rec = (g) => Math.max(H.minMats, Math.ceil(g * 1.1));
    const m = (say, actions) => ({ say, actions: actions || [], matched: true, awaiting: null });
    const mk = (say, actions, awaiting) => ({ say, actions: actions || [], matched: true, awaiting: awaiting || null });

    // --- parse signals from this message ---
    const guests = nb(/(\d+)\s*(?:people|guests|persons|pax|attendees|women|ladies|of us|girls)/);
    const matsN = nb(/(\d+)\s*mats?/);
    const daysN = nb(/(\d+)\s*(?:day|days|nights?)/);
    // Only accept dates concrete enough to book on. Vague relatives ("next week/month",
    // "26 next month") are handed to Tier 2, which resolves them against today's date and
    // confirms the exact day before finalising — so the booking never carries a fuzzy date.
    const dateWord = (t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b/) || [])[1];
    // clear statements of inability — "cant collect", "won't be able to pick up" — must NOT
    // be read as a positive choice. When present we suppress keyword matching and let Tier 2 read it.
    const neg = has(/\b(can'?t|cannot|can ?not|won'?t|wont|unable|do ?n'?t want)\b/);
    const wantsDeliver = !neg && has(/deliver|drop ?off|courier|bring them|ship|send (it|them|me|to|over)|post (it|them)|to my (address|place|home|venue)/);
    const wantsPickup = !neg && has(/pick.?up|collect|warehouse|\bnw3\b/);
    const pcMatch = (text || '').match(/\b([A-Za-z]{1,2}\d[A-Za-z\d]?(?:\s*\d[A-Za-z]{2})?)\b/);
    const fullPc = !!(pcMatch && /\d[A-Za-z]{2}\s*$/.test(pcMatch[1].trim()));
    const pcZone = pcMatch && KB.classify && KB.classify(pcMatch[1]);
    // Only treat token as a postcode when mid-flow awaiting one, OR it has an inward code (e.g. "8DS")
    const looksPostcode = (pcZone && (hire.awaiting === 'postcode' || fullPc)) ? pcZone : null;

    const aw = hire.awaiting;
    const inHireFlow = !!(aw && /^(mats|days|method|postcode|date|confirm)$/.test(aw));

    // --- bare answers interpreted in the context of what we just asked ---
    const bareNum = (t.match(/^(?:just\s+)?(?:the\s+)?(\d+)\b/) || [])[1];

    // ===== review gate: confirm they want the quote BEFORE we reveal it =====
    if (aw === 'review' && has(/^(no|nope|not yet|hold on|wait|stop|change|actually)\b/))
      return mk("No rush at all — tell me what you'd like to change, or say 'go ahead' whenever you'd like to see it.", [], 'review');
    if (aw === 'review' && has(/^(yes|yep|yeah|sure|go ahead|go on|please|ok|okay|show me|sounds good|do it|let'?s|continue|book|see it)\b/)) {
      const qq = KB.priceHire ? KB.priceHire(hire) : { total: null, matCost: 0, deposit: 0, quoteOnly: false };
      const ready = qq.quoteOnly
        ? "Here it is — your mats and deposit come to " + money(qq.matCost + qq.deposit) + "; as you're outside London, Cristina will confirm the courier. Press Book this hire and I'll pass your details to her. Anything else I can help with?"
        : "Here it is — " + money(qq.total) + " all in, including a " + money(qq.deposit) + " refundable deposit returned after collection. Press Book this hire when you're ready — and anything else I can help with in the meantime?";
      return mk(ready, [{ tool: 'quote' }], null);
    }

    // ===== confirm step =====
    if (aw === 'confirm' && has(/^(no|nope|not yet|cancel|hold on|wait|stop|actually)\b/))
      return mk("No rush — your quote's saved in the panel. Tell me what you'd like to change, or say 'checkout' when you're ready.", [], null);
    if (aw === 'confirm' && has(/^(yes|yep|yeah|sure|go ahead|do it|lock it|confirm|book it|sounds good|please|ok|okay|perfect)\b/))
      return mk("Wonderful. Your secure checkout link is in the panel — that's you booked. Delivery the day before, collection after. Welcome to SAÏA.", [{ tool: 'checkout' }], null);

    // explicit booking actions — also fired by the home basket buttons
    if (has(/^checkout\b|^pay\b|payment link|secure (checkout )?link/))
      return mk("Your secure checkout link is ready in the panel. That's you joining the club — anything else for your day?", [{ tool: 'checkout' }], null);
    if (has(/^confirm\b|^confirm booking|^book it now\b/))
      return mk('Confirmed. Delivery the day before, collection after. Welcome to SAÏA.', [{ tool: 'confirm' }], null);

    // ===== build / continue the hire flow =====
    // Trigger: mid-flow, or a fresh hire signal (a count, “hire”, “book”, “rent”, “event with mats”)
    // isProcessQ: “how does hire work?” etc. — these are FAQ questions, not booking signals
    const isProcessQ = /how (do|does|to)\b|how (it|this|the hire) works?|what is (mat )?hire|what'?s (mat )?hire|the process|how .* works?/.test(t);
    const freshHire = (matsN != null) || (guests != null) || (has(/\bhire\b|\brent\b|book .*mats|mat hire|\bquote\b/) && !isProcessQ);
    if (inHireFlow || freshHire) {
      const h = Object.assign({}, hire);
      const actions = [];

      // mats / guests
      if (matsN != null) { h.mats = matsN; actions.push({ tool: 'add_mats', args: { n: matsN } }); }
      else if (guests != null && !h.mats) { h.guests = guests; h.mats = rec(guests); actions.push({ tool: 'recommend', args: { guests } }); }
      else if (aw === 'mats' && bareNum) { h.mats = parseInt(bareNum, 10); actions.push({ tool: 'add_mats', args: { n: h.mats } }); }

      // days
      if (daysN != null) { h.days = Math.max(H.hireDays, daysN); actions.push({ tool: 'set_days', args: { n: h.days } }); }
      else if (aw === 'days' && bareNum) { h.days = Math.max(H.hireDays, parseInt(bareNum, 10)); actions.push({ tool: 'set_days', args: { n: h.days } }); }

      // delivery method + postcode (pickup takes priority over postcode detection)
      if (wantsPickup) { h.method = 'pickup'; h.zone = null; h.postcode = null; actions.push({ tool: 'set_method', args: { method: 'pickup' } }); }
      else if (looksPostcode) { h.method = 'deliver'; h.postcode = pcMatch[1]; h.zone = looksPostcode.key; actions.push({ tool: 'set_postcode', args: { pc: pcMatch[1] } }); }
      else if (wantsDeliver) { h.method = 'deliver'; actions.push({ tool: 'set_method', args: { method: 'deliver' } }); }

      // date
      if (dateWord) { h.date = dateWord; actions.push({ tool: 'set_date', args: { date: dateWord } }); }

      // HANDOFF: mid-flow, but this message gave us nothing to act on (an unrecognised phrasing
      // like "send to my address", "cant collect", "5 july", or an off-topic question). Rather than
      // re-ask the same slot and loop, escalate to Tier-2 Claude — it reads the intent in context,
      // emits the right action, and applyActions still does the math. This is the safety net firing.
      if (inHireFlow && actions.length === 0)
        return { say: '', actions: [], matched: false, awaiting: aw };

      // decide the next missing slot
      const need = (function (x) {
        if (!x.mats || x.mats < H.minMats) return 'mats';
        if (!x.days) return 'days';
        if (!x.method) return 'method';
        if (x.method === 'deliver' && !x.zone) return 'postcode';
        if (!x.date) return 'date';
        return 'confirm';
      })(h);

      if (need === 'mats') return mk("Lovely — let's plan your hire. How many mats do you need? (Minimum " + H.minMats + '.)', actions, 'mats');
      if (need === 'days') return mk((h.mats ? h.mats + ' mats — perfect. ' : '') + 'How many days do you need them? Our standard hire is ' + H.hireDays + ' days.', actions, 'days');
      if (need === 'method') return mk('Shall we deliver by courier, or will you collect from our NW3 warehouse?', actions, 'method');
      if (need === 'postcode') return mk("What's the event postcode? I'll work out the courier from there.", actions, 'postcode');

      // need the date before we quote anything
      if (need === 'date') return mk('And what date is your event? We deliver the day before and collect the day after.', actions, 'date');

      // everything gathered → DON'T reveal the quote yet. Ask first, so the guest opts in to
      // booking before any price or basket appears; the quote shows only on their 'yes' (above).
      return mk("That's everything I need — shall I put your quote together?", actions, 'review');
    }

    // ===== everything below: the existing scripted FAQ intents (unchanged behaviour) =====

    // greeting / thanks
    if (has(/^(hi|hey|hello|good (morning|afternoon|evening)|yo|hiya)\b/))
      return m("Hello, lovely. I can plan mat hire for an event, share what's on, or get you on the list for Pilates with Cristina. What brings you in?");
    if (has(/\b(thanks|thank you|cheers|ta)\b/))
      return m('Any time. Anything else I can sort for your day?');

    // who we are / founder / the name
    if (has(/who (runs|started|made|owns|is behind|founded)|founder|sa[ïi]a mean|meaning of|story behind|who.{0,4}cristina|about cristina/))
      return m(KB.founder.bio + ' ' + KB.founder.meaning);
    if (has(/what is sa[ïi]a|what'?s sa[ïi]a|about sa[ïi]a|tell me about (you|saia|saïa)|what do you (do|offer)/))
      return m((KB.club.what || 'SAÏA is a female-led club for women in London.') + ' Mostly I help with mat hire for events, plus community gatherings and Pilates with Cristina. Where shall we start?');

    // Pilates / classes — two paths: 1-2-1 request, or group-event waitlist
    if (has(/pilates|reformer|class(es)?|yoga session|work ?out|sessions?\b|\b1.?(2|to|on).?1\b|one.?to.?one/) && !has(/mat/)) {
      const email = (text || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      // explicit private 1-2-1 → place a request with Cristina
      if (has(/1.?(2|to|on).?1|one.?to.?one|private|personal|just me/))
        return m('Lovely — a private 1-2-1 with Cristina in NW3. Tell me a day or two that suit' + (dateWord ? ' (' + dateWord + ' works?)' : '') + ' and I’ll put your request to her; she confirms directly.',
          [{ tool: 'request_pilates', args: { type: '1-2-1', date: dateWord || null } }]);
      // explicit group / waitlist intent (or they handed over an email)
      if (email || has(/group|wait ?list|notify|updates?|let me know|sign ?up|join the list/))
        return m(email
          ? 'Perfect — you’re on the Pilates waitlist. You’ll be first to hear the moment a group session opens.'
          : 'Group Pilates runs as occasional events in Hampstead. Pop your email in and I’ll add you to the waitlist — you’ll hear the moment a session opens.',
          [{ tool: 'join_pilates_list', args: { email: email ? email[0] : null } }]);
      // generic — explain both, let them choose
      return m('Pilates with Cristina is ' + KB.pilates.method + ' ' + KB.pilates.format + ' For a 1-2-1 I can put a request to Cristina; group classes run as occasional events, so I can add you to the waitlist for updates. Which would you like?');
    }

    // events / community
    if (has(/what'?s on|whats on|upcoming|any events?|events\b|this month|brunch|book club|watercolou?r|gathering|community/))
      return m('This season: ' + KB.events.slice(0, 3).join(', ') + '. Want me to reserve you a place?',
        [{ tool: 'rsvp_event', args: { event: KB.events[0] } }]);

    // membership / join
    if (has(/right for me|is (it|this) for me|join\b|member|belong|guest list|newsletter|sign ?up/))
      return m("If you want to move, gather and breathe with women who lift each other up, yes — it's for you. No pressure, no performing. " + KB.club.join + " and I'll send the next gathering.",
        [{ tool: 'join_newsletter', args: {} }]);

    // mat spec
    if (has(/what (are|kind|type)|material|rubber|thick|how big|dimension|size|spec|pvc|slip|odou?r|smell|made of/) && (has(/mat/) || has(/rubber|thick|pvc|slip|odou?r/)))
      return m('Our mat is ' + H.mat.size + ', ' + H.mat.colour + ', ' + H.mat.material + ', ' + H.mat.features + '. We hire it from ' + money(H.pricePerMat) + ' a mat. How many are you expecting?');

    // how hire works
    if (has(/how (does|do|to)\s?(it|this|the hire|i|we)?\s?(work|hire|rent)|how does (it|hire) work|process/))
      return m('Simple: tell me your numbers and date, we deliver the day before (min ' + H.minMats + ' mats, from ' + money(H.pricePerMat) + ' each for a ' + H.hireDays + '-day hire) and collect after. Shall I start a quote?');

    // delivery / collection facts — answer both halves; they're usually asked together
    if (has(/deliver|courier|ship|drop ?off|bring them/))
      return m(H.delivery + ' We collect the day after — no cleaning needed, we handle that — or you can drop them at our NW3 warehouse for free. Tell me your numbers and postcode and I\'ll price it.');
    if (has(/collect|return|pick.?up|pick them|after the event|clean|wash/))
      return m(H.collection + ' Prefer it brought to you? We courier across London too — just share your postcode.');

    // location / contact
    if (has(/where|location|nw3|warehouse|address|whats ?app|phone|number|contact|call|reach|email/))
      return m("We're " + (KB.contact.pickup || 'in London') + '. For the quickest service, email ' + KB.contact.person + ' at ' + KB.contact.email + '. Or tell me your numbers and I\'ll start your hire right here.');

    // pricing FAQ — answer the question; only start collecting mats if we're not already mid-hire
    if (has(/price|quote|cost|how much|rate|charge/)) {
      const tail = aw ? " Shall I show you the full quote?" : ' How many mats do you need?';
      return mk(money(H.pricePerMat) + ' per mat for a ' + H.hireDays + '-day hire, then ' + money(H.extraDayPerMat) + '/mat for each extra day; minimum ' + H.minMats + ', plus a refundable ' + money(H.depositPerMat) + '/mat deposit and courier across London.' + tail, [], aw || 'mats');
    }

    // not recognised → Tier 2
    return {
      say: "I can plan your mat hire and make a checkout link, share what's on, get you on the list for Pilates with Cristina, or help you decide if SAÏA is for you. Where shall we start?",
      actions: [],
      matched: false,
      awaiting: null,
    };
  }

  return { total, applyActions, localPlan };
});
