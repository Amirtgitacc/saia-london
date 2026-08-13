/* ============================================================
   SAÏA — Tier 2 assistant endpoint (LOCAL dev server)
   A tiny dependency-light Node server (no framework). Holds the
   Claude API key server-side and exposes:

     POST /api/concierge  { messages, hire } -> { say, actions }
     POST /api/log        { session, page, turns } -> 204 (chat review log)
     POST /api/chat-log   { password } -> 204 + cookie (chat-log.html auth)
     GET  /api/chat-log   ?list=1 | ?session=<id> -> transcripts (needs cookie)
     GET  /health         -> { ok, model, hasKey, hasBlobStore }

   The actual brain lives in js/concierge-core.js, shared with the
   Vercel serverless function (api/concierge.js) so the two never
   drift. This file is just the local HTTP transport.

   Run:  node --env-file=.env server.js      (needs ANTHROPIC_API_KEY)
   In production we deploy on Vercel — see api/concierge.js + vercel.json.
   ============================================================ */
const http = require('http');
const { parse: parseUrl } = require('url');
const { MODEL, processConcierge } = require('./js/concierge-core.js');
const { normalizeLogPayload, storeChatLogs, readChatSessions, readChatSession } = require('./js/log-core.js');
const { applyCors } = require('./js/http-guard.js');
const { rateLimit, HAS_STORE } = require('./js/rate-limit.js');
// api/chat-log.js is the Vercel handler; its auth helpers are reused here so
// local dev (plain node:http req/res) and prod can never drift on the login logic.
const chatLog = require('./api/chat-log.js');

const PORT = process.env.PORT || 8787;
const RL_CONCIERGE = { name: 'concierge', limit: parseInt(process.env.RL_CONCIERGE_PER_MIN, 10) || 20, windowMs: 60000 };
const RL_LOG = { name: 'log', limit: parseInt(process.env.RL_LOG_PER_MIN, 10) || 60, windowMs: 60000 };
const RL_CHATLOG = { name: 'chat-log-auth', limit: parseInt(process.env.RL_CHATLOG_PER_15, 10) || 10, windowMs: 15 * 60 * 1000 };

const server = http.createServer((req, res) => {
  const cors = applyCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      model: MODEL,
      hasKey: !!process.env.ANTHROPIC_API_KEY,
      hasBlobStore: !!process.env.BLOB_READ_WRITE_TOKEN,
      hasChatLogAuth: !!(process.env.CHAT_LOG_PASSWORD && process.env.CHAT_LOG_SECRET),
      hasRateStore: HAS_STORE,
    }));
  }
  if (req.method === 'POST' && req.url === '/api/log') {
    if (!cors.allowed) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'forbidden_origin' })); }
    let logBody = '';
    req.on('data', (c) => { logBody += c; if (logBody.length > 1e5) req.destroy(); });
    req.on('end', async () => {
      const rl = await rateLimit(req, RL_LOG);
      if (!rl.ok) { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) }); return res.end(JSON.stringify({ error: 'rate_limited' })); }
      let payload = {};
      try { payload = JSON.parse(logBody || '{}'); } catch (e) { /* ignore */ }
      const rows = normalizeLogPayload(payload);
      if (!rows) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'bad_payload' })); }
      try {
        const out = await storeChatLogs(rows);
        if (!out.stored) rows.forEach((r) => console.log('[chat-log]', r.session_id.slice(0, 8), r.role + (r.tier ? '/' + r.tier : ''), '·', JSON.stringify(r.message)));
        res.writeHead(204); res.end();
      } catch (err) {
        console.error('[chat-log]', err && err.message ? err.message : err);
        res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'log_failed' }));
      }
    });
    return;
  }
  if (req.url === '/api/chat-log' || req.url.indexOf('/api/chat-log?') === 0) {
    if (!cors.allowed) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'forbidden_origin' })); }
    const password = process.env.CHAT_LOG_PASSWORD;
    const secret = process.env.CHAT_LOG_SECRET;
    if (!password || !secret) { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'not_configured' })); }

    if (req.method === 'POST') {
      let clBody = '';
      req.on('data', (c) => { clBody += c; if (clBody.length > 1e4) req.destroy(); });
      req.on('end', async () => {
        const rl = await rateLimit(req, RL_CHATLOG);
        if (!rl.ok) { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) }); return res.end(JSON.stringify({ error: 'rate_limited' })); }
        let payload = {};
        try { payload = JSON.parse(clBody || '{}'); } catch (e) { /* ignore */ }
        if (!chatLog.passwordMatches(payload && payload.password, password)) {
          res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'bad_password' }));
        }
        const token = chatLog.signToken(Date.now() + chatLog.TTL_MS, secret);
        // No Secure attribute here — this is a plain-http local dev server,
        // unlike the always-https api/chat-log.js Vercel function.
        res.writeHead(204, { 'Set-Cookie': chatLog.COOKIE + '=' + encodeURIComponent(token)
          + '; Path=/; Max-Age=' + Math.floor(chatLog.TTL_MS / 1000) + '; HttpOnly; SameSite=Strict' });
        res.end();
      });
      return;
    }

    if (req.method !== 'GET') { res.writeHead(404); return res.end(); }
    if (!chatLog.verifyToken(chatLog.readCookie(req, chatLog.COOKIE), secret, Date.now())) {
      res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'unauthorised' }));
    }
    const query = parseUrl(req.url, true).query;
    (async () => {
      try {
        if (query.session) {
          const out = await readChatSession(String(query.session));
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
        } else {
          const sessions = await readChatSessions();
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ sessions: sessions }));
        }
      } catch (err) {
        console.error('[chat-log-read]', err && err.message ? err.message : err);
        res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'read_failed' }));
      }
    })();
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/concierge') { res.writeHead(404); return res.end(); }
  if (!cors.allowed) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'forbidden_origin' })); }

  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on('end', async () => {
    const rl = await rateLimit(req, RL_CONCIERGE);
    if (!rl.ok) { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) }); return res.end(JSON.stringify({ error: 'rate_limited' })); }
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
