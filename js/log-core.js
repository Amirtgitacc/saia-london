/* ============================================================
   SAÏA — chat transcript logging core (shared brain)
   Used by BOTH transports so they never drift:
     • api/log.js  — Vercel serverless function (prod)
     • server.js   — local dev server

   normalizeLogPayload() validates/clamps what the browser sent;
   insertChatLogs() writes the rows to the Supabase `chat_logs`
   table via its REST API. No Supabase env vars → rows are
   accepted and dropped, so the site needs zero setup to work.
   ============================================================ */
const ROLES = { user: true, bot: true, act: true };
const MAX_MESSAGE = 4000;
const MAX_TURNS = 20;

// { session, page, turns:[{role, tier, message}] } -> insert-ready rows (or null)
function normalizeLogPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const session = String(payload.session || '').slice(0, 64);
  if (!session.trim()) return null;
  const page = payload.page ? String(payload.page).slice(0, 200) : null;
  const turns = Array.isArray(payload.turns) ? payload.turns : [];
  const rows = [];
  turns.slice(0, MAX_TURNS).forEach((t) => {
    if (!t || typeof t !== 'object') return;
    const role = String(t.role || '');
    const message = String(t.message || '').slice(0, MAX_MESSAGE);
    if (!ROLES[role] || !message.trim()) return;
    rows.push({
      session_id: session,
      role: role,
      tier: t.tier ? String(t.tier).slice(0, 16) : null,
      message: message,
      page: page,
    });
  });
  return rows.length ? rows : null;
}

async function insertChatLogs(rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { stored: false, reason: 'no_supabase_env' };
  const res = await fetch(url.replace(/\/+$/, '') + '/rest/v1/chat_logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: 'Bearer ' + key,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error('supabase insert failed: http ' + res.status);
  return { stored: true };
}

module.exports = { normalizeLogPayload, insertChatLogs };
