import { SB_URL, HEADERS } from './_builder.js';

// Daily data-safety-net export. Supabase's free tier has NO automatic backups — this pulls every
// business table and commits it as a dated JSON file in the repo (a second copy, in a completely
// separate system, on top of whatever Supabase-side backup plan is in place). Triggered by Vercel
// Cron (see vercel.json "crons") — Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
// on cron-triggered requests when the CRON_SECRET env var is set, which this checks below.
//
// This is a data EXPORT, not a one-click restore — recovering from one of these files means writing
// a small script at the time to re-POST the rows back into Supabase. Keeping the export complete and
// well-formed here is what makes that possible later.

const OWNER = 'alexclose';
const REPO = 'pt-hub';
const CRON_SECRET = process.env.CRON_SECRET;
const GH_BACKUP_TOKEN = process.env.GH_BACKUP_TOKEN;

const TABLES = ['clients', 'sessions', 'exercise_logs', 'run_programs', 'exercise_library', 'shared_packages', 'program_templates'];

async function fetchAll(table) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Supabase error ${res.status} on ${table}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (!CRON_SECRET || !GH_BACKUP_TOKEN) {
    return res.status(503).json({ error: 'NOT_CONFIGURED', message: 'CRON_SECRET and/or GH_BACKUP_TOKEN env vars not set' });
  }
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const data = {};
    for (const table of TABLES) {
      data[table] = await fetchAll(table);
    }
    const payload = {
      backed_up_at: new Date().toISOString(),
      tables: TABLES,
      data,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const path = `backups/backup-${dateStr}.json`;
    const content = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');

    const ghRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GH_BACKUP_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Daily data backup ${dateStr}`,
        content,
        branch: 'main',
      }),
    });

    if (!ghRes.ok) {
      const detail = await ghRes.text();
      return res.status(500).json({ error: 'GITHUB_COMMIT_FAILED', detail });
    }

    const rowCounts = Object.fromEntries(TABLES.map(t => [t, data[t].length]));
    res.status(200).json({ ok: true, path, row_counts: rowCounts });
  } catch (err) {
    res.status(500).json({ error: 'BACKUP_FAILED', message: err.message });
  }
}
