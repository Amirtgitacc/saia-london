/* ============================================================
   SAÏA — assistant deterministic brain (Tier 1)
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
    hire: { pricePerMat: 8.5, currency: '£', hireDays: 2, minMats: 10, maxMats: 50, extraDayPerMat: 1.5, depositPerMat: 1.5, depositRefundable: true,
      mat: { size: '68 × 185 cm, 4 mm thick', colour: 'black', material: 'natural rubber with a PU surface', features: 'non-slip and anti-odour' },
      delivery: 'Same-day courier across London from our Central London warehouse, with a 6-hour delivery window.',
      collection: 'We collect on the day, once your event has finished and the mats are packed away. No cleaning needed, we take care of that.' },
    contact: { email: 'Cristina@saialondon.com', whatsapp: '07444 611 914', person: 'Cristina', pickup: 'NW3 warehouse' },
    club: { ethos: 'women who lift each other up', join: 'pop your email in to hear about gatherings' },
    pilates: { method: 'small, slow and breath-led', format: '1-2-1 in NW3, group in Hampstead' },
    founder: { name: 'Cristina', bio: 'Cristina founded SAÏA in 2020.', meaning: 'SAÏA means “A Woman Who Wins”.' },
    events: ['the Brunch Club', 'a watercolour morning', 'Book Club with afternoon tea'],
  };

  const H = KB.hire;
  const money = (v) => H.currency + Number(v).toFixed(2);

  // ---- date helpers ----
  // Tier 1 captures EXPLICIT day+month dates ("16 July", "5th of Aug", "July 16")
  // and normalises weekday words. Vague/relative dates ("next month", "the 16th")
  // still fall through to Tier 2, which resolves + confirms them.
  const MONTHS = { jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June', jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December' };
  const MONTH_KEYS = Object.keys(MONTHS);
  const WD = { mon: 'Monday', tue: 'Tuesday', tues: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday', tomorrow: 'Tomorrow' };
  function normWeekday(w) { return w ? (WD[w] || (w.charAt(0).toUpperCase() + w.slice(1))) : null; }
  function parseDate(text) {
    const s = (text || '').toLowerCase();
    const M = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
    let day = null, mon = null, mm;
    if ((mm = s.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?' + M)))) { day = parseInt(mm[1], 10); mon = mm[2]; }
    else if ((mm = s.match(new RegExp('\\b' + M + '\\s+(\\d{1,2})(?:st|nd|rd|th)?')))) { mon = mm[1]; day = parseInt(mm[2], 10); }
    if (!day || !mon || day < 1 || day > 31) return null;
    const key = mon.slice(0, 3); const name = MONTHS[key]; if (!name) return null;
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let year = now.getFullYear();
    if (new Date(year, MONTH_KEYS.indexOf(key), day) < todayMidnight) year++;   // already passed → next year
    return day + ' ' + name + ' ' + year;
  }

  function total(h) { return KB.priceHire ? KB.priceHire(h).total : (h.mats ? h.mats * H.pricePerMat : null); }

  /* ---- booking executor — deterministic, shared by both tiers (unchanged) ---- */
  function applyActions(hireState, actions) {
    let hire = Object.assign({}, hireState); const acts = [];
    (actions || []).forEach((a) => {
      const args = a.args || {};
      switch (a.tool) {
        case 'add_mats':
          hire.mats = Math.min(H.maxMats, Math.max(0, parseInt(args.n, 10) || 0)); hire.total = total(hire);
          acts.push('Added ' + hire.mats + ' mats to your hire'); break;
        case 'set_days':
          hire.days = Math.max(H.hireDays, parseInt(args.n, 10) || H.hireDays); hire.total = total(hire);
          acts.push('Set hire length to ' + hire.days + ' days'); break;
        case 'set_method':
          hire.method = (args.method === 'pickup') ? 'pickup' : 'deliver';
          if (hire.method === 'pickup') { hire.postcode = null; hire.zone = null; hire.collection = null; }
          hire.total = total(hire);
          acts.push(hire.method === 'pickup' ? 'Collection from NW3 selected' : 'Courier delivery selected'); break;
        case 'set_collection':
          // 'two' = courier both ways (delivery + same-day collection, default), 'one' = they return the mats
          hire.collection = (args.collection === 'one-way' || args.collection === 'one') ? 'one' : 'two';
          hire.total = total(hire);
          acts.push(hire.collection === 'one' ? 'Delivery only · you return the mats to NW3' : 'Delivery + same-day collection selected'); break;
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
          const rec = Math.min(H.maxMats, Math.max(H.minMats, Math.ceil(g * 1.1)));
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
    const guests = nb(/(\d+)\s*(?:people|guests?|persons?|pax|attendees?|participants?|women|ladies|of us|girls|staff|team|employees?|colleagues?|delegates?|heads?|guests of mine|members of staff)/);
    const matsN = nb(/(\d+)\s*mats?/);
    const daysN = nb(/(\d+)\s*(?:day|days|nights?)/);
    // Only accept dates concrete enough to book on. Vague relatives ("next week/month",
    // "26 next month") are handed to Tier 2, which resolves them against today's date and
    // confirms the exact day before finalising — so the booking never carries a fuzzy date.
    const rawWeekday = (t.match(/\b(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun|tomorrow)\b/) || [])[1];
    const dateWord = normWeekday(rawWeekday);          // "Saturday" / "Sat"→"Saturday" / null
    const explicitDate = parseDate(text);              // "16 July 2026" / null
    const dateVal = explicitDate || dateWord;          // what we actually store
    // clear statements of inability — "cant collect", "won't be able to pick up" — must NOT
    // be read as a positive choice. When present we suppress keyword matching and let Tier 2 read it.
    const neg = has(/\b(can'?t|cannot|can ?not|won'?t|wont|unable|do ?n'?t want)\b/);
    const wantsDeliver = !neg && has(/deliver|drop ?off|courier|bring them|ship|send (it|them|me|to|over)|post (it|them)|to my (address|place|home|venue)/);
    // The courier's return journey, in the customer's words. Shared by the awaiting-collection
    // block below AND the generic flow, so a stale `awaiting` can never re-read "collect them
    // after" as NW3 pickup mid-delivery (the race that once flipped a live delivery to £0).
    const RETURN_ONE = /one.?way|delivery only|\bmyself\b|\bourselves\b|return (them|the mats)|bring (them|the mats) back|drop (them|it|the mats)|take them back|we'?ll (return|bring)|i'?ll (return|bring|drop)/;
    const RETURN_TWO = /\bboth\b|two.?way|you (collect|come|pick)|collect (them|it|after)|collecting (them|it)|same.?day collection/;
    // Explicit pickup phrasing — "collect FROM you/NW3/the warehouse", "come and collect" —
    // is a genuine switch to pickup and always wins over the return-journey reading.
    const explicitPickup = has(/\bwarehouse\b|\bnw3\b|come (and|to) collect|(pick.?up|pick (it|them) up|collect\w*).{0,12}\bfrom (you\b|yours\b|the warehouse|belsize)/);
    const collectReturn = !neg && hire.method === 'deliver' && !explicitPickup && has(RETURN_TWO);
    const wantsPickup = !neg && !collectReturn && has(/pick.?up|collect|warehouse|\bnw3\b/);
    const pcMatch = (text || '').match(/\b([A-Za-z]{1,2}\d[A-Za-z\d]?(?:\s*\d[A-Za-z]{2})?)\b/);
    const fullPc = !!(pcMatch && /\d[A-Za-z]{2}\s*$/.test(pcMatch[1].trim()));
    const pcZone = pcMatch && KB.classify && KB.classify(pcMatch[1]);
    // Only treat token as a postcode when mid-flow awaiting one, OR it has an inward code (e.g. "8DS")
    const looksPostcode = (pcZone && (hire.awaiting === 'postcode' || fullPc)) ? pcZone : null;

    // does THIS message carry an actionable hire slot? (used to apply changes at the review step)
    const hasSlotSignal = (matsN != null) || (guests != null) || (daysN != null) || !!dateVal || wantsPickup || !!looksPostcode || wantsDeliver || collectReturn;

    const aw = hire.awaiting;
    const inHireFlow = !!(aw && /^(mats|days|method|postcode|collection|date|confirm)$/.test(aw));

    // ===== collection step: answered in its own words, BEFORE the generic parse =====
    // ("collect" here means the courier's return journey, not NW3 pickup — so the
    // generic wantsPickup matcher must not see these answers.)
    if (aw === 'collection') {
      const oneW = has(RETURN_ONE);
      const twoW = has(RETURN_TWO) || has(/^(yes|yep|yeah|sure|please|ok|okay|default|recommended|first|collection)\b/);
      if (oneW || twoW) {
        const mode = oneW ? 'one' : 'two';
        const acts = [{ tool: 'set_collection', args: { collection: mode === 'one' ? 'one-way' : 'two-way' } }];
        const sayBit = mode === 'one'
          ? "Perfect — delivery only, and you'll drop the mats back to us in NW3 after your event. "
          : "Lovely — we'll deliver, then collect the same day once your event has finished. ";
        if (!hire.date) return mk(sayBit + 'And what date is your event?', acts, 'date');
        return mk(sayBit + 'Shall I put your quote together?', acts, 'review');
      }
      return { say: '', actions: [], matched: false, awaiting: aw };   // unclear → Tier 2 reads it
    }

    // --- bare answers interpreted in the context of what we just asked ---
    const bareNum = (t.match(/^(?:just\s+)?(?:the\s+)?(\d+)\b/) || [])[1];

    // ===== review gate: confirm they want the quote BEFORE we reveal it =====
    // A bare "no/not yet/actually" with NO new detail → deflect. But "actually make it Sunday"
    // carries a real change, so let it fall through to the hire flow (below) to be applied.
    if (aw === 'review' && !hasSlotSignal && has(/^(no|nope|not yet|hold on|wait|stop|change|actually)\b/))
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
      return mk("Wonderful. Your secure checkout link is in the panel, so that's you booked. Delivery the day before, collection on the day once you've finished. Welcome to SAÏA.", [{ tool: 'checkout' }], null);

    // explicit booking actions — also fired by the home basket buttons
    if (has(/^checkout\b|^pay\b|payment link|secure (checkout )?link/))
      return mk("Your secure checkout link is ready in the panel. That's you joining the club — anything else for your day?", [{ tool: 'checkout' }], null);
    if (has(/^confirm\b|^confirm booking|^book it now\b/))
      return mk('Confirmed. Delivery the day before, collection on the day once your event has finished. Welcome to SAÏA.', [{ tool: 'confirm' }], null);

    // ===== build / continue the hire flow =====
    // Trigger: mid-flow, or a fresh hire signal (a count, “hire”, “book”, “rent”, “event with mats”)
    // isProcessQ: “how does hire work?” etc. — these are FAQ questions, not booking signals
    const isProcessQ = /how (do|does|to)\b|how (it|this|the hire) works?|what is (mat )?hire|what'?s (mat )?hire|the process|how .* works?/.test(t);
    // FAQ markers — a question that merely mentions "hire/book" shouldn't start a booking
    // (e.g. "are mats cleaned between each hire?", "how far in advance should I book?").
    const isFaqQ = /\b(clean|cleaned|cleaning|hygien|wash|sanit|vat|tax|invoice|receipt|pay|payment|card|cash|cancel|refund|policy|insur|damage|broken|lost|strap|bag|advance|notice|how far|opening|open|hours)\b/.test(t);
    const freshHire = (matsN != null) || (guests != null) || (has(/\bhire\b|\brent\b|book .*mats|mat hire|\bquote\b/) && !isProcessQ && !isFaqQ);

    // HIRE-ONLY guard: mats are never sold. Intercept buy/purchase intent BEFORE the hire
    // flow turns "buy 30 mats to keep" into a booking. Warmly reframe to hire.
    if (has(/\b(buy|buying|purchase|purchasing|sell|selling|for sale|to keep|keep them|own them|owning|permanently|outright|forever)\b/) && (has(/mat/) || inHireFlow || freshHire))
      return m("We don't sell the mats, lovely — they're hire-only, so you get our studio-quality mats for your event and we handle everything after. Happy to set up a hire whenever you like; how many are you after?");

    // MAX-STOCK guard: we hold a hard ceiling of 50 mats. Intercept any bigger ask — a direct
    // "80 mats", a headcount that would need >50, or a bare number answering "how many mats?" —
    // BEFORE the hire flow quietly books it. Suggest reusing the same set across staggered
    // sessions; never book past stock. Re-asks the count so a workable number flows straight on.
    const MAXM = H.maxMats || 50;
    const askMats = (matsN != null) ? matsN
      : (guests != null && !hire.mats) ? rec(guests)
      : (aw === 'mats' && bareNum) ? parseInt(bareNum, 10)
      : null;
    if (askMats != null && askMats > MAXM)
      return mk("We've got up to " + MAXM + " mats available at the moment. If your classes run in staggered sessions, the same " + MAXM + " can often cover everyone, as they're reused between groups. If everyone needs a mat at the same time though, I'm afraid we couldn't go beyond our " + MAXM + ". How are your sessions running?", [], 'mats');

    // ACCESSORIES guard: mats only. Sits before the hire flow because "do you hire blocks?"
    // carries the word "hire" and would otherwise start a booking instead of answering.
    if (has(/\b(blocks?|bolsters?|blankets?|straps?|props?|cushions?|accessor\w*)\b/))
      return m("It's just the mats for us at the moment. We don't hire blocks, bolsters, blankets or any other props, only our yoga mats. How many mats are you after?");

    if (inHireFlow || freshHire || (aw === 'review' && hasSlotSignal)) {
      const h = Object.assign({}, hire);
      const actions = [];

      // mats / guests
      if (matsN != null) { h.mats = matsN; actions.push({ tool: 'add_mats', args: { n: matsN } }); }
      else if (guests != null && !h.mats) { h.guests = guests; h.mats = rec(guests); actions.push({ tool: 'recommend', args: { guests } }); }
      else if (aw === 'mats' && bareNum && daysN == null) { h.mats = parseInt(bareNum, 10); actions.push({ tool: 'add_mats', args: { n: h.mats } }); }

      // days
      if (daysN != null) { h.days = Math.max(H.hireDays, daysN); actions.push({ tool: 'set_days', args: { n: h.days } }); }
      else if (aw === 'days' && bareNum) { h.days = Math.max(H.hireDays, parseInt(bareNum, 10)); actions.push({ tool: 'set_days', args: { n: h.days } }); }

      // delivery method + postcode (pickup takes priority over postcode detection)
      if (wantsPickup) { h.method = 'pickup'; h.zone = null; h.postcode = null; actions.push({ tool: 'set_method', args: { method: 'pickup' } }); }
      else if (looksPostcode) { h.method = 'deliver'; h.postcode = pcMatch[1]; h.zone = looksPostcode.key; actions.push({ tool: 'set_postcode', args: { pc: pcMatch[1] } }); }
      else if (wantsDeliver) { h.method = 'deliver'; actions.push({ tool: 'set_method', args: { method: 'deliver' } }); }

      // date — explicit day+month or a weekday; vague dates fall to the handoff below
      if (dateVal) { h.date = dateVal; actions.push({ tool: 'set_date', args: { date: dateVal } }); }

      // one-way / two-way said outright, in any phrasing, mid-flow — includes the return-journey
      // reading of "collect them after" on a live delivery (collectReturn), so it lands here even
      // when a stale `awaiting` means the dedicated collection block above never ran.
      if (has(/\bone.?way\b|(return|bring|drop) (them|the mats).{0,14}(myself|ourselves|nw3)/)) {
        h.collection = 'one'; actions.push({ tool: 'set_collection', args: { collection: 'one-way' } });
      } else if (collectReturn || has(/both ways|two.?way|delivery and collection|deliver and collect/)) {
        h.collection = 'two'; actions.push({ tool: 'set_collection', args: { collection: 'two-way' } });
      }

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
        if (x.method === 'deliver' && !x.collection) return 'collection';
        if (!x.date) return 'date';
        return 'confirm';
      })(h);

      if (need === 'mats') return mk(
        (h.mats && h.mats < H.minMats)
          ? 'We hire from a minimum of ' + H.minMats + " mats — shall I set you up with " + H.minMats + ', or did you have a higher number in mind?'
          : "Lovely — let's plan your hire. How many mats do you need? (Minimum " + H.minMats + '.)',
        actions, 'mats');
      if (need === 'days') return mk((h.mats ? h.mats + ' mats — perfect. ' : '') + 'How many days do you need them? Our standard hire is ' + H.hireDays + ' days.', actions, 'days');
      if (need === 'method') return mk('Shall we deliver by courier, or will you collect from our NW3 warehouse?', actions, 'method');
      if (need === 'postcode') return mk("What's the event postcode? I'll work out the courier from there.", actions, 'postcode');
      if (need === 'collection') {
        const D = KB.delivery || { twoWay: 90, oneWay: 45 };
        return mk('And the return journey — shall our courier collect the mats once your event has finished (' + money(D.twoWay) + ' for delivery and same-day collection), or will you bring them back to NW3 yourself (' + money(D.oneWay) + ' delivery only)? Most people go with collection.', actions, 'collection');
      }

      // need the date before we quote anything
      if (need === 'date') return mk('And what date is your event? We deliver the day before and collect once it has finished.', actions, 'date');

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
    if (has(/who (runs|started|made|owns|is behind|founded)|founder|sa[ïi]a mean|meaning of|story behind|who.{0,4}cristina|about cristina|who is cristina|where.{0,14}cristina|cristina.{0,14}from/))
      return m(KB.founder.bio + ' ' + KB.founder.meaning);
    if (has(/what is sa[ïi]a|what'?s sa[ïi]a|about sa[ïi]a|tell me about (you|saia|saïa)|what do you (do|offer)/))
      return m((KB.club.what || 'SAÏA is a female-led club for women in London.') + ' Mostly I help with mat hire for events, plus community gatherings and Pilates with Cristina. Where shall we start?');

    // women-only space — men / husband / partner asking to attend
    if (has(/\b(men|man|male|males|husband|boyfriend|partner|son|guys|blokes|gentlemen)\b/) && has(/come|attend|join|allow|welcome|can (he|they|men|i)|bring|class|event|member|session/))
      return m("SAÏA is a women's space, lovely — our classes and gatherings are for women, so everyone can move and gather freely. Our mats, though, are for hire by anyone for any event. Anything I can help you plan?");

    // privacy — never share another member's details
    if ((has(/\bmembers?\b/) || has(/someone else|another (woman|member|guest)|other (people|women|members|guests)/)) && has(/\b(number|phone|email|contact|details?|reach)\b/) && has(/\b(give|share|get|have|provide|can you|could you|pass)\b/))
      return m("I can't share other members' details, I'm afraid — privacy matters here. But I'm happy to help you join the guest list, plan a hire, or book Pilates. What would you like?");

    // yoga (the teaching is Pilates; mats are for hire) — answer honestly, don't claim yoga classes
    if (has(/\byoga\b/) && !has(/mat/) && has(/\b(run|teach|offer|do you|have|class|classes|only|instead|vs|versus|difference|or pilates)\b/))
      return m("Our classes are Pilates with Cristina — small, breath-led sessions for women. We don't run yoga classes ourselves, but our mats are lovely for a yoga event and I can hire you a set whenever you like. Shall I help with mats, or tell you more about Pilates?");

    // Pilates / classes — answer questions, only place a request/waitlist on a clear intent
    if (has(/pilates|reformer|class(es)?|yoga session|work ?out|sessions?\b|\b1.?(2|to|on).?1\b|one.?to.?one/) && !has(/mat/)) {
      const email = (text || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      // pricing question → don't auto-request; pricing comes from Cristina
      if (has(/price|cost|how much|rate|fee|charge|expensive|per session|per class/))
        return m("Pilates with Cristina is tailored to you, so she shares rates directly — drop her a line at " + KB.contact.email + " or WhatsApp " + KB.contact.whatsapp + ". Shall I put a 1-2-1 request to her so she can come back with details?");
      // private 1-2-1 — request only when they want to book / give a day
      if (has(/1.?(2|to|on).?1|one.?to.?one|private|personal|just me/)) {
        const wantsBook = has(/book|request|arrange|set ?up|sign me|put me|sort|want|like to|let'?s|^yes\b/) || !!dateWord;
        return wantsBook
          ? m('Lovely — a private 1-2-1 with Cristina in NW3. Tell me a day or two that suit' + (dateWord ? ' (' + dateWord + ' works?)' : '') + ' and I’ll put your request to her; she confirms directly.',
            [{ tool: 'request_pilates', args: { type: '1-2-1', date: dateWord || null } }])
          : m('A private 1-2-1 with Cristina in NW3 — small, slow and breath-led. Want me to put a request to her? Tell me a day or two that suit and she confirms directly.');
      }
      // group / waitlist — join only with an email or a clear "add me" intent
      if (email)
        return m('Perfect — you’re on the Pilates waitlist. You’ll be first to hear the moment a group session opens.',
          [{ tool: 'join_pilates_list', args: { email: email[0] } }]);
      if (has(/group|wait ?list|notify|updates?|let me know|sign ?up|join the list|add me/))
        return m('Group Pilates runs as occasional events in Hampstead. Pop your email in and I’ll add you to the waitlist — you’ll hear the moment a session opens.');
      // generic — explain both, let them choose (no action)
      return m('Pilates with Cristina is ' + KB.pilates.method + ' ' + KB.pilates.format + ' For a 1-2-1 I can put a request to Cristina; group classes run as occasional events, so I can add you to the waitlist for updates. Which would you like?');
    }

    // events — list what's on; only RSVP on a clear "reserve me / I'll come" intent
    if (has(/what'?s on|whats on|upcoming|any events?|events\b|this month|brunch|book club|watercolou?r|gathering/) && !has(/\bmat|chair|table|equipment|furniture/)) {
      const wantsRsvp = has(/reserve|rsvp|book.*place|come to|coming to|attend|sign me|put me down|get me in|count me in|i'?d like to (come|go|attend)|can i come/);
      return m('This season: ' + KB.events.slice(0, 3).join(', ') + (wantsRsvp ? ". Consider it reserved — I'll pass your name on." : '. Want me to reserve you a place?'),
        wantsRsvp ? [{ tool: 'rsvp_event', args: { event: KB.events[0] } }] : []);
    }

    // membership / join — never auto-sign-up; only join with an email in hand
    if (has(/right for me|is (it|this) for me|join\b|member|belong|guest list|newsletter|sign ?up|community/)) {
      const email = (text || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      return email
        ? m("You're on the guest list — welcome. You'll be first to hear about the next gathering.", [{ tool: 'join_newsletter', args: { email: email[0] } }])
        : m("If you want to move, gather and breathe with women who lift each other up, this is your place — no pressure, no performing. " + KB.club.join + " Pop yours in and I'll add you.");
    }

    // mat spec
    if (has(/what (are|kind|type)|material|rubber|thick|how big|dimension|size|spec|pvc|slip|odou?r|smell|made of/) && (has(/mat/) || has(/rubber|thick|pvc|slip|odou?r/)))
      return m('Our mat is ' + H.mat.size + ', ' + H.mat.colour + ', ' + H.mat.material + ', ' + H.mat.features + '. We hire it from ' + money(H.pricePerMat) + ' a mat. How many are you expecting?');

    // how hire works
    if (has(/how (does|do|to)\s?(it|this|the hire|i|we)?\s?(work|hire|rent)|how does (it|hire) work|process/))
      return m('Simple: tell me your numbers and date, we deliver the day before (min ' + H.minMats + ' mats, from ' + money(H.pricePerMat) + ' each for a ' + H.hireDays + '-day hire) and collect after. Shall I start a quote?');

    // two-day hire rationale — "same-day delivery+collection, do I still pay two days?"
    const twoDayQ = (has(/same.?day/) && has(/hire|pay|charg|still|why|both|2.?day|two.?day/))
      || has(/why.*(2|two).?day|delivered and collected.*same/);
    if (twoDayQ)
      return m("It is, yes. Even when the mats arrive and leave on the same day, it's charged as our " + H.hireDays + "-day hire, because we reserve the mats for you and hold a 6-hour delivery window. That's why morning events usually get their mats the day before. Collection is then on the day itself, once you've finished.");

    // venue won't store overnight → deliver to office/home/colleague, bring over on the day
    const storageQ = has(/overnight|day before|storage|store the mats|store them/)
      && has(/can'?t|cannot|won'?t|wont|not (allow|accept|able)|no (delivery|deliveries)|doesn'?t|don'?t|refuse|venue/);
    if (storageQ)
      return m("No trouble at all. For early starts we can deliver to your office, home or a colleague the day before, and you bring the mats over on the day. It works beautifully for a lot of our clients. Where shall I send them?");

    // collaborations — measured no, with the tag-for-10%-refund offer
    if (has(/collab|partnership|work (with|together)|feature (your|the) mats|content (creator|in exchange)|influencer|ambassador|\bugc\b|in exchange for/))
      return m(KB.collab || "We love supporting other businesses, but as a small business we're not taking on collaborations right now. Tag @saialondon in content featuring our mats and share it with us, and we're happy to offer a 10% refund once we've received the agreed content.");

    // affiliate programme — yes, routed to Cristina personally
    if (has(/affiliate/))
      return m(KB.affiliate || ("We do have an affiliate programme. Email Cristina at " + (KB.contact && KB.contact.email) + " and she'll set you up personally."));

    // delivery / collection facts — answer both halves; they're usually asked together
    if (has(/deliver|courier|ship|drop ?off|bring them/))
      return m(H.delivery + ' Collection is on the day of your event once it has finished, with no cleaning needed as we take care of that, or you can drop them at our NW3 warehouse for free. Tell me your numbers and postcode and I\'ll price it.');
    if (has(/collect|return|pick.?up|pick them|after the event|clean|wash/))
      return m(H.collection + ' Prefer it brought to you? We courier across London too, just share your postcode.');

    // minimum order — MUST precede the location branch, which greedily matches "number"
    if (has(/\b(minimum|min|fewest|least|smallest|how few|at least)\b/) && has(/mat|order|hire|book|rent|need/))
      return m('Our minimum hire is ' + H.minMats + ' mats, from ' + money(H.pricePerMat) + ' a mat for a ' + H.hireDays + '-day hire. How many are you after?');

    // location / contact
    if (has(/where|location|nw3|warehouse|address|whats ?app|phone|number|contact|call|reach|email/))
      return m("We're " + (KB.contact.pickup || 'in London') + '. For the quickest service, email ' + KB.contact.person + ' at ' + KB.contact.email + '. Or tell me your numbers and I\'ll start your hire right here.');

    // VAT / invoices / receipts — Cristina handles the paperwork; never invent a tax answer
    if (has(/\bvat\b|invoice|receipt|\btax\b/))
      return m('For VAT, invoices or receipts, Cristina sorts those directly — drop her a line at ' + KB.contact.email + " and she'll handle the paperwork. Want me to put your hire numbers together in the meantime?");

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
