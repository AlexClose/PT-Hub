import crypto from 'crypto';
import { SB_URL, HEADERS } from '../_builder.js';

const MINT_SECRET = process.env.MINT_SECRET;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }
  if (!MINT_SECRET) {
    return res.status(503).json({ error: { code: 'NOT_CONFIGURED', message: 'MINT_SECRET env var not set' } });
  }

  const { secret, client_id, label } = req.body || {};
  if (!secret || secret !== MINT_SECRET) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid secret' } });
  }
  if (!client_id) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing client_id' } });
  }

  const plaintext = 'pt_' + crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plaintext).digest('hex');

  const insertRes = await fetch(`${SB_URL}/rest/v1/api_tokens`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ client_id, token_hash: tokenHash, label: label || '' }),
  });

  if (!insertRes.ok) {
    const detail = await insertRes.text();
    return res.status(500).json({ error: { code: 'DB_ERROR', message: detail } });
  }

  const row = (await insertRes.json())[0];

  // Plaintext token returned once — never stored
  res.status(201).json({
    token: plaintext,
    id: row.id,
    client_id: row.client_id,
    label: row.label,
    created_at: row.created_at,
    warning: 'Store this token securely — it will never be shown again.',
  });
}
