// Restores a dated backup JSON (from backups/backup-YYYY-MM-DD.json) back into Supabase.
// Usage:  node scripts/restore-backup.js backups/backup-2026-07-09.json
//
// Upserts every row by its existing `id` (Prefer: resolution=merge-duplicates), so it's safe to
// run more than once — it will never create duplicates, only overwrite-to-match the backup.
// Restores in dependency order (tables other rows point to via a foreign key go first).

const SB_URL = 'https://oneykldgivaqcrqmrqha.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZXlrbGRnaXZhcWNycW1ycWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTQ4NTYsImV4cCI6MjA5MzU3MDg1Nn0.Os-XjWM6nJuFOLLQhBUH0DUL40So-jkpXGx9iBequyw';
const HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

// Order matters: tables referenced BY a foreign key (shared_packages, run_programs,
// program_templates, exercise_library) go first, then clients (which points to the first two),
// then sessions/exercise_logs (which point to clients).
const RESTORE_ORDER = ['shared_packages', 'run_programs', 'program_templates', 'exercise_library', 'clients', 'sessions', 'exercise_logs'];
const CHUNK_SIZE = 500;

async function upsertTable(table, rows) {
  if (!rows || !rows.length) { console.log(`  ${table}: 0 rows, skipped`); return; }
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const res = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${table} chunk ${i}-${i + chunk.length}: ${res.status} ${detail}`);
    }
  }
  console.log(`  ${table}: ${rows.length} rows restored`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/restore-backup.js <path-to-backup.json>');
    process.exit(1);
  }
  const fs = await import('fs');
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Restoring backup from ${backup.backed_up_at}`);

  for (const table of RESTORE_ORDER) {
    console.log(`Restoring ${table}...`);
    await upsertTable(table, backup.data[table]);
  }
  console.log('Done. Spot-check a few clients/sessions in the app before trusting it fully.');
}

main().catch(err => { console.error('RESTORE FAILED:', err.message); process.exit(1); });
