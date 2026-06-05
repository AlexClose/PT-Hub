# PT-Hub Coaching App — Context & Status

## Project Overview
Single-file SPA at `/home/user/PT-Hub/index.html` (~7640 lines) for a personal training coaching platform. Two portals:
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

**Current HEAD**: `df7e4db` — Muscle-balance bars (current session)
**File**: `index.html`, ~7640 lines

### What is WORKING:
- Auto-login (reads `bm_session` from localStorage via `startApp()`)
- Manual sign-in (`signIn()` function)
- All core coaching portal features
- Client modal with **3 swipeable tabs**: Overview / Program / Progress
- Today's Workout card in Overview tab
- Body stats section in Progress tab
- **Exercise Demo & Library System** (BIG — see dedicated section below): tap any exercise anywhere → bottom sheet with animated demo, target-muscle chips, instructions, and history. Backed by the public `free-exercise-db` dataset (873 exercises) loaded at runtime. ~210-entry curated alias map + forgiving matcher.
- Custom exercise details: link a demo / paste image+video URL / muscle multi-select / description (per-library overrides; needs the 5 new `exercise_library` columns).
- Comprehensive exercise autocomplete (curated 182 + 873 dataset + library), token-based forgiving matching.
- Library auto-grows from used exercises (deduped by resolved demo identity).
- Program builder & workout-of-day builder: one-at-a-time **+ Add Exercise / ⊕ Superset**, live thumbnails, orange superset wrappers.
- Muscle heatmap + **muscle-balance bars** (weekly volume vs target) in Progress (coach) and Muscles tab (client)
- **Heatmap breakdown panel** (collapsible) + untracked-exercise warning
- PRs this month section in client portal PRs tab
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

### Exercise library table (`exercise_library`)
- `id`, `name`, `muscle_group` (single, used for library grouping), `equipment`
- **Custom-detail columns (added this session — run the SQL below if not present):**
  - `demo_id` — links to a `free-exercise-db` id to reuse its demo
  - `image_url`, `video_url` — custom media (video_url: YouTube auto-embeds, else link button)
  - `description` — coaching cues/notes
  - `muscles` — comma-separated muscle groups (chips in detail sheet)
- SQL: `ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS demo_id text, ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS video_url text, ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS muscles text;` (already run)
- Grows automatically: exercises typed when building programs / logging workouts are added via `_ensureLibraryHas()`, **deduped by resolved demo identity** (so word-order/abbrev variants don't create duplicates).

---

## Code Locations (Key Functions)

**Line numbers shift constantly — always grep. Approximate as of HEAD `df7e4db`:**

| Function | ~Line | Purpose |
|----------|-------|---------|
| `maxWeight(str)` | ~925 | Parse comma/slash/space weight string |
| `_KNOWN_EXERCISES` / `canonExName(str)` | ~927 | Canonical names + save-time normalization |
| **Exercise demo engine** | | |
| `_EX_ALIAS` (≈210 entries) | ~1360 | normalized exercise name → free-exercise-db id |
| `_EX_ABBR` / `_EX_PLURAL` | ~1358 | db→dumbbell, bb→barbell; curls→curl, etc. |
| `_loadExDb()` / `_exDbMatch(name)` | ~1478 | load dataset (CDN, cached) / resolve name→demo |
| `_exTokArr` / `_exSortKey` | ~1405 | token normalize (abbrev+plural+order) |
| `_exThumbHTML` / `_hydrateExThumbs` | ~1530 | exercise thumbnail + live hydration |
| `_libEntryFor(name)` / `_exIdentity` | ~3220 | library override lookup (demo_id/custom media) |
| `openExerciseDetail(raw,disp,opts)` | ~1614 | the demo/detail bottom sheet |
| `_EX_SUGGEST` (182) / `_exAcGetList` / `_exAcShow` | ~975 | autocomplete catalog + token matching |
| `_EX_CATALOG` / `importCommonExercises` | ~1565 | dormant bulk-import (no button) |
| **Builders** | | |
| `renderEditExerciseList()` / `_editExRowHtml` | ~2561 | program builder rows (grouped supersets) |
| `addExerciseToDay` / `addSupersetToDay` / `addToSuperset` | ~2600 | one-at-a-time add + supersets |
| `_encodeEx` / `_parseExForEdit` | ~2595 | SS-prefix ⇄ `.ss` group marker |
| `openExercisePicker` + `_picker*` | ~2608 | multi-select search picker (DORMANT — not wired) |
| `addAdHocExercise` / `addAdHocSuperset` | ~2953 | coach log ad-hoc rows (thumbnails, orange SS) |
| `_syncRowThumb(inputEl)` | ~2553 | live thumbnail on logging rows |
| `confirmLogSession()` | ~3081 | saves session; calls `_ensureLibraryHas` |
| `_ensureLibraryHas(names)` / `_demoMuscleGroup` | ~2745 | auto-add to library (identity-deduped) |
| `openEditLibEx` / `saveLibraryExercise` | ~3260 | exercise editor (demo link/media/muscles/desc) |
| `window._addCustomExRow` / `_addCustomSupersetPair` | ~4760 | client portal custom workout rows |
| **Muscle analytics** | | |
| `exerciseToMuscles(name)` | ~6365 | name → [{muscle, weight}] regex |
| `_mhColor` / `_MH_TARGETS` | ~6469 | color scale / weekly targets |
| `_muscleBalanceHtml(scores,weeks)` | ~6487 | weekly-volume-vs-target bars |
| `loadMuscleHeatmap(clientId,containerId,period)` | ~7280 | fetch logs, score, render diagram+balance+breakdown |

---

## Exercise Demo & Library System (major feature — current session)

### Data source
- **`free-exercise-db`** (873 exercises, public domain) loaded at runtime from jsDelivr CDN: `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json`. Cached in `localStorage` (`bm_exdb`, 7-day TTL) + `_exDb`/`_exById`/`_exDbIdx` in memory. Each entry: `name, level, mechanic, equipment, primaryMuscles[], secondaryMuscles[], instructions[], images[], id`. Images at `…@main/exercises/<images[i]>`.
- **NOTE:** the CDN host is blocked from the Claude Code remote env (can't fetch in-tool), but it loads fine in the user's browser. To inspect the dataset locally, `curl` raw.githubusercontent with `dangerouslyDisableSandbox:true` works.

### Matching (`_exDbMatch`) — the core, order matters
1. Curated alias on raw normalized name (`_EX_ALIAS`, ~210 hand-verified entries)
2. Brand-machine normalization (Arsenal/Prime/Hammer Strength/Hoist/… → "machine …")
3. Curated alias on `canonExName()` output
4. Exact dataset-name match
5. Order-independent **token** match (abbrev `db→dumbbell`, plurals `curls→curl`) against alias keys then unambiguous dataset names
6. **Subset fallback**: longest known movement fully contained in the name (e.g. "Close Grip Lat Pulldown"→Lat Pulldown). **Requires ≥2-word match** — single-word movements are too broad ("Pendulum Squat" must NOT match "Squat"). Wrong-demo is worse than no-demo: unmatched → blank.

### Discoverability
- Every exercise shows a **thumbnail** (`_exThumbHTML` + `_hydrateExThumbs`) in the library, program builder, log rows, and workout cards. Real start-frame image if matched, dumbbell placeholder otherwise. Tapping it opens `openExerciseDetail`.
- Detail sheet: sticky header with × + swipe-down-to-close; animated demo (alternates start/end frames), equipment/level chips, target-muscle chips, instructions, history chart, and a coach-only **"＋ Add demo & details" / "✎ Edit details"** button (hidden in portal via `!window._portalClientId`).

### Custom details (per-library-entry overrides)
- Editor (`openEditLibEx`/`saveLibraryExercise`): **link an existing demo** (`demo_id`, fastest), or paste image/video URL, multi-select muscle groups (`.mchip`), description.
- `openExerciseDetail` & thumbnails apply override priority: linked `demo_id` → custom `image_url` → dataset match.

### Library growth & dedup
- `_ensureLibraryHas(names)` (called from `saveProgramDay` + `confirmLogSession`) adds any not-already-present exercise, **keyed by `_exIdentity` = resolved demo id (or normalized name)** so naming variants collapse to one row. Novel/unmatched → added bare (muscle_group `Other`).
- Client-portal custom-workout logging does NOT yet feed the coach library (separate context) — known gap.

### Autocomplete (rewritten)
- `_exAcGetList()` = `_EX_SUGGEST` (182 curated clean names) + `_KNOWN_EXERCISES` + library + **full 873 dataset** (deduped). Loads dataset on first keystroke.
- `_exAcShow` matching is **token-prefix** (order-independent, plural/abbrev-aware), cached via `_exAcTokCache`, top 10.

### Builders (program + workout-of-day are aligned)
- **+ Add Exercise** = one blank row (inline autocomplete). **⊕ Superset** = orange wrapper group + "+ Add to superset". Supersets stored as `SS{n}: name`; editor parses to `.ss` group markers (`_parseExForEdit`) and re-encodes on save (`_encodeEx`).
- The multi-select `openExercisePicker` exists but is **dormant** (user preferred one-at-a-time).

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

### Muscle-balance bars (`_muscleBalanceHtml`, current session)
Rendered right below the diagram (coach Progress + client Muscles): one ranked bar per `_MH_TARGETS` muscle showing weekly sets vs target (`X/Y sets/wk · NN%`), heatmap color scale, target marker at 66.6% of bar (= 100% of target), sorted most→least trained so over/under-worked muscles are obvious. Reuses the heatmap's `scores`/`weeksInPeriod` — no extra fetch.

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
- Superset wrapper card uses **orange** `⊕ SUPERSET` styling (aligned with program builder; was blue)
- Exercise rows now show a **live thumbnail** next to the name (`_syncRowThumb`)
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
- Shows on 1+ character typed; **token-prefix match** (order-independent, plural/abbrev-aware via `_exTokArr`), max 10 results, ranked (startsWith first, then shorter)
- Candidate pool = `_EX_SUGGEST` (182) + `_KNOWN_EXERCISES` + library + **full 873 dataset**; dataset loads on first keystroke; tokenized candidates cached in `_exAcTokCache`
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
- **Supabase blocked** from Claude Code remote env — can't curl Supabase directly. The **demo CDN (jsDelivr) is also blocked in-tool** but loads in the user's browser; use `curl raw.githubusercontent … dangerouslyDisableSandbox:true` to inspect the dataset.
- **Syne font / silent CSS failures**: invalid `rgba(#hex)` and curly-quote `font-family` rules fail silently and fall back. Fixing the smart quotes made Syne actually load (wider) → collapsed the Edit-modal name field (`grid-template-columns:1fr auto auto` + intrinsic-width inputs). Watch tight `auto`-column input grids — give inputs `width:100%`.
- **`_jsq(s)`** escapes `\ ' "` for exercise names inside inline `onclick` attributes (used by demo taps).
- **`let`/`const` top-level globals are NOT on `window`** (only `var`). `library`, `clients`, etc. must be referenced directly, not `window.library`.

---

## Pending / Known Issues

- **Joe's program**: SQL fix for apostrophes was provided; confirm "1 row affected" in Supabase
- **Chris's api_tokens**: Run `api/_migration.sql` once before `/api/v1/export` will work
- **Jeff's schedule**: `schedule` field may not say "Tue, Thu, Fri" yet
- **`exerciseToMuscles()` ongoing calibration**: As more users test and the breakdown panel surfaces mis-mappings, add new exercise patterns. Use the yellow "untracked" warning + breakdown panel as the feedback loop.

---

## Features Completed (current session — exercise/library/builder overhaul)

- ✅ **Exercise demo system** — `free-exercise-db` (873) runtime-loaded; tap any exercise → bottom sheet (animated demo, muscles, instructions, history); thumbnails everywhere
- ✅ **Forgiving matcher** (`_exDbMatch`): curated `_EX_ALIAS` (~210), brand-machine normalization, token (order/abbrev/plural), ≥2-word subset fallback; "blank beats wrong"
- ✅ **Smart-quote fix** made Syne font actually load → fixed Edit-modal name-field collapse (`1fr auto auto` → name on own row)
- ✅ **Comprehensive autocomplete** — 182 curated + 873 dataset + library, token-prefix matching, cached
- ✅ **Library auto-grows** from used exercises, **deduped by demo identity** (no DB/word-order dupes)
- ✅ **Custom exercise details** — link demo / image+video URL / muscle multi-select / description (5 new `exercise_library` columns; YouTube embeds)
- ✅ **One-at-a-time builders** restored (program + workout-of-day) with **⊕ Superset** groups, live thumbnails, **orange** superset wrappers everywhere
- ✅ **Multi-select search-picker** built then made dormant (user preferred one-at-a-time)
- ✅ **Muscle-balance bars** (weekly volume vs target) below heatmap
- ✅ **Bigger coach nav tabs** (always-labeled), **Today's Workout card** redesign, removed debug logs

---

## Next Logical Steps (in priority order)

1. **User testing feedback** on the workout-of-day builder (user building one "later today")
2. **Client-portal custom workout → coach library sync** (currently a gap — portal logging doesn't feed `exercise_library`)
3. **Continue `exerciseToMuscles()` calibration** via breakdown panel + untracked warning
4. **Strength-over-time charts** (per-exercise est. 1RM trends) — the detail sheet already has a mini history chart to build on
5. **Business tab** (revenue/invoices), **notifications** (low-session reminders)
6. Longer-term SaaS direction: real per-user auth + RLS + multi-coach tenancy + white-label branding + Stripe tiers (see earlier roadmap discussion)

---

**Last Updated:** Current session (HEAD `df7e4db`)
