/* ============================================================
   SAÏA — concierge "Noor" deterministic brain (Tier 1)
   The dedicated core: knows the common situations cold —
   instant, free, always on-brand. Returns {say, actions, matched}.
   When `matched` is false the UI escalates to the Tier-2 Claude
   assist (server.js); Claude is the safety net, this is the product.
   Facts come from window.SAIA.KB (saia-knowledge.js) so the two
   brains can never drift. applyActions is unchanged — it stays the
   single deterministic booking executor for BOTH tiers.
   Exposed on window.SAIA.Planner
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});

  // Minimal fallback so scripted replies still work if the KB ever fails to load.
  const KB = NS.KB || {
    hire: { pricePerMat: 8.5, currency: '£', hireDays: 2, minMats: 10, extraDayPerMat: 1.5, bulkThreshold: 60,
      mat: { size: '68 × 185 cm, 4 mm thick', colour: 'black', material: 'natural rubber with a PU surface', features: 'non-slip and anti-odour' },
      delivery: 'Same-day courier across London from our Central London warehouse.',
      collection: 'We collect the day after. No need to clean them, we handle that.' },
    contact: { whatsapp: '07444 611 914', person: 'Cristina', pickup: 'NW3 warehouse' },
    club: { ethos: 'women who lift each other up', join: 'pop your email in to hear about gatherings' },
    pilates: { method: 'small, slow and breath-led', format: '1-2-1 in NW3, group in Hampstead' },
    founder: { name: 'Cristina', bio: 'Cristina founded SAÏA in 2020.', meaning: 'SAÏA means “A Woman Who Wins”.' },
    events: ['the Brunch Club', 'a watercolour morning', 'Book Club with afternoon tea'],
  };

  const H = KB.hire;
  const money = (v) => H.currency + Number(v).toFixed(2);

  function total(h) { return h.mats ? h.mats * H.pricePerMat : null; }

  /* ---- booking executor — deterministic, shared by both tiers (unchanged) ---- */
  function applyActions(hireState, actions) {
    let hire = Object.assign({}, hireState); const acts = [];
    (actions || []).forEach((a) => {
      const args = a.args || {};
      switch (a.tool) {
        case 'add_mats':
          hire.mats = Math.max(0, parseInt(args.n, 10) || 0); hire.total = total(hire);
          acts.push('Added ' + hire.mats + ' mats to your hire'); break;
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
        case 'quote': hire.total = total(hire); hire.status = 'Quoted'; acts.push('Prepared a quote: ' + money(H.pricePerMat) + ' / mat, ' + H.hireDays + '-day hire'); break;
        case 'book_delivery': if (args.date) hire.date = args.date; hire.status = 'Delivery scheduled'; acts.push('Scheduled delivery' + (hire.date ? ' · ' + hire.date : '')); break;
        case 'checkout': if (!hire.total) hire.total = total(hire); hire.status = 'Checkout link ready'; acts.push('Generated a secure Shopify checkout link'); break;
        case 'confirm': if (!hire.total) hire.total = total(hire); hire.status = 'Confirmed'; acts.push('Hire confirmed. Confirmation on its way'); break;
        case 'rsvp_event': acts.push('Reserved your place · ' + (args.event || 'SAÏA event')); break;
        case 'book_pilates': acts.push('Pilates with Cristina' + (args.date ? ' · ' + args.date : '') + ', held for you'); break;
        case 'join_newsletter': acts.push('Added you to the SAÏA guest list' + (args.email ? ' · ' + args.email : '')); break;
        default: break;
      }
    });
    return { hire, acts };
  }

  /* ---- Noor's brain: recognise the situation, script the reply ---- */
  function localPlan(text) {
    const t = (text || '').toLowerCase();
    const has = (re) => re.test(t);
    const nb = (re) => { const m = t.match(re); return m ? parseInt(m[1], 10) : null; };
    const guests = nb(/(\d+)\s*(?:people|guests|persons|pax|attendees|women|ladies|of us|girls)/);
    const matsN = nb(/(\d+)\s*mats?/);
    const day = (t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|this weekend|next week|next month)\b/) || [])[1];
    const rec = (g) => Math.max(H.minMats, Math.ceil(g * 1.1));
    const m = (say, actions) => ({ say, actions: actions || [], matched: true });

    // greeting / thanks — keep it human
    if (has(/^(hi|hey|hello|good (morning|afternoon|evening)|yo|hiya)\b/))
      return m('Hello, lovely. I’m Noor. I can plan mat hire for an event, share what’s on, or book you in for Pilates with Cristina. What brings you in?');
    if (has(/\b(thanks|thank you|cheers|ta)\b/))
      return m('Any time. Anything else I can sort for your day?');

    // who we are / founder / the name
    if (has(/who (runs|started|made|owns|is behind|founded)|founder|sa[ïi]a mean|meaning of|story behind|who'?s cristina|about cristina/))
      return m(KB.founder.bio + ' ' + KB.founder.meaning);
    if (has(/what is sa[ïi]a|what'?s sa[ïi]a|about sa[ïi]a|tell me about (you|saia|saïa)|what do you (do|offer)/))
      return m((KB.club.what || 'SAÏA is a female-led club for women in London.') + ' Mostly I help with mat hire for events, plus community gatherings and Pilates with Cristina. Where shall we start?');

    // Pilates / classes / yoga
    if (has(/pilates|reformer|class(es)?|yoga session|work ?out|sessions?\b/) && !has(/mat/)) {
      return m('Pilates with Cristina is ' + KB.pilates.method + '. ' + KB.pilates.format + '. Shall I hold you a place' + (day ? ' for ' + day : '') + '?',
        [{ tool: 'book_pilates', args: { date: day || null } }]);
    }

    // events / what's on / community  (require event-interest phrasing, not any stray "event")
    if (has(/what'?s on|whats on|upcoming|any events?|events\b|this month|brunch|book club|watercolou?r|gathering|community/))
      return m('This season: ' + KB.events.slice(0, 3).join(', ') + '. Want me to reserve you a place?',
        [{ tool: 'rsvp_event', args: { event: KB.events[0] } }]);

    // membership / join / "is it for me"
    if (has(/right for me|is (it|this) for me|join\b|member|belong|guest list|newsletter|sign ?up/))
      return m('If you want to move, gather and breathe with ' + KB.club.ethos + '. Yes, it’s for you. No pressure, no performing. ' + KB.club.join + ' and I’ll send the next gathering.',
        [{ tool: 'join_newsletter', args: {} }]);

    // mat spec
    if (has(/what (are|kind|type)|material|rubber|thick|how big|dimension|size|spec|pvc|slip|odou?r|smell|made of/) && (has(/mat/) || has(/rubber|thick|pvc|slip|odou?r/)))
      return m('Our mat is ' + H.mat.size + ', ' + H.mat.colour + ', ' + H.mat.material + ', ' + H.mat.features + '. We hire it from ' + money(H.pricePerMat) + ' a mat. How many are you expecting?');

    // how hire works
    if (has(/how (does|do|to)\s?(it|this|the hire|i|we)?\s?(work|hire|rent)|how does (it|hire) work|process/))
      return m('Simple: tell me your date and numbers, we deliver the day before (min ' + H.minMats + ' mats, from ' + money(H.pricePerMat) + ' each for a ' + H.hireDays + '-day hire) and collect after. Shall I start a quote?');

    // delivery
    if (has(/deliver|courier|ship|drop ?off|bring them/)) {
      if (day) return m('Delivery scheduled for ' + day + ', the day before your event.', [{ tool: 'book_delivery', args: { date: day } }]);
      return m(H.delivery + ' Tell me your date and I’ll book it in.');
    }

    // collection / return / cleaning
    if (has(/collect|return|pick.?up|pick them|after the event|clean|wash/))
      return m(H.collection);

    // location / contact
    if (has(/where|location|nw3|warehouse|address|whats ?app|phone|number|contact|call|reach|email/))
      return m('We’re ' + (KB.contact.pickup || 'in London') + '. For the quickest service, WhatsApp ' + KB.contact.person + ' on ' + KB.contact.whatsapp + '. Or tell me your numbers and I’ll start your hire right here.');

    // recommend for a headcount
    if (has(/recommend|how many|enough|need\b/) && guests)
      return m('For ' + guests + ' I’d allow a few spares. I’ve set ' + rec(guests) + ' mats. Want me to price it and arrange delivery?',
        [{ tool: 'recommend', args: { guests } }]);

    // a headcount → plan the whole hire
    if (guests) {
      const actions = [{ tool: 'set_event', args: { guests, date: day || null } }, { tool: 'recommend', args: { guests } }];
      if (day) actions.push({ tool: 'book_delivery', args: { date: day } });
      actions.push({ tool: 'quote' });
      return m('Done. ' + rec(guests) + ' mats for ' + guests + (day ? ', delivered ' + day : '') + '. Quote’s in the panel; say “checkout” and I’ll make your payment link.', actions);
    }

    // explicit mat count
    if (matsN) {
      const wantsPrice = has(/price|quote|cost|how much|rate/);
      const actions = [{ tool: 'add_mats', args: { n: matsN } }];
      if (wantsPrice) actions.push({ tool: 'quote' });
      return m(wantsPrice ? matsN + ' mats at ' + money(H.pricePerMat) + ' each for a ' + H.hireDays + '-day hire, priced above. Shall I arrange delivery?' : 'Added ' + matsN + ' mats. Want a price?', actions);
    }

    // pricing
    if (has(/price|quote|cost|how much|rate|charge/))
      return m(money(H.pricePerMat) + ' per mat for a ' + H.hireDays + '-day hire, minimum ' + H.minMats + '. Extra days are ' + money(H.extraDayPerMat) + ' a mat, plus courier delivery across London. Over ' + H.bulkThreshold + ' mats and I’ll arrange a reduced rate. Want me to price your numbers?',
        [{ tool: 'quote' }]);

    // checkout / pay
    if (has(/checkout|pay|payment|link|invoice/))
      return m('Your secure checkout link is ready in the panel. That’s you joining the club. Anything else for your day?',
        [{ tool: 'checkout' }]);

    // confirm
    if (has(/^(yes|yep|yeah|go ahead|do it|lock it|confirm|book it|sounds good|please)\b|confirm|book now/))
      return m('Confirmed. Delivery the day before, collection after. Welcome to SAÏA.',
        [{ tool: 'confirm' }]);

    // not recognised → let Tier 2 (Claude assist) take it
    return {
      say: 'I can plan your mat hire and make a checkout link, share what’s on, book Pilates with Cristina, or help you decide if SAÏA is for you. Where shall we start?',
      actions: [],
      matched: false,
    };
  }

  NS.Planner = { total, applyActions, localPlan };
})();
