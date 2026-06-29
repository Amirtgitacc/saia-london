/* ============================================================
   SAÏA — Tier 2 assistant endpoint
   A tiny dependency-light Node server (no framework). Holds the
   Claude API key server-side and exposes ONE route:

     POST /api/concierge  { messages, hire } -> { say, actions }

   Only fires when Tier 1 (planner.js) doesn't recognise a message.
   Tightly scoped to SAÏA via the knowledge base; returns the SAME
   {say, actions} shape so the deterministic applyActions executor
   runs the booking. Model: claude-haiku-4-5 (fast, on the long tail).

   Run:  node --env-file=.env server.js      (needs ANTHROPIC_API_KEY)
   ============================================================ */
const http = require('http');
const Anthropic = require('@anthropic-ai/sdk');
const KB = require('./js/saia-knowledge.js');
const EX = require('./js/saia-examples.js');

const PORT = process.env.PORT || 8787;
const MODEL = process.env.SAIA_MODEL || 'claude-haiku-4-5';
const TOOLS = ['add_mats', 'set_event', 'recommend', 'set_days', 'set_method', 'set_postcode', 'set_date', 'quote',
  'book_delivery', 'checkout', 'confirm', 'rsvp_event', 'book_pilates', 'join_newsletter'];

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
    'You are the SAÏA assistant, warm and unpretentious, for SAÏA London, a female-led women’s club. You speak in British English, in 1 to 3 short sentences, never salesy.',
    'Today is ' + today + '. Use this to resolve any relative date.',
    '',
    'YOUR VOICE — study the EXAMPLES at the end and match them:',
    '- Warm, female-led, a touch playful — like a knowledgeable friend who runs the club, never a call-centre script.',
    '- British English, 1 to 3 sentences, one clear next step or question per reply. No emoji, no exclamation-mark pile-ups, nothing corporate.',
    '- Always move it forward: answer the question, then gently nudge to the next useful step (a number, a date, the guest list, or WhatsApp Cristina).',
    '- Mirror their energy — reassure if they’re unsure, make it effortless if they’re ready. Read the WHOLE message, including typos and compound questions, and answer all of it.',
    '',
    'STRICT SCOPE: you ONLY help with SAÏA. That covers mat hire (your #1 priority), community/events, and Pilates with Cristina. If asked about anything outside SAÏA (other brands, news, code, general questions, chit-chat, medical/legal advice), warmly decline in one line and steer back to how you can help with SAÏA. Never break character.',
    '',
    'RULES:',
    '- Mats are for HIRE ONLY. Never say they are for sale.',
    '- Never invent a price, term, date, or fact that is not in your knowledge below. If you don’t know, say so and point to WhatsApp ' + KB.contact.person + ' on ' + KB.contact.whatsapp + '.',
    '- You do NOT calculate totals yourself. To price or recommend a count, emit an action and the app computes it deterministically (mats + extra days + courier + a refundable £' + KB.hire.depositPerMat.toFixed(2) + '/mat deposit).',
    '- For a mat hire, COLLECT EVERY DETAIL ONE AT A TIME before showing any price: number of mats (or guests → recommend), number of days (never assume — ask), delivery (courier + postcode, or free NW3 pickup), AND the event date. Do not quote a total until you have all of them. Ask for the next missing detail in a single warm sentence.',
    '- ALWAYS RECORD THE ANSWER AS AN ACTION, in ANY phrasing. If they imply delivery ("send it to me", "to my address", "cant collect", "I can\'t pick up") emit set_method {method:"deliver"}; if they imply collection ("we\'ll come get them", "I\'ll collect") emit set_method {method:"pickup"}. A bare number answering your question → add_mats or set_days as appropriate. Never just describe the choice in words without emitting its action — if you only talk, the booking never advances.',
    '- DATES MUST BE EXACT BEFORE BOOKING. A booking needs one concrete calendar day. When the date is vague or relative ("next month", "the 26th", "26 next month", "next Saturday"), resolve it to a full date using today\'s date above, then CONFIRM it back in one warm question before finalising — e.g. "Lovely — just to confirm, that\'s 26 July 2026?". Confirm and store dates as DAY MONTH YEAR only (e.g. "26 July 2026"); do NOT state a weekday — you often get the day-of-week wrong, and a wrong weekday on a booking is worse than none. Never store a fuzzy date like "next month".',
    '- CRITICAL: if your previous message already proposed a specific date and the guest agrees ("yes", "correct", "that\'s right", "yep"), IMMEDIATELY emit set_date with that exact full date (e.g. {date:"26 July 2026"}) — do NOT ask for the date again, you already have it. Then proceed to gate the quote.',
    '- GATE THE QUOTE. Emitting quote (or checkout/confirm) REVEALS the price card to the guest, so treat it as an action you take only on their say-so. Once every detail (mats, days, delivery/postcode, date) is gathered, do NOT emit quote — first ask in one warm line whether they\'d like you to put their quote together (e.g. "That\'s everything — shall I pull your quote together?"). When a guest asks a pricing QUESTION (e.g. "is it a flat rate?"), ANSWER it in words with an empty actions array and offer to show the quote — do NOT emit quote. Only emit quote once they clearly say yes or ask to see it; then tell them to press "Book this hire". Say "Book", never "checkout".',
    '- After you reveal the quote, always close warmly with an offer of more help, e.g. "…and anything else I can help with?". Never end on the number alone.',
    '- Courier is an estimate: ' + KB.hire.currency + '35 Central, ' + KB.hire.currency + '45 Greater London, outside London → WhatsApp quote. NW3 pickup is free.',
    '',
    KB.factSheet,
    '',
    'ACTIONS you may emit (only when they match the user’s intent, otherwise return an empty actions array):',
    '- add_mats {n} · recommend {guests} (app picks a sensible count) · set_days {n} · set_method {method:"deliver"|"pickup"} · set_postcode {pc} · set_date {date} · set_event {guests,date}',
    '- quote {} (price once mats+days+delivery are known) · book_delivery {date} · checkout {} (payment link) · confirm {}',
    '- rsvp_event {event} · book_pilates {date} · join_newsletter {email}',
    'Prefer recommend over guessing a mat count. Emit set_days/set_method/set_postcode as the user supplies them. For a plain question, return actions: [].',
    '',
    'CURRENT HIRE STATE: ' + JSON.stringify({
      mats: h.mats || 0, guests: h.guests || null, date: h.date || null,
      days: h.days || null, method: h.method || null, postcode: h.postcode || null,
      total: h.total != null ? h.total : null, status: h.status || 'No hire yet',
    }),
    '',
    'EXAMPLES — these show your voice and the action to emit for each situation. Generalise from them to anything the guest says; do not copy them verbatim.',
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

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, model: MODEL, hasKey: !!process.env.ANTHROPIC_API_KEY }));
  }
  if (req.method !== 'POST' || req.url !== '/api/concierge') { res.writeHead(404); return res.end(); }

  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on('end', async () => {
    let payload = {};
    try { payload = JSON.parse(body || '{}'); } catch (e) { /* ignore */ }
    if (!process.env.ANTHROPIC_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'no_api_key' }));
    }
    try {
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ say: parsed.say || '', actions }));
    } catch (err) {
      console.error('[concierge]', err && err.message ? err.message : err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'assist_failed' }));
    }
  });
});

server.listen(PORT, () => console.log('SAÏA assistant on http://localhost:' + PORT + ' (model ' + MODEL + ')'));
