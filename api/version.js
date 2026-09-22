// Tells the client which deploy is currently live, so the app can detect a new version was pushed
// and offer/trigger a refresh. VERCEL_GIT_COMMIT_SHA is set automatically by Vercel on every deploy
// (no manual bumping needed) — falls back to a boot-time timestamp for local/non-Vercel runs, which
// still correctly signals "different process" across a restart.
const BOOT_FALLBACK = String(Date.now());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const version = process.env.VERCEL_GIT_COMMIT_SHA || BOOT_FALLBACK;
  res.status(200).json({
    version,
    short: version.slice(0, 7),
    deployedAt: process.env.VERCEL_GIT_COMMIT_SHA ? null : new Date(Number(BOOT_FALLBACK)).toISOString(),
  });
}
