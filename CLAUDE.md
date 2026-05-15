# PT-Hub Coaching App — Context & Status

## Project Overview
Single-file SPA at `/home/user/PT-Hub/index.html` (~4200 lines) for a personal training coaching platform. Two portals:
- **Coaching Portal** (`#coach-*`): Coach manages clients, logs sessions, views dashboards
- **Client Portal** (`#client-*`): Clients log workouts, view training programs

## Tech Stack
- Vanilla JS, no framework
- Supabase for backend (REST API via `sb()` function, keys hardcoded in file)
- Single HTML file with inline CSS and JS
- Deployed to Vercel via GitHub — pushes to `main` go live automatically
- GitHub repo: `alexclose/pt-hub`

## Git Workflow (IMPORTANT)
```bash
# Always work on feature branch:
git checkout claude/continue-pt-hub-yVRHo

# Commit + push:
git add index.html
git commit -m "Clear message"
git push -u origin claude/continue-pt-hub-yVRHo

# Create PR via mcp__github__create_pull_request (owner: alexclose, repo: pt-hub)
# Merge via mcp__github__merge_pull_request with merge_method: squash
```

### Squash Merge Conflict Resolution (happens every time)
Squash merges rewrite main history, so every PR will have conflicts. Fix:
```bash
git fetch origin main
git diff origin/main HEAD > /tmp/patch.diff
git reset --hard origin/main
git apply /tmp/patch.diff
git add index.html
git commit -m "message"
git push --force -u origin claude/continue-pt-hub-yVRHo
# Then retry the merge
```

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
- `structured_program` — JSONB with `{ days: [{name, color, exercises: [{name, prescription, load}]}] }`
- `exercise_history` — JSONB keyed by exercise name, stores last reps/weight/date
- `shared_package_id` — links to `shared_packages` table
- `paused` — boolean

### Package/Remaining Logic (critical)
- `package_size=0 && remaining>0` → pay-per-session but tracked ("N remaining")
- `package_size>0 && remaining>0` → standard package ("N / package_size")
- `remaining<0` → owes sessions (shows red full bar)
- `package_size=0 && remaining=0` → "Pay per session", no bar
- `!!c.remaining` is truthy for any non-zero (positive OR negative) — used in hasPkg

### Sessions table
- `client_id`, `date` (formatted "May 15, 2026"), `note`, `workout` (JSONB array)

### Exercise logs table (`exercise_logs`)
- `client_id`, `session_date`, `exercise_name`, `reps`, `weight`, `day_name`

### Run programs table
- `id`, `name`, `weeks` (JSONB array of arrays of run objects)
- Run object: `{ label, type, distance, pace, segments }`

## Code Locations (Key Functions)

| Function | Line | Purpose |
|----------|------|---------|
| `getTodayClients()` | 1225 | Returns clients scheduled for today |
| `clientTodayWorkout(c)` | 1244 | Returns today's workout name from program+schedule |
| `renderTodaySessions()` | 1255 | Coach dashboard Today card with client list + workout names |
| `renderDashboard()` | 1303 | Coach dashboard: stat tiles, alerts, client cards |
| `clientRowHtml(c)` | 1343 | Coach dashboard client card (hasPkg, badge, progress bar) |
| `renderClientList()` | 1410 | Clients tab — compact rows via `clientCompactRowHtml` |
| `renderClientModal(c)` | 1536 | Coach client detail modal |
| `openLogSession(id)` | 1899 | Log workout form (opens logModal) |
| Session save logic | ~2110 | Auto-decrement, exercise logs, next-client prompt |
| `renderTemplateList()` | 2379 | Lift program template list (compact rows) |
| `startClientPortal(id)` | 2929 | Client portal entry point |
| `renderClientShell(client)` | 2975 | Client portal shell HTML (nav + calendar strip) |
| `buildPortalMonthView()` | 3031 | Month calendar grid for client portal |
| `renderCalendarStrip()` | 3068 | Client portal week calendar + month expand toggle |
| `loadTodayWorkout(client)` | 3174 | Fetches program + run program, calls renderDayPicker |
| `renderDayPicker(days)` | 3209 | Client portal home screen (greeting, stats, day cards) |
| `renderRunDetail(run)` | 3548 | Client portal run detail + LOG RUN button |
| `renderMonthlyReport(c)` | 4114 | Monthly stats: sessions, volume, PRs, best lift, most improved |

## Critical Code Snippets

```javascript
// clientRowHtml — hasPkg logic
const hasPkg = c.package_size>0 || !!c.remaining || !!sharedPkg;

// Progress bar pct
const effectivePct = !hasPkg ? 0 : displayRemaining<=0 ? 100 : displayTotal>0 ? Math.min(displayRemaining/displayTotal*100, 100) : Math.min((displayRemaining||0)*10, 100);

// Auto-decrement on session log (~line 2109)
let newRemaining=(c.package_size>0||(c.remaining||0)>0)?c.remaining-1:c.remaining;

// After session save — next client prompt (~line 2125)
const nextToday = getTodayClients().find(tc => !tc._sessions.some(s=>s.date===dateStr) && tc.id !== c.id);
// Shows a dismissible banner with "Log ⚡" shortcut for 9s

// Run auto-progression (in _logRunSession)
if (newDone >= weekRuns.length && currentWeek < totalWeeks) {
  clientPatch.run_program_week = currentWeek + 1;
  clientPatch.run_week_done = 0;
} else {
  clientPatch.run_week_done = newDone;
}
```

## Features Completed (Recent Sessions)

### Coaching Portal
- **Dashboard** — 4 colored stat tiles (Active Clients, Sessions This Month, Low Sessions, Invoice Needed)
- **Today card** — collapsible, shows client dots + names + workout name + time + quick Log button
- **Client cards** — compact, shows name + level + run week badge + package bar
- **Client list tab** — compact single-line rows (dot + name + level + last session + status badge)
- **Client modal** — collapsible Goals/Injuries section, Monthly Summary with 5 stats
- **Monthly stats** — Sessions, Volume, PRs Hit, Best Lift, Most Improved (with trend indicators vs last month)
- **Programs tab** — styled section headers (blue bar for Lift, orange for Run), compact template rows
- **Add/Edit client form** — secondary fields (Goals, Injuries, Notes, Tier) hidden under "+ More options"
- **Backup button** — de-emphasized (tiny, faded, icon-only)
- **Nav tabs** — clean SVG icons (grid, users, list, layers) instead of emoji

### Client Portal
- **Home screen** — greeting + "🔥 N sessions this month" badge (loads async), hero today card, This Week pill
- **Month calendar** — expandable via ▼ chevron under the week strip (`window._calMonthOpen`)
- **Home button** — blue-tinted, min-width 44px, "HOME" label, easy to tap
- **Session history** — shows 5 sessions with exercise count, expandable to full history
- **Run program** — LOG RUN button on run detail screen, auto-advances week when all runs complete
- **Run week tracking** — `run_week_done` DB column, incremented on each run log

### Shared
- **Shared packages** — `shared_package_id` links two clients to one package, deducts from shared remaining

## Monthly Report Details (`renderMonthlyReport`)
Fetches 3 datasets in parallel:
1. Current month `exercise_logs`
2. Last month `exercise_logs` (for trend comparison)
3. All-time previous `exercise_logs` (for PR detection)

Stats shown:
- Sessions this month (+ trend vs last month)
- Total volume lbs (+ trend)
- PRs Hit (exercises with new all-time max weight this month)
- Best Lift (highest single weight logged this month)
- Most Improved (biggest weight % increase vs last month)

## Run Program Auto-Progression
1. Client has `run_program_id`, `run_program_week`, `run_week_done` on their record
2. Client portal loads these into `window._portalRunProgramWeek` and `window._portalRunWeekDone`
3. When LOG RUN tapped, `_logRunSession` increments `run_week_done`
4. If `run_week_done >= weekRuns.length` → advance `run_program_week`, reset `run_week_done = 0`
5. Green "Week N complete!" banner shown to client

## Known Patterns & Gotchas
- **Line numbers shift** every session as code grows — always grep to find current positions
- **`parseSchedule(str)`** handles both JSON `{"Mon":0}` and plain text "Mon, Wed" formats
- **`parseScheduleMap(str)`** returns a map object; `schedMapToStr(map)` converts back
- **`window._portalClientId`** etc. — client portal uses global window vars (not a module)
- **Session date format** is `"May 15, 2026"` (US locale string) not ISO — used for matching/display
- **`_sessions` array** on each client object is loaded via `db.getSessions(c.id)` and cached in-memory

## Potential Next Improvements
- Smarter Today hero: show run week status (e.g. "Week 3 · 1/2 runs done")
- Client portal: show PRs hit this month to the client
- Session log flow: pre-select today's program day based on schedule
- Coach programs tab: drag-to-reorder exercise list
- Notifications / reminders for low-session clients
- Client portal: show personal records per exercise

---
**Last Updated:** May 15, 2026
