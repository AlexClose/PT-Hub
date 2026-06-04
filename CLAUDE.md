# PT-Hub Coaching App — Context & Status

## Project Overview
Single-file SPA at `/home/user/PT-Hub/index.html` (~6800 lines) for a personal training coaching platform. Two portals:
- **Coaching Portal** (`#coach-*`): Coach manages clients, logs sessions, views dashboards
- **Client Portal** (`#client-*`): Clients log workouts, view training programs

## Tech Stack
- Vanilla JS, no framework
- Supabase for backend (REST API via `sb()` function, keys hardcoded in file)
- Single HTML file with inline CSS and JS
- Deployed to Vercel via GitHub — **pushes to `main` go live automatically**
- GitHub repo: `alexclose/pt-hub`

## Git Workflow (IMPORTANT)

Push directly to `main` — no feature branches, no PRs (solo project):

```bash
git add index.html
git commit -m "Message"
git push -u origin main
```

---

## Current Commit State

**Current HEAD**: `1f0ab2a` — Reverse Fly heatmap fix (Jun 4, 2026)
**File**: `index.html`, ~6800 lines

### What is WORKING:
- Auto-login (reads `bm_session` from localStorage via `startApp()`)
- Manual sign-in (`signIn()` function)
- All core coaching portal features
- Client modal with **3 swipeable tabs**: Overview / Program / Progress
- Today's Workout card in Overview tab (lift days show full exercise list with last weights; run days show run details; green "✓ Logged" badge if already done)
- Body stats section in Progress tab
- Muscle heatmap in Progress tab (coach) and dedicated Muscles tab (client portal)
- **Heatmap breakdown panel** (collapsible "▶ Show breakdown" below diagram) — lists per-muscle set contributions with exercise-by-exercise detail; permanent feature on all profiles
- `exerciseToMuscles()` maps exercises to muscle groups via regex — comprehensive, handles most variants
- `canonExName()` normalizes free-typed exercise names to canonical spellings at save time
- Custom typeahead autocomplete dropdown on all exercise name inputs (contains-match, blue highlight)
- Custom workouts (coach + client portal) with superset support
- PRs this month section in client portal PRs tab
- Drag-to-reorder exercises in program builder
- Client portal: 5 tabs — Home / Train / PRs / Body / Muscles

---

## API Files (Vercel Serverless)

```
/api/
  _builder.js       Shared Supabase client + payload builder
  _migration.sql    SQL to run once in Supabase (api_tokens table + Chris's token)
  export.js         Legacy key-based export: GET /api/export?id=UUID&key=pthub_9r4xw2m8k6j3
  v1/
    export.js       Bearer-token live export: GET /api/v1/export (Authorization: Bearer <token>)
    mint.js         Admin token minting: POST /api/v1/mint (requires MINT_SECRET env var)
    export.test.js  Unit test for maxWeight()
```

### Client Chris Lavergne — Export API
- **Client ID**: `761e9a06-c9f8-4d2c-b5ac-468b7ebd7d8b`
- **Bearer token**: `pt_623eada17872f337ba23ff7e51f929e1c2886250932fdfd1771e838815700b68`
- **Token hash**: `1bfd697a68c6f2d0991250795cc31ffb3b2953efc02192ccde01e84c7e8f5552`
- **Live endpoint**: `GET https://pt-hub.vercel.app/api/v1/export` with `Authorization: Bearer pt_623eada...`
- **One-time SQL setup**: Run `api/_migration.sql` in Supabase Dashboard → SQL Editor

---

## Key Data Model

### Clients table
- `id`, `first`, `last`, `email`, `age`, `level`, `duration`
- `package_size`, `remaining`, `schedule`, `run_schedule`, `run_program_id`, `run_program_week`, `run_week_done`
- `structured_program` — JSONB: `{ started_at: "May 15, 2026", days: [{name, color, exercises: [{name, prescription, load}]}] }`
- `exercise_history` — JSONB keyed by `exercise_name.toLowerCase().replace(/\s+/g,'_')`, stores `{reps, weight, date, pb}`
- `shared_package_id`, `paused`

### Sessions table
- `client_id`, `date` (formatted "May 15, 2026"), `note`, `workout` (JSONB array), `created_at`

### Exercise logs table (`exercise_logs`)
- `client_id`, `session_date` (formatted "May 15, 2026"), `exercise_name`, `reps`, `weight`, `day_name`
- **IMPORTANT**: `weight` may be comma-separated. Always use `maxWeight(str)` — never `parseFloat()`
- **IMPORTANT**: `session_date` is stored as US locale text ("Jun 3, 2026"), NOT ISO format. `new Date("Jun 3, 2026")` may parse inconsistently across browsers/timezones.

### Run programs table
- `id`, `name`, `weeks` (JSONB array of arrays of run objects)

---

## Code Locations (Key Functions)

| Function | Approx Line | Purpose |
|----------|-------------|---------|
| `maxWeight(str)` | ~924 | Parse comma/slash/space-separated weight string |
| `_KNOWN_EXERCISES` | ~925 | Global array of canonical exercise names (shared by canonExName + autocomplete) |
| `canonExName(str)` | ~926 | Normalize free-typed exercise name → canonical form at save time |
| `_exAcShow/Hide/Input/Blur` | ~975 | Custom typeahead autocomplete dropdown for exercise name inputs |
| `startApp()` | ~1050 | Auto-login entry point |
| `signIn()` | ~1072 | Manual sign-in |
| `renderClientModal(c)` | ~1700 | Coach client detail modal (3-tab) |
| `setClientModalTab(cid,tab)` | ~2024 | Switches Overview/Program/Progress tab |
| `renderStructuredProgram(c)` | ~1940 | Program days + Custom Workout card at bottom |
| `openLogSession(id, dayIdx)` | ~2070 | Log workout form; dayIdx=-1 for custom workout |
| `addAdHocExercise(supGroup,supLabel,ssWrap)` | ~2454 | Coach ad-hoc exercise row (supports supersets) |
| `addAdHocSuperset()` | ~2485 | Coach ad-hoc superset pair (wrapper card design) |
| `confirmLogSession()` | ~2550 | Saves session, decrements package, writes exercise_logs |
| `renderEditExerciseList()` | ~2180 | Program builder exercise list with drag handles |
| `setupExDrag()` | ~2210 | Pointer-event drag-to-reorder for program builder |
| `renderPortalPRs()` | ~4200 | Client portal PRs tab (includes "PRs This Month" section) |
| `renderPortalStats()` | ~4300 | Client portal Body tab — body stats ONLY (no heatmap) |
| `renderPortalMuscles()` | ~4330 | Client portal Muscles tab — dedicated heatmap view |
| `window.renderCustomWorkoutSheet` | ~4090 | Client portal custom workout sheet (global, called from onclick) |
| `window._addCustomExRow(supGroup,supLabel,ssWrap)` | ~4235 | Custom workout exercise row |
| `window._addCustomSupersetPair()` | ~4260 | Custom workout superset pair (wrapper card) |
| `window._logCustomPortalSession()` | ~4284 | Saves client portal custom workout to DB |
| `exerciseToMuscles(name)` | ~5828 | Maps exercise name → [{muscle, weight}] via regex |
| `_mhColor(weeklyAvg, weeklyTarget)` | ~5931 | Color scale: pale yellow → amber → orange → red → dark red |
| `_MH_TARGETS` | ~5943 | Weekly set targets: chest:12, back:14, shoulders:12, biceps:14, triceps:12, etc. |
| `loadMuscleHeatmap(clientId,containerId,period)` | ~6718 | Fetches exercise_logs, scores muscles, renders diagram + breakdown + untracked warning |

---

## Muscle Heatmap System

### Color scale (`_mhColor`)
```
r = weeklySetTotal / weeklyTarget
r < 0.25  → #fef9c3  (pale yellow  — Minimal, <25%)
r < 0.50  → #fde68a  (light yellow — Below optimal, 25-49%)
r < 0.75  → #fbbf24  (amber        — Building, 50-74%)
r < 1.00  → #f97316  (orange       — Effective, 75-99%)
r < 1.50  → #ef4444  (red          — Optimal, ≥100%)
r >= 1.50 → #b91c1c  (dark red     — High volume, ≥150%)
```

### Weekly targets (`_MH_TARGETS`)
Based on RP Strength MAV guidelines adjusted for PT clients (2-4x/week):
```javascript
chest:12, back:14, shoulders:12, quads:12,
hamstrings:12, glutes:12, glute_med:4, adductors:4,
biceps:14, triceps:12, calves:10, abs:12, traps:8, lower_back:6, forearms:8
```

### Set counting (`parseSets`)
- `"3×10"` or `"3x10"` or `"3X10"` → 3 sets
- `"8,8,6"` (comma-separated) → 3 sets
- `"12"` (just a number) → 1 set

### Breakdown panel (permanent feature)
Below the diagram, a collapsible "▶ Show breakdown" panel lists every muscle group with:
- Total weighted sets for the period
- Each contributing exercise with its set count
This lets coaches and clients verify that all exercises are mapping to the right muscles.
Use this to catch `exerciseToMuscles()` mis-mappings (e.g., the Reverse Fly → chest bug found Jun 4).

### Untracked exercise warning
Any exercise that `exerciseToMuscles()` can't map appears in a yellow warning box below the diagram.
This also means it won't appear in PRs — the signal to add new exercises to `exerciseToMuscles()`.

### Known `exerciseToMuscles()` gotchas
- **`\bfly\b` pattern must exclude "reverse" and "rear"** — "Reverse Fly" contains "fly" and would falsely map to chest. Guard is: `!n.includes('reverse')&&!n.includes('rear')&&/...\bfly\b/.test(n)`.
- Chest-supported rows (e.g., "Chest Supported Row") — "chest" in name does NOT mean chest muscle. The regex avoids this because it requires "chest" + "press" or "fly" keywords together, not standalone.
- Order matters: more specific patterns (reverse fly, rear delt) must come BEFORE broad patterns (fly, press).

### `exerciseToMuscles()` coverage (regex-based, broad)
All bench/push-up variants → chest; all curl variants → biceps; pull-up/pulldown/row → back; squat/leg press/lunge → quads; hip thrust/glute bridge → glutes; deadlift → back+glutes+hams; RDL → hams+glutes; shoulder press/lateral raise/face pull → shoulders; tricep pushdowns/skull crushers/dips → triceps; etc.
**Reverse fly / rear delt fly / band pull-apart** → shoulders (NOT chest).

### `canonExName()` normalization (applied at save time)
Canonical list of ~40 known exercises + loaded library → case-insensitive match. Falls back to synonym table (~80 mappings: rdl→Romanian Deadlift, ohp→Overhead Press, bss→Bulgarian Split Squat, etc.). Applied in `_logCustomPortalSession` and `confirmLogSession` ad-hoc section.

---

## Custom Workout System

### Client Portal (`window.renderCustomWorkoutSheet`)
- Opened by "Custom Workout" card at bottom of Train tab
- Two buttons: **+ Add Exercise** and **⊕ Superset**
- Superset creates a wrapper card with blue border + "SUPERSET" header bar; A and B rows inside
- Exercise name inputs use custom typeahead autocomplete (not native datalist)
- Placeholder text shows format: `"3×10 · or 8,8,6"` and `"135 · or 135,145,155"`
- On save: `canonExName()` normalizes names, then saves to `sessions` + `exercise_logs` + patches `exercise_history`
- Shows "Crushed it!" success screen with PB detection

### Coach Portal (log session modal with dayIdx = -1)
- Triggered by "Custom Workout" card in Program tab → `openLogSession(id, -1)`
- Same "Add Exercise" + "⊕ Superset" two-button layout
- Uses `addAdHocExercise()` and `addAdHocSuperset()`
- `confirmLogSession()` uses `adhocDayName='Custom Workout'` for day_name

---

## Client Portal — 5 Tabs

```
Home | Train | PRs | Body | Muscles
```

- **Home**: greeting, today's workout hero, week calendar, session history
- **Train**: program days + Custom Workout card at bottom; LOG button opens workout sheet
- **PRs**: all-time PRs + "🏆 New in [Month]" section showing PRs hit this month
- **Body**: body stats (weight, body fat, muscle mass) — NO heatmap, NO recent sessions
- **Muscles**: dedicated heatmap with period selector + "ⓘ How it works" button + breakdown panel

Tab bar uses `grid-template-columns: repeat(5, 1fr)` — all 5 tabs in one row.

---

## Autocomplete Dropdown (`_exAcShow`)

Singleton `#_ex-ac-drop` div, `position:fixed`, `z-index:9999`. Active on:
- Client portal custom workout: `cex-name-N` inputs
- Coach ad-hoc: `an-adhoc-N` inputs
- Program builder: exercise name inputs in `.edit-ex-fields`

Behavior:
- Shows on 1+ character typed, contains-match (not starts-with), max 8 results
- Matched text highlighted in blue
- Tap → fills input + auto-advances focus to reps/prescription field
- Position updated via `requestAnimationFrame` + `window.visualViewport` offsets (fixes iOS keyboard position drift)
- Hides on blur (160ms delay), Escape key, scroll, or `visualViewport` resize

---

## Auto-Login Flow (CRITICAL — do not break)

`startApp()` at ~line 1050 — reads `bm_session` from localStorage. **The user NEVER manually clicks Sign In.** If auto-login breaks, Face ID prompt appears and Sign In button does nothing.

---

## 3-Tab Client Modal (Coach)

Tabs: **Overview / Program / Progress**
- Overview: today's workout card (lift or run), package status, session history, goals/injuries
- Program: structured program days (drag-reorder in edit mode), Custom Workout card at bottom
- Progress: monthly stats, body stats, muscle heatmap

**Today's Workout card** (Overview tab):
- Blue card for lift days: workout name, full exercise list with last logged weights (from exercise_history), superset indent bars, "✓ Logged" badge if today's session exists
- Orange card for run days: label, distance/pace, week progress
- Hidden on rest days
- Tapping → `openLogSession(clientId, dayIdx)`

---

## Known Patterns & Gotchas
- **Line numbers shift** every session — always grep to find current positions
- **`parseSchedule(str)`** handles both JSON `{"Mon":0}` and plain text "Mon, Wed" formats
- **`window._portalClientId`** etc. — client portal uses global window vars
- **Session date format**: `"May 15, 2026"` (US locale), NOT ISO — used for matching/display
- **`exercise_logs.session_date`**: also US locale text. `new Date("Jun 3, 2026")` parses inconsistently across browsers/timezones — potential bug in "This Week" filter
- **Superset rows inside ssWrap**: `querySelectorAll('[id^="custom-ex-row-"]')` finds them regardless of nesting — save loop still works
- **`renderCustomWorkoutSheet` must be `window.renderCustomWorkoutSheet`** (not a local function) — inline onclick handlers are global scope only
- **Tab background**: inactive tabs must use `background:'transparent'` not `background:''`
- **SQL in Supabase**: apostrophes must be escaped as `''`
- **Supabase blocked** from Vercel cloud execution — cannot curl Supabase directly from Claude Code remote environment

---

## Pending / Known Issues

- **Joe's program**: SQL fix for apostrophes was provided; confirm "1 row affected" in Supabase
- **Chris's api_tokens**: Run `api/_migration.sql` once before `/api/v1/export` will work
- **Jeff's schedule**: `schedule` field may not say "Tue, Thu, Fri" yet
- **`exerciseToMuscles()` ongoing calibration**: As more users test and the breakdown panel surfaces mis-mappings, add new exercise patterns. Use the yellow "untracked" warning + breakdown panel as the feedback loop.

---

## Features Completed (Jun 4, 2026 — two sessions)

- ✅ Dedicated **Muscles tab** (5th tab) in client portal — heatmap moved out of Body tab
- ✅ **Body tab** cleaned up — body stats only, no heatmap, no recent sessions
- ✅ Tab bar fixed: `repeat(4,1fr)` → `repeat(5,1fr)` + reduced padding
- ✅ **Custom workout** in client portal (+ superset support)
- ✅ **Custom workout** in coach portal (+ superset support)
- ✅ **Superset wrapper card** design — blue border, SUPERSET header bar, A/B rows inside
- ✅ **`canonExName()`** normalization at save time
- ✅ **`_KNOWN_EXERCISES`** global + autocomplete dropdown on all exercise name inputs
- ✅ Autocomplete: contains-match, blue highlight, auto-advance to reps, iOS position fix
- ✅ **Heatmap untracked warning** — user-facing, links unmapped → missing PRs
- ✅ **Heatmap breakdown panel** — permanent "▶ Show breakdown" toggle; shows per-muscle exercise contributions for every profile; used to diagnose and fix mis-mappings
- ✅ **Fix: Reverse Fly mapped to chest** — `\bfly\b` was matching "Reverse Fly"; added `!n.includes('reverse')&&!n.includes('rear')` guard before the chest fly pattern
- ✅ **Today's Workout card** in Overview tab
- ✅ **PRs this month** section in client portal PRs tab
- ✅ **Drag-to-reorder** exercises in program builder (pointer events)
- ✅ Input placeholder text explains both formats: `3×10 · or 8,8,6` / `135 · or 135,145,155`
- ✅ `renderCustomWorkoutSheet` exposed as `window.` (fixed onclick not firing)

---

## Next Logical Steps (in priority order)

1. **Continue calibrating `exerciseToMuscles()`** — use the breakdown panel + untracked warning as more exercises are logged by testers. Fix any mis-mappings that surface.
2. **Smarter Today hero on coach dashboard** — show run week status ("Week 3 · 1/2 runs done")
3. **Business tab** — revenue tracking / invoice generation
4. **Notifications** — reminders for low-session clients
5. **Session log flow** — pre-select today's program day based on schedule (partial: `openLogSession(id, dayIdx)` already supports it; Today's Workout card uses it)

---

**Last Updated:** Jun 4, 2026
