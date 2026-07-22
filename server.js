/* ============================================================
   SAÏA — Tier 2 assistant endpoint (LOCAL dev server)
   A tiny dependency-light Node server (no framework). Holds the
   Claude API key server-side and exposes:

     POST /api/concierge  { messages, hire } -> { say, actions }
     POST /api/log        { session, page, turns } -> 204 (chat review log)
     GET  /health         -> { ok, model, hasKey, hasSupabase }

   The actual brain lives in js/concierge-core.js, shared with the
   Vercel serverless function (api/concierge.js) so the two never
   drift. This file is just the local HTTP transport.

   Run:  node --env-file=.env server.js      (needs ANTHROPIC_API_KEY)
   In production we deploy on Vercel — see api/concierge.js + vercel.json.
   ============================================================ */
const http = require('http');
const { MODEL, processConcierge } = require('./js/concierge-core.js');
const { normalizeLogPayload, insertChatLogs } = require('./js/log-core.js');

const PORT = process.env.PORT || 8787;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, model: MODEL, hasKey: !!process.env.ANTHROPIC_API_KEY, hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) }));
  }
  if (req.method === 'POST' && req.url === '/api/log') {
    let logBody = '';
    req.on('data', (c) => { logBody += c; if (logBody.length > 1e5) req.destroy(); });
    req.on('end', async () => {
      let payload = {};
      try { payload = JSON.parse(logBody || '{}'); } catch (e) { /* ignore */ }
      const rows = normalizeLogPayload(payload);
      if (!rows) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'bad_payload' })); }
      try {
        const out = await insertChatLogs(rows);
        if (!out.stored) rows.forEach((r) => console.log('[chat-log]', r.session_id.slice(0, 8), r.role + (r.tier ? '/' + r.tier : ''), '·', r.message));
        res.writeHead(204); res.end();
      } catch (err) {
        console.error('[chat-log]', err && err.message ? err.message : err);
        res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'log_failed' }));
      }
    });
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/concierge') { res.writeHead(404); return res.end(); }

  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on('end', async () => {
    let payload = {};
    try { payload = JSON.parse(body || '{}'); } catch (e) { /* ignore */ }
    try {
      const out = await processConcierge(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    } catch (err) {
      if (err && err.code === 'no_api_key') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'no_api_key' }));
      }
      console.error('[concierge]', err && err.message ? err.message : err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'assist_failed' }));
    }
  });
});

server.listen(PORT, () => console.log('SAÏA assistant on http://localhost:' + PORT + ' (model ' + MODEL + ')'));
