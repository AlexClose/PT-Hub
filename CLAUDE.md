# PT-Hub Coaching App — Context & Status

## Project Overview
Single-file SPA at `/home/user/PT-Hub/index.html` (~5065 lines) for a personal training coaching platform. Two portals:
- **Coaching Portal** (`#coach-*`): Coach manages clients, logs sessions, views dashboards
- **Client Portal** (`#client-*`): Clients log workouts, view training programs

## Tech Stack
- Vanilla JS, no framework
- Supabase for backend (REST API via `sb()` function, keys hardcoded in file)
- Single HTML file with inline CSS and JS
- Deployed to Vercel via GitHub — **pushes to `main` go live automatically**
- GitHub repo: `alexclose/pt-hub`

## Git Workflow (IMPORTANT)

The GitHub MCP server (`mcp__github__*`) is available and authenticated. Use it for PR operations.
For merging, the squash-merge conflict pattern is no longer needed — we now push directly to `main`:

```bash
# Direct push to main (current workflow):
git add <files>
git commit -m "Message"
git push -u origin main
```

The old feature-branch + squash-merge workflow caused repeated conflicts. Direct pushes to main are now the standard approach since this is a solo project.

## API Files (Vercel Serverless)

```
/api/
  _builder.js       Shared Supabase client + payload builder (used by both export endpoints)
  _migration.sql    SQL to run once in Supabase to create api_tokens table + Chris's token
  export.js         Legacy key-based export: GET /api/export?id=UUID&key=pthub_9r4xw2m8k6j3
  v1/
    export.js       Bearer-token live export: GET /api/v1/export (Authorization: Bearer <token>)
    mint.js         Admin token minting: POST /api/v1/mint (requires MINT_SECRET env var)
    export.test.js  Unit test for maxWeight() — run with: node api/v1/export.test.js
```

### Client Chris Lavergne — Export API
- **Client ID**: `761e9a06-c9f8-4d2c-b5ac-468b7ebd7d8b`
- **Bearer token** (plaintext, share with Chris): `pt_623eada17872f337ba23ff7e51f929e1c2886250932fdfd1771e838815700b68`
- **Token hash** stored in `api_tokens` table: `1bfd697a68c6f2d0991250795cc31ffb3b2953efc02192ccde01e84c7e8f5552`
- **Live endpoint**: `GET https://pt-hub.vercel.app/api/v1/export` with `Authorization: Bearer pt_623eada...`
- **One-time SQL setup**: Run `api/_migration.sql` in Supabase Dashboard → SQL Editor (creates `api_tokens` table, RLS, `tick_api_token` function, inserts Chris's token)
- **Legacy URL** (still works): `https://pt-hub.vercel.app/api/export?id=761e9a06-c9f8-4d2c-b5ac-468b7ebd7d8b&key=pthub_9r4xw2m8k6j3`
- **Export button** in app: Coach opens Chris's profile → "⬡ Export" button copies the legacy URL to clipboard

### v1 API Details
- Rate limit: 100 req/hr per token, tracked atomically via `tick_api_token()` plpgsql function
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Cache-Control: no-store`
- `?since=<ISO8601>` filters sessions + exercise_logs; PRs and exercise_history are always full snapshots
- Errors: `{ error: { code, message } }` — 401 invalid token, 403 revoked, 429 rate limited
- New tokens: `POST /api/v1/mint` with `{ secret: MINT_SECRET, client_id, label }`

## Key Data Model

### Clients table
- `id`, `first`, `last`, `email`, `age`, `level`, `duration`
- `package_size` (total sessions in package) — can be 0
- `remaining` (sessions left) — can be negative (means client owes money)
- `schedule` — text string like "Mon, Wed, Fri 10:00 AM"
- `run_schedule` — text string for run days
- `run_program_id` — FK to `run_programs` table
- `run_program_week` — which week of run program client is on (1-indexed)
- `run_week_done` — how many runs completed in current program week (for auto-progression)
- `structured_program` — JSONB: `{ started_at: "May 15, 2026", days: [{name, color, exercises: [{name, prescription, load}]}] }`
- `exercise_history` — JSONB keyed by `exercise_name.toLowerCase().replace(/\s+/g,'_')`, stores `{reps, weight, date, pb}`
- `shared_package_id` — links to `shared_packages` table
- `paused` — boolean

### structured_program.started_at
Added recently. Tracks when the current program cycle began.
- Set automatically when a new program is saved or a template is applied
- Preserved when editing existing program days
- Reset via "↺ New Cycle" button in client modal (calls `resetProgramCycle(clientId)`)
- Displayed as "Started [date] · Week N" above the program days in client modal
- If not set, shows "No start date set" with a "▶ Start Now" button

### Package/Remaining Logic (critical)
- `package_size=0 && remaining>0` → pay-per-session but tracked ("N remaining")
- `package_size>0 && remaining>0` → standard package ("N / package_size")
- `remaining<0` → owes sessions (shows red full bar)
- `package_size=0 && remaining=0` → "Pay per session", no bar
- `!!c.remaining` is truthy for any non-zero (positive OR negative) — used in hasPkg

### Sessions table
- `client_id`, `date` (formatted "May 15, 2026"), `note`, `workout` (JSONB array), `created_at` (ISO timestamp, Supabase auto)

### Exercise logs table (`exercise_logs`)
- `client_id`, `session_date` (formatted "May 15, 2026"), `exercise_name`, `reps`, `weight` (string — may be comma-separated like "135,175,185,195"), `day_name`
- **IMPORTANT**: `weight` field stores raw user input and may be comma-separated (multiple sets). Always use `maxWeight(str)` — never `parseFloat()` — when computing numeric weight from this field.

### Run programs table
- `id`, `name`, `weeks` (JSONB array of arrays of run objects)
- Run object: `{ label, type, distance, pace, segments }`

### api_tokens table (Supabase — must be created via _migration.sql)
- `id`, `client_id`, `token_hash` (SHA-256), `label`, `revoked_at`, `created_at`, `request_count`, `rate_window_start`
- RLS enabled; anon can SELECT. `tick_api_token(p_hash)` function handles atomic rate-limit increment.

## Code Locations (Key Functions)

| Function | Approx Line | Purpose |
|----------|-------------|---------|
| `maxWeight(str)` | ~923 | Parse comma/slash/space-separated weight string, return max number |
| `getTodayClients()` | ~1235 | Returns clients scheduled for today |
| `clientTodayWorkout(c)` | ~1254 | Returns today's workout name from program+schedule |
| `renderTodaySessions()` | ~1265 | Coach dashboard Today card |
| `renderDashboard()` | ~1313 | Coach dashboard: stat tiles, alerts, client cards |
| `clientRowHtml(c)` | ~1353 | Coach dashboard client card |
| `renderClientList()` | ~1420 | Clients tab — compact rows |
| `renderClientModal(c)` | ~1600 | Coach client detail modal |
| `renderStructuredProgram(c)` | ~1840 | Renders program days with start date banner, history, edit buttons |
| `resetProgramCycle(clientId)` | ~1831 | Resets structured_program.started_at to today |
| `openLogSession(id)` | ~1970 | Log workout form (opens logModal) |
| `addAdHocExercise()` | ~2060 | Adds inline exercise row during session logging |
| `confirmLogSession()` | ~2195 | Saves session, decrements package, writes exercise_logs |
| `saveBuildProgram()` | ~2470 | Saves structured_program with started_at preserved or initialized |
| `confirmApplyTemplate()` | ~2835 | Applies template, always sets fresh started_at |
| `renderBusinessView()` | ~4560 | Business tab: Needs Attention, Inactive, Renewals, Long-Term |
| `openProgressReport(cid)` | ~4785 | Full-screen shareable progress overlay |
| `renderMonthlyReport(c)` | ~4500 | Monthly stats in client modal |
| `startClientPortal(id)` | ~2940 | Client portal entry point |
| `renderDayPicker(days)` | ~3220 | Client portal home screen |
| `renderRunDetail(run)` | ~3560 | Client portal run detail + LOG RUN button |

## Critical Code Snippets

```javascript
// maxWeight — always use this, never parseFloat(), on exercise_logs.weight
function maxWeight(str){
  if(!str)return 0;
  return Math.max(0,...String(str).split(/[,\/\s]+/).map(v=>parseFloat(v)||0));
}

// clientRowHtml — hasPkg logic
const hasPkg = c.package_size>0 || !!c.remaining || !!sharedPkg;

// Auto-decrement on session log
let newRemaining=(c.package_size>0||(c.remaining||0)>0)?c.remaining-1:c.remaining;

// structured_program.started_at — set on new program, preserve on edit
const today=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const prog={days:buildingDays, started_at:c.structured_program?.started_at||today};

// Run auto-progression (in _logRunSession)
if (newDone >= weekRuns.length && currentWeek < totalWeeks) {
  clientPatch.run_program_week = currentWeek + 1;
  clientPatch.run_week_done = 0;
} else {
  clientPatch.run_week_done = newDone;
}
```

## Features Completed

### Coaching Portal
- **Dashboard** — 4 colored stat tiles (Active Clients, Sessions This Month, Low Sessions, Invoice Needed)
- **Today card** — collapsible, shows client dots + names + workout name + time + quick Log button
- **Client cards** — compact, shows name + level + run week badge + package bar; badges show "N / package_size"
- **Client list tab** — compact single-line rows (dot + name + level + last session + status badge)
- **Client modal** — collapsible Goals/Injuries section, Monthly Summary with 5 stats, Share ↗ progress overlay
- **Monthly stats** — Sessions, Volume, PRs Hit, Best Lift, Most Improved (with trend indicators vs last month)
- **Progress share overlay** — full-screen, screenshot-ready, triggered by "Share ↗" on Monthly Summary card
- **Programs section** — shows "Started [date] · Week N" + "↺ New Cycle" button above program days
- **Programs tab** — styled section headers (blue bar for Lift, orange for Run), compact template rows
- **Add/Edit client form** — secondary fields hidden under "+ More options"; 13-session package option added
- **Log session** — "＋ Add Exercise" button adds ad-hoc exercises inline during session logging
- **⬡ Export button** — on every client modal; copies live export URL to clipboard
- **Business tab** — Needs Attention, Inactive 10+ days, Renewals This Month, Long-Term Clients
- **Nav tabs** — SVG icons; inactive tabs show icon only, active tab shows icon + label

### Client Portal
- **Home screen** — greeting + "🔥 N sessions this month" badge, hero today card, This Week pill
- **Month calendar** — expandable via ▼ chevron under week strip
- **Session history** — shows 5 sessions with exercise count, expandable
- **Run program** — LOG RUN button, auto-advances week when all runs complete
- **PRs tab** — shows all-time personal records per exercise

### API / Export
- **Legacy export**: `GET /api/export?id=UUID&key=pthub_9r4xw2m8k6j3`
- **v1 export**: `GET /api/v1/export` with Bearer token auth, rate limiting, `?since=` filter
- **Weight coercion fixed**: All code reading `exercise_logs.weight` uses `maxWeight()` not `parseFloat()`
- **Token minting**: `POST /api/v1/mint` protected by `MINT_SECRET` env var

### Shared
- **Shared packages** — `shared_package_id` links two clients, deducts from shared remaining
- **Exercise history carries over** — `exercise_history` and `exercise_logs` are never cleared on program change; PRs are cross-program all-time

## Monthly Report Details (`renderMonthlyReport`)
Fetches 3 datasets in parallel:
1. Current month `exercise_logs`
2. Last month `exercise_logs` (for trend comparison)
3. All-time previous `exercise_logs` (for PR detection)

Stats: Sessions (+ trend), Volume lbs (+ trend), PRs Hit, Best Lift, Most Improved

## Run Program Auto-Progression
1. Client has `run_program_id`, `run_program_week`, `run_week_done` on their record
2. When LOG RUN tapped, `_logRunSession` increments `run_week_done`
3. If `run_week_done >= weekRuns.length` → advance `run_program_week`, reset `run_week_done = 0`
4. Green "Week N complete!" banner shown to client

## Known Patterns & Gotchas
- **Line numbers shift** every session as code grows — always grep to find current positions
- **`parseSchedule(str)`** handles both JSON `{"Mon":0}` and plain text "Mon, Wed" formats
- **`parseScheduleMap(str)`** returns a map object; `schedMapToStr(map)` converts back
- **`window._portalClientId`** etc. — client portal uses global window vars (not a module)
- **Session date format** is `"May 15, 2026"` (US locale string) not ISO — used for matching/display
- **`_sessions` array** on each client object is loaded via `db.getSessions(c.id)` and cached in-memory
- **SQL in Supabase**: apostrophes in strings must be escaped as `''` (e.g., "don''t") — learned the hard way with Joe's program upload
- **Supabase blocked** from Vercel cloud execution environment — cannot curl Supabase directly; must provide SQL for user to run in dashboard, or use the app's runtime

## Pending / Known Issues
- **Joe's program**: User ran SQL to load Joe's 3-day home gym program (Push/Pull/Full Upper) but hit a syntax error from apostrophes. Fixed SQL was provided (apostrophes replaced with "do not"/"will not"). User should confirm it ran with "1 row affected". Joe's actual name in the DB may differ — if SQL still fails, run `SELECT id, first, last FROM clients ORDER BY first;` to find the right name.
- **Chris's api_tokens table**: The `_migration.sql` file must be run once in Supabase to create the table before `/api/v1/export` will work. Chris has his token — he just needs the table to exist.
- **Export button**: The "⬡ Export" button in each client modal copies the legacy `?key=` URL. For clients other than Chris, the v1 Bearer endpoint would need a new token minted via `/api/v1/mint`.

## Potential Next Improvements
- Session log flow: pre-select today's program day based on schedule
- Smarter Today hero: show run week status (e.g. "Week 3 · 1/2 runs done")
- Coach programs tab: drag-to-reorder exercise list
- Notifications / reminders for low-session clients
- Client portal: show PRs hit this month to the client
- Business tab: revenue tracking / invoice generation

---
**Last Updated:** May 20, 2026
