/* ============================================================
   SAÏA — shared CORS + origin allowlist for the API endpoints
   Used by BOTH transports so they never drift:
     • server.js        — local dev server
     • api/concierge.js — Vercel serverless function (prod)
     • api/log.js       — Vercel serverless function (prod)

   The concierge/log endpoints are public and call paid services
   (Claude, Supabase). We can't require a user login on a static
   marketing site, but we can refuse browser requests coming from
   OTHER websites: legit callers are the SAÏA site itself (same
   origin) and, once published, the Shopify storefront. A foreign
   Origin header means another site's JS is driving our endpoint —
   reject it. (This does not stop a scripted non-browser client,
   which needs rate limiting; see the note in the audit.)

   Add origins without a code change via SAIA_ALLOWED_ORIGINS
   (comma-separated) in the environment.
   ============================================================ */
const DEFAULT_ORIGINS = [
  'https://saia-london.vercel.app',   // live Vercel site (same-origin caller)
  'https://saialondon.com',           // Shopify storefront (custom domain)
  'https://www.saialondon.com',
  'https://saialondon.myshopify.com', // Shopify default domain
  'http://localhost:8000',            // local static site (python http.server)
  'http://127.0.0.1:8000',
  'http://localhost:8787',            // local dev API host
];

function allowedOrigins() {
  const extra = (process.env.SAIA_ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return new Set(DEFAULT_ORIGINS.concat(extra));
}

/* Sets the CORS response headers and reports whether the request may proceed.
   Returns { origin, hasOrigin, allowed } where:
     - allowlisted Origin  → echoed back in ACAO (never '*'); allowed:true
     - foreign Origin       → no ACAO header set; allowed:false (caller should 403)
     - no Origin (curl / same-origin non-CORS request) → allowed:true, no ACAO needed
   Only a browser on a third-party page sends a foreign Origin, so this blocks
   cross-site drive-by abuse without breaking same-origin or tooling callers. */
function applyCors(req, res) {
  const origin = req.headers && req.headers.origin;
  const set = allowedOrigins();
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (origin && set.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    return { origin, hasOrigin: true, allowed: true };
  }
  return { origin: origin || null, hasOrigin: !!origin, allowed: !origin };
}

module.exports = { applyCors, allowedOrigins, DEFAULT_ORIGINS };
