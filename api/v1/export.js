import crypto from 'crypto';
import { SB_URL, HEADERS, buildPayload } from '../_builder.js';

const RATE_LIMIT = 100; // per hour per token

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'GET only' } });
  }

  // --- Auth ---
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
  }
  const token = authHeader.slice(7).trim();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Atomically tick the rate-limit counter and return token metadata.
  // tick_api_token is a SECURITY DEFINER plpgsql function that resets
  // the window after 1 hour and increments otherwise.
  const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/tick_api_token`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_hash: tokenHash }),
  });

  if (!rpcRes.ok) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Auth check failed' } });
  }

  const rows = await rpcRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
  if (row.revoked_at) {
    return res.status(403).json({ error: { code: 'REVOKED', message: 'Token has been revoked' } });
  }

  const resetAt = new Date(new Date(row.window_start).getTime() + 3600000);
  const remaining = Math.max(0, RATE_LIMIT - row.cnt);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.floor(resetAt.getTime() / 1000));

  if (row.cnt > RATE_LIMIT) {
    return res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Resets at ' + resetAt.toISOString() },
    });
  }

  // --- Fetch and return data ---
  const { since } = req.query;
  try {
    const payload = await buildPayload(row.client_id, since || null);
    if (!payload) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    }
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}
