import { buildPayload } from './_builder.js';

// Legacy key-based export (kept for backwards compat / admin use)
const EXPORT_KEY = 'pthub_9r4xw2m8k6j3';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const { id, key } = req.query;

  if (!key || key !== EXPORT_KEY) {
    return res.status(403).json({ error: 'Invalid or missing key' });
  }
  if (!id) {
    return res.status(400).json({ error: 'Missing client id parameter' });
  }

  try {
    const payload = await buildPayload(id, null);
    if (!payload) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data', detail: err.message });
  }
}
