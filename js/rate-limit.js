/* ============================================================
   SAÏA — shared per-IP rate limiter for the API endpoints
   Used by BOTH transports so they never drift:
     • server.js        — local dev server
     • api/concierge.js — Vercel serverless function (prod)
     • api/log.js       — Vercel serverless function (prod)

   The concierge/log endpoints are public and call paid services, so a
   scripted client (which can spoof the Origin header the allowlist checks)
   could still run up cost. This caps requests per IP per window.

   Fixed-window counter. Vercel's serverless functions are stateless and
   horizontally scaled, so an in-memory count wouldn't limit anything in
   prod — we use a shared store (Upstash Redis / Vercel KV, both speak the
   same REST API) when its env vars are set:
       UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
   (or Vercel KV's KV_REST_API_URL + KV_REST_API_TOKEN).
   With no store we fall back to an in-memory window: correct for the
   single-process local server, best-effort (per-instance) on serverless.

   Fails OPEN on a store error: a Redis blip must not 500 the concierge.
   ============================================================ */

const STORE_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const STORE_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const HAS_STORE = !!(STORE_URL && STORE_TOKEN);

function clientIp(req) {
  const h = (req && req.headers) || {};
  // Prefer x-real-ip: the edge proxy (Vercel) sets it to the true client IP and
  // overwrites any client-sent value. x-forwarded-for may carry client-injected
  // hops, so only trust its FIRST entry as a fallback when x-real-ip is absent.
  if (h['x-real-ip']) return String(h['x-real-ip']).trim();
  if (h['x-forwarded-for']) return String(h['x-forwarded-for']).split(',')[0].trim();
  return (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

/* ---- in-memory fallback (single-process / best-effort) ---- */
const mem = new Map(); // key -> { count, resetAt }
function memHit(key, limit, windowMs, now) {
  if (mem.size > 5000) { for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k); }
  const rec = mem.get(key);
  if (!rec || now >= rec.resetAt) {
    const resetAt = now + windowMs;
    mem.set(key, { count: 1, resetAt });
    return { count: 1, resetAt };
  }
  rec.count += 1;
  return { count: rec.count, resetAt: rec.resetAt };
}

/* ---- shared store (Upstash Redis / Vercel KV REST) ----
   One round trip: INCR the window key, then set its TTL. The key name
   already encodes the window start, so re-setting the TTL each hit does
   not extend the logical window — it only cleans the key up afterwards. */
async function storeHit(key, windowSec) {
  const res = await fetch(STORE_URL.replace(/\/+$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + STORE_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', key], ['EXPIRE', key, windowSec]]),
  });
  if (!res.ok) throw new Error('rate-limit store http ' + res.status);
  const data = await res.json();          // [{ result: count }, { result: 1 }]
  return Number(data && data[0] && data[0].result) || 0;
}

let warned = false;

/* rateLimit(req, { name, limit, windowMs, now? }) -> { ok, count, limit, remaining, retryAfter }
   name  — a bucket label so different endpoints don't share a counter.
   now   — injectable clock for tests (defaults to Date.now()). */
async function rateLimit(req, opts) {
  const name = (opts && opts.name) || 'default';
  const limit = (opts && opts.limit) || 60;
  const windowMs = (opts && opts.windowMs) || 60000;
  const now = (opts && opts.now != null) ? opts.now : Date.now();
  const windowSec = Math.ceil(windowMs / 1000);
  const windowStart = Math.floor(now / windowMs);
  const key = 'rl:' + name + ':' + clientIp(req) + ':' + windowStart;
  const resetAt = (windowStart + 1) * windowMs;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));

  if (HAS_STORE) {
    try {
      const count = await storeHit(key, windowSec);
      return { ok: count <= limit, count, limit, remaining: Math.max(0, limit - count), retryAfter };
    } catch (err) {
      console.error('[rate-limit] store error, allowing request:', err && err.message ? err.message : err);
      return { ok: true, count: 0, limit, remaining: limit, retryAfter: 0, degraded: true };
    }
  }

  if (!warned && process.env.VERCEL) {
    warned = true;
    console.warn('[rate-limit] no UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_*) set — limiting is per-instance best-effort only.');
  }
  const r = memHit(key, limit, windowMs, now);
  return { ok: r.count <= limit, count: r.count, limit, remaining: Math.max(0, limit - r.count), retryAfter };
}

module.exports = { rateLimit, clientIp, HAS_STORE };
