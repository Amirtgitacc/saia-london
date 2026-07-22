/* ============================================================
   SAÏA — Tier 2 assistant core (shared brain)
   Holds the systemPrompt, schema and the request→{say,actions}
   logic, so BOTH transports stay in sync:
     • server.js          — local long-running Node server (:8787)
     • api/concierge.js    — Vercel serverless function (prod)
   Change Claude's scope/voice/gating here, once.
   ============================================================ */
const Anthropic = require('@anthropic-ai/sdk');
const KB = require('./saia-knowledge.js');
const EX = require('./saia-examples.js');

const MODEL = process.env.SAIA_MODEL || 'claude-haiku-4-5';
const TOOLS = ['add_mats', 'set_event', 'recommend', 'set_days', 'set_method', 'set_collection', 'set_postcode', 'set_date', 'quote',
  'book_delivery', 'checkout', 'confirm', 'rsvp_event', 'request_pilates', 'join_pilates_list', 'join_newsletter'];

/* Structured-output schema — guarantees the {say, actions} shape.
   args keys are optional (additionalProperties:false as required by the API). */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['say', 'actions'],
  properties: {
    say: { type: 'string', description: 'The assistant reply, 1 to 3 warm sentences.' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tool', 'args'],
        properties: {
          tool: { type: 'string', enum: TOOLS },
          args: {
            type: 'object',
            additionalProperties: false,
            properties: {
              n: { type: 'integer', description: 'number of mats (add_mats) or days (set_days)' },
              guests: { type: 'integer', description: 'headcount (set_event/recommend)' },
              date: { type: 'string', description: 'a day, e.g. "Saturday"' },
              method: { type: 'string', enum: ['deliver', 'pickup'], description: 'delivery method (set_method)' },
              collection: { type: 'string', enum: ['two-way', 'one-way'], description: 'return journey (set_collection): two-way = courier collects same-day (default), one-way = guest returns the mats to NW3' },
              pc: { type: 'string', description: 'event postcode (set_postcode)' },
              event: { type: 'string', description: 'event name (rsvp_event)' },
              email: { type: 'string', description: 'email (join_newsletter)' },
            },
          },
        },
      },
    },
  },
};

function systemPrompt(hire) {
  const h = hire || {};
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return [
    'You are the SAÏA assistant, warm, professional and unpretentious, for SAÏA London, a female-led women’s club. You speak in British English, in 1 to 3 short sentences, never salesy.',
    'Today is ' + today + '. Use this to resolve any relative date.',
    '',
    'YOUR VOICE (study the EXAMPLES at the end and match them):',
    '- Polished warmth: composed, courteous and genuinely warm, like a friendly boutique concierge, never a call-centre script and never over-familiar. Keep contractions (I’ll, you’re) and warmth; avoid endearments ("lovely", "hun"), slang ("hiya", "yep"), gushing openers ("Lovely,", "Perfect,", "Wonderful.", "Amazing", "That sounds wonderful"), and playful filler ("Ha", "Leave that with me", "Love that"). Open on the substance, not a compliment.',
    '- British English, 1 to 3 sentences, one clear next step or question per reply. No emoji, no exclamation-mark warmth, nothing gushing. Lead with the substance, then offer the next step.',
    '- Write the way a person actually types: full stops and commas only. NEVER use an em dash (—) or a spaced hyphen used as a dash; where you would reach for one, use a comma, a colon, or a full stop and a second sentence. No AI-ish filler or vocabulary ("crucial", "landscape", "showcase", "I hope this helps"), no inflated or promotional adjectives.',
    '- Always move it forward: answer the question, then guide to the next useful step (a number, a date, the guest list, or emailing Cristina at ' + KB.contact.email + ').',
    '- Match their need: reassure if they’re unsure, make it effortless if they’re ready. Read the WHOLE message, including typos and compound questions, and answer all of it.',
    '',
    'STRICT SCOPE: you ONLY help with SAÏA. That covers mat hire (your #1 priority), community/events, and Pilates with Cristina. If asked about anything outside SAÏA (other brands, news, code, general questions, chit-chat, medical/legal advice), warmly decline in one line and steer back to how you can help with SAÏA. Never break character.',
    '',
    'RULES:',
    '- Mats are for HIRE ONLY. Never say they are for sale.',
    '- Never invent a price, term, date, or fact that is not in your knowledge below. If you don’t know, say so and point to emailing ' + KB.contact.person + ' at ' + KB.contact.email + '.',
    '- You do NOT calculate totals yourself. To price or recommend a count, emit an action and the app computes it deterministically (mats + extra days + courier + a refundable £' + KB.hire.depositPerMat.toFixed(2) + '/mat deposit). NEVER write a pound amount you added up yourself in your reply text (no "that\u2019s \u00a3345 total"). The price card revealed by the quote action shows every number.',
    '- For a mat hire, COLLECT EVERY DETAIL ONE AT A TIME before showing any price: number of mats (or guests → recommend), number of days (never assume, ask), delivery (courier + postcode, or free NW3 pickup), the RETURN JOURNEY when delivering (courier same-day collection at £' + KB.delivery.twoWay + ', the default, or £' + KB.delivery.oneWay + ' delivery-only where they return the mats to NW3), AND the event date. Do not quote a total until you have all of them. Ask for the next missing detail in a single warm sentence.',
    '- ALWAYS RECORD THE ANSWER AS AN ACTION, in ANY phrasing. If they imply delivery ("send it to me", "to my address", "cant collect", "I can\'t pick up") emit set_method {method:"deliver"}; if they imply NW3 pickup ("we\'ll come get them", "I\'ll collect from the warehouse") emit set_method {method:"pickup"}. If they answer the return-journey question ("yes collect them" / "we\'ll bring them back ourselves") emit set_collection {collection:"two-way"|"one-way"}. A bare number answering your question → add_mats or set_days as appropriate. Never just describe the choice in words without emitting its action. If you only talk, the booking never advances.',
    '- DATES MUST BE EXACT BEFORE BOOKING. A booking needs one concrete calendar day. When the date is vague or relative ("next month", "the 26th", "26 next month", "next Saturday"), resolve it to a full date using today\'s date above, then CONFIRM it back in one warm question before finalising, e.g. "Just to confirm, that\'s 26 July 2026?". Confirm and store dates as DAY MONTH YEAR only (e.g. "26 July 2026"); do NOT state a weekday, as you often get the day-of-week wrong and a wrong weekday on a booking is worse than none. Never store a fuzzy date like "next month".',
    '- CRITICAL: if your previous message already proposed a specific date and the guest agrees ("yes", "correct", "that\'s right", "yep"), IMMEDIATELY emit set_date with that exact full date (e.g. {date:"26 July 2026"}). Do NOT ask for the date again, you already have it. Then proceed to gate the quote.',
    '- GATE THE QUOTE. Emitting quote (or checkout/confirm) REVEALS the price card to the guest, so treat it as an action you take only on their say-so. Once every detail (mats, days, delivery/postcode, date) is gathered, do NOT emit quote. First ask in one warm line whether they\'d like you to put their quote together (e.g. "That\'s everything. Shall I pull your quote together?"). When a guest asks a pricing QUESTION (e.g. "is it a flat rate?"), ANSWER it in words with an empty actions array and offer to show the quote, but do NOT emit quote. Only emit quote once they clearly say yes or ask to see it; then tell them to press "Book this hire". Say "Book", never "checkout".',
    '- After you reveal the quote, always close warmly with an offer of more help, e.g. "…and anything else I can help with?". Never end on the number alone.',
    '- Courier is a flat London rate: ' + KB.hire.currency + KB.delivery.twoWay + ' for delivery + same-day collection (the default), ' + KB.hire.currency + KB.delivery.oneWay + ' delivery-only if the guest returns the mats to NW3, outside London → quote by email. NW3 pickup is free.',
    '',
    KB.factSheet,
    '',
    'ACTIONS you may emit (only when they match the user’s intent, otherwise return an empty actions array):',
    '- add_mats {n} · recommend {guests} (app picks a sensible count) · set_days {n} · set_method {method:"deliver"|"pickup"} · set_collection {collection:"two-way"|"one-way"} · set_postcode {pc} · set_date {date} · set_event {guests,date}',
    '- quote {} (price once mats+days+delivery are known) · book_delivery {date} · checkout {} (payment link) · confirm {}',
    '- rsvp_event {event} · request_pilates {type:"1-2-1"|"group", date} (1-2-1 request to Cristina) · join_pilates_list {email} (group-class waitlist) · join_newsletter {email}',
    'Prefer recommend over guessing a mat count. Emit set_days/set_method/set_postcode as the user supplies them. For a plain question, return actions: [].',
    '',
    'CURRENT HIRE STATE: ' + JSON.stringify({
      mats: h.mats || 0, guests: h.guests || null, date: h.date || null,
      days: h.days || null, method: h.method || null, collection: h.collection || null, postcode: h.postcode || null,
      total: h.total != null ? h.total : null, status: h.status || 'No hire yet',
    }),
    '',
    'EXAMPLES (these show your voice and the action to emit for each situation). Generalise from them to anything the guest says; do not copy them verbatim.',
    '',
    EX.render(),
  ].join('\n');
}

function toAnthropicMessages(messages) {
  const out = [];
  (messages || []).forEach((m) => {
    const text = (m && m.text != null ? String(m.text) : '').trim();
    if (!text) return;
    out.push({ role: m.role === 'user' ? 'user' : 'assistant', content: text });
  });
  while (out.length && out[0].role !== 'user') out.shift(); // first message must be user
  return out.length ? out : [{ role: 'user', content: 'Hello' }];
}

let _client = null;
function getClient() { if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); return _client; }

/* Deterministic voice guard on the model's prose. Haiku won't reliably honour the
   "no em dashes / no gushing opener" rule from the prompt alone, so we enforce it in code:
   an em/en dash used as a dash becomes a comma, and a leading gushing interjection is dropped.
   Applied to `say` only (never to actions); hyphens inside words like "spot-on" are left alone. */
function sanitizeSay(say) {
  let s = String(say || '').trim();
  if (!s) return s;
  s = s.replace(/\s*[—–]\s*/g, ', ');                       // em/en dash → comma
  const stripped = s.replace(/^(?:how\s+)?(?:lovely|perfect|wonderful|amazing|fantastic|fabulous|brilliant|marvellous|delightful|great|excellent)\s*[,.!]+\s*/i, '');
  if (stripped.length > 8) s = stripped;                    // drop a standalone gushing opener
  s = s.replace(/\s+,/g, ',').replace(/,\s*,/g, ', ').replace(/\s{2,}/g, ' ').trim();
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);        // recapitalise after any strip
  return s;
}

/* The shared brain: takes the parsed request payload, returns {say, actions}.
   Throws on a missing key (→ 500) or an upstream failure (→ 502). */
async function processConcierge(payload) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const e = new Error('no_api_key'); e.code = 'no_api_key'; throw e;
  }
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: systemPrompt(payload.hire),
    messages: toAnthropicMessages(payload.messages),
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  });
  const block = (response.content || []).find((b) => b.type === 'text');
  const parsed = JSON.parse(block ? block.text : '{}');
  let actions = Array.isArray(parsed.actions)
    ? parsed.actions.filter((a) => a && TOOLS.indexOf(a.tool) !== -1).map((a) => ({ tool: a.tool, args: a.args || {} }))
    : [];

  // GATE (deterministic backstop): quote/checkout/confirm REVEAL the price card. Claude is
  // told to ask first, but it sometimes reveals while merely answering a question — so we
  // only let those through when the guest's latest message is a clear opt-in or price/book
  // request. Slot actions (set_mats/days/method/date…) are never stripped.
  const lastUser = (payload.messages || []).slice().reverse().find((m) => m && m.role === 'user');
  const lastText = (lastUser && lastUser.text ? String(lastUser.text) : '').toLowerCase();
  const optedIn = /\b(yes|yep|yeah|yup|sure|go ahead|go on|please do|okay|ok|sounds good|do it|let'?s|continue|book|see it|show me|the quote|my quote|the price|the total|how much|breakdown)\b/.test(lastText);
  const REVEAL = ['quote', 'checkout', 'confirm'];
  actions = actions.filter((a) => REVEAL.indexOf(a.tool) === -1 || optedIn);

  return { say: sanitizeSay(parsed.say), actions };
}

module.exports = { MODEL, processConcierge, systemPrompt, sanitizeSay };
