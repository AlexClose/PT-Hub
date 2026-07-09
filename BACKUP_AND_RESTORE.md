# Data Backup & Restore

## Why this exists

Supabase's free tier does not take automatic backups. If the database were ever wiped,
corrupted, or a bad change deleted something important, there was no way to get it back.
This adds a second, independent copy of the data outside of Supabase.

## How the backup works

- A Vercel Cron job hits `/api/backup` once a day.
- That endpoint pulls every table (clients, sessions, exercise_logs, run_programs,
  exercise_library, shared_packages, program_templates) from Supabase and commits it as one
  JSON file to this repo, under `backups/backup-YYYY-MM-DD.json`.
- These files are **not** publicly accessible from the live site (blocked in `vercel.json`) —
  you'll only find them by browsing the repo on GitHub, in the `backups/` folder.
- This requires two environment variables to be set in the Vercel project (`CRON_SECRET`,
  `GH_BACKUP_TOKEN`) — see the setup instructions from when this was built.

## If something actually goes wrong

Don't panic — as long as the backup ran at least once, the data exists.

1. **Go to the GitHub repo → `backups/` folder.** Find the most recent file dated *before* the
   problem happened (e.g. if something broke today, yesterday's file has everything up to
   yesterday — you'll lose at most today's sessions/edits).
2. **Download that file** to your computer.
3. **Run the restore script** from a terminal, in this project folder:
   ```
   node scripts/restore-backup.js path/to/backup-2026-07-09.json
   ```
   This puts every row back into Supabase, matched by its original ID. It's safe to run more
   than once — it overwrites-to-match the backup rather than creating duplicates.
4. **Spot-check** a couple of clients and recent sessions in the app afterward before trusting
   it fully.

If you're not comfortable running that yourself, or aren't sure which backup file to use, just
tell Claude "restore from backup" in a new session with the repo attached — hand over the date
of the incident and it can pick the right file and run it for you.

## What this does NOT cover

- **The code** (this app itself) is separately protected by git/GitHub history — every past
  version is always recoverable regardless of this backup system.
- **This is a same-server-crash-proof copy of the data, not a live replica.** In the worst case
  you could lose up to a day's worth of the most recent sessions/edits (whatever happened since
  the last nightly backup ran).
- If you upgrade Supabase to a paid plan, its own point-in-time recovery is the faster/more
  precise way to undo a recent mistake — treat this file-based backup as the fallback if that
  isn't available or the Supabase project itself is the thing that's gone.
