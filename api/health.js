/* SAÏA — concierge health check (Vercel serverless function).
   GET /api/health -> { ok, model, hasKey, hasBlobStore, hasChatLogAuth, hasRateStore }

   Every flag is a BOOLEAN presence check, never a value — this endpoint is public.
   Each one covers a setting whose absence fails silently or invisibly:
     hasBlobStore    /api/log returns 204 even with no Blob env, dropping the row
     hasChatLogAuth  without both vars /api/chat-log 503s and Cristina cannot read
                     transcripts we are still writing
     hasRateStore    with no shared store the per-IP limiter is per-instance
                     best-effort on serverless, so the cost guard is much weaker */
const { MODEL } = require('../js/concierge-core.js');
const { HAS_STORE } = require('../js/rate-limit.js');

module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    model: MODEL,
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    hasBlobStore: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasChatLogAuth: !!(process.env.CHAT_LOG_PASSWORD && process.env.CHAT_LOG_SECRET),
    hasRateStore: HAS_STORE,
  });
};
