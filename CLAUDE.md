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

**Current HEAD**: custom-workout **drag-to-reorder FIXED & confirmed on the user's iPhone (both portals)** — root cause was a missing `_setupBlockDrag` call in the coach `di===-1` branch + a stale client cache, not the gesture code (see ✅ entry in Session log). Swipe-to-dismiss removed from `#workout-sheet` to prevent accidental workout loss.
**File**: `index.html`, ~8100 lines (line numbers shift constantly — ALWAYS grep, never trust the numbers in this doc)

> **Standing rule (user instruction):** Shared features like the **custom-workout sheet** must be updated for **BOTH** the coaching portal and the client portal in the **same state**, unless the user says otherwise. When something is clearly a shared feature, update both sides in one pass and call it out — don't ask each time.

### Session log (most recent work — newest first)
- ✅ **Client self-logged workouts silently missing from history — FIXED.** Root cause: the **program-day** portal save (`_logPortalSession`) rendered the "Crushed it!" success screen *optimistically* (inside a `setTimeout`, before the network POST resolved) and only showed failures as a tiny "Save failed" line — so a flaky-wifi log looked identical to success and the session was never written. Now: (1) empty-session guard (must log ≥1 set); (2) save wrapped in `_doPortalSave()` with a **loud, retryable** failure (`window._retryPortalSave`, data held in closure so Retry needs no re-entry); success text only flips to "✓ Saved" once it persists; draft is kept on failure for reload recovery. (The custom-workout path already gated success on the save.)
- ✅ **Package start date** — new `clients.package_started_at` (ISO `YYYY-MM-DD`). Stamped today on **renew** (`confirmRenew`) and on **package change** in the edit form (`saveEditClient`: a manual edit to the new `#ecPkgStart` date input wins/backdates; otherwise auto-stamps today when `package_size`/`remaining` changed). Shown as "📅 Package started …" on the client card (`_fmtPkgStart`, tz-safe). Writes go through `_updateClientSafe` which retries without the field if the column isn't migrated yet. **One-time SQL:** `ALTER TABLE clients ADD COLUMN IF NOT EXISTS package_started_at date;`
- ✅ **Generate Next Program** (coach) — `generateNextProgram(clientId)` button at the bottom of the Program tab (`renderStructuredProgram`). Deep-clones the current `structured_program` (same day names/colors, same prescriptions/loads, same superset SS-prefixes) but swaps each exercise for a fresh variation hitting the **same primary muscle + mechanic** via the demo dataset. **Inline Edit mode** in the preview sheet: a big **✎ Edit Exercises** toggle (`_genToggleEdit`/`window._genEditMode`) turns each row into editable name (autocomplete + live thumb via `_exAcInput`/`_syncRowThumb`) + sets/reps + load, with per-day **+ Add exercise** (`_genAddEx`) and × remove (`_genDelEx`); `_genReadEditInputs` syncs DOM→`window._genProgram` (SS prefixes preserved) on every toggle/structural change and before Apply (which also drops blank rows). Flow: generate skeleton → tweak by hand → Apply. `_altExerciseFor(name,used,first)` ranks candidates (`_altScore`: same mechanic +3, gym-staple equipment +2/2.5, level, **+3 recognizable staple** via `_genCommonIds` = dataset ids the curated `_EX_SUGGEST` resolve to, **−3 odd phrasing** `_GEN_ODD_RE` kneeling/guillotine/around-the-world/etc, −len penalty for >4-word names), pool hard-filtered by `_genOkEx` (category `strength` + `_GEN_OK_EQUIP` + not `_GEN_BAD_RE` clean/snatch/jump/etc — the dataset is full of strongman/mobility junk). **Slot-aware:** the day's lead lift (`ei===0`) is kept a recognizable compound (compound-only pool) and picked from the top 2; accessory slots pick from the top 6 so some interesting variety still comes through (user wants *some* obscurity, just not as the main lift). Demo z-index: gen sheet is **8800** (< demo sheet 9000) so tapping a thumbnail in edit mode opens the demo on top. `used` map (by `_exIdentity`) seeds with ALL original exercises so nothing repeats. Preview sheet (`_openGenPreview`/`_genPreviewBodyHtml`) shows per-day new exercise + "was: X" + kept prescription, with **🔄 Regenerate** (`_buildGenProgram` reshuffles, randomness among top-5) and **✓ Apply** (`_applyGenProgram`: confirm → strip `_from`/`_swapped` helpers → set new `started_at` → save → `_ensureLibraryHas`). Logged history untouched. Validated swap quality offline against the 873-exercise dataset (Node harness). `_OUR_TO_EXDB` maps our muscle keys→dataset vocab for the fallback when `_exDbMatch` misses.
- ✅ **Progression guide** (coach + client, shared) — replaced the separate "📊 Last" line + "🎯 Target" chip with one unified **"Last time → Do this today"** card (`_progressionGuideHtml`). Now **multi-session aware**: `_buildExSeriesMap(sessions)` builds a per-exercise e1RM series; `_progressionGuide` tags **↗ PROGRESSING** (`up`), neutral (`hold`), or **→ STALLED** and tailors the suggestion (progressing/hold→double-progression add load/rep; stalled→grind +1 rep / small bump / "deload ~10%"). **STALL requires a 3-session plateau or decline** (e1RM flat-or-down across the last 3 sessions) — one flat week stays `hold` (no badge, still suggests pushing for the next jump), per user instruction. `_exGuideFor` falls back to the single `exercise_history` entry when sessions are empty. Coach builds `_serMap` from `c._sessions` in `updateLogWorkout`; portal from `window._portalRecentSessions` in `renderWorkoutCard`. Tap "Last time" → history, tap "Do this today" → fills inputs (`_applyTargetCoach`/`_applyTargetPortal`). Old `_suggestNext` kept for compat.
- ✅ **Client custom-workout save** now verifies the session POST (`if(!r.ok) throw`) before showing "Crushed it!" — was silently swallowing save failures.
- ✅ **Coach log DATA-LOSS bug FIXED** — picking **"↳ Custom Workout"** (or any other day) from the `logDaySelect` dropdown mid-session ran `updateLogWorkout` which **rebuilds `#logExercises` from scratch**, silently wiping every set already typed into the program rows; then `confirmLogSession` saw `di===-1` and **skipped the entire program branch**, saving ONLY the ad-hoc rows. Symptom (reported by user re: Tim): logged a full upper-body program day + added leg raises at the end → only leg raises showed in session history & muscle chart (abs only). Fix: (1) `_onLogDayChange(id,sel)` confirms before switching when `_coachLogHasData()` and reverts the dropdown on cancel (points the coach at "+ Add Exercise" for extra lifts); (2) `updateLogWorkout` records `window._logRenderedDi`; (3) `confirmLogSession` uses `window._logRenderedDi` (the actually-rendered day) instead of re-reading the live dropdown, so the program branch can't be skipped by dropdown drift. **Lost data is unrecoverable** (draft only holds program rows and was overwritten/cleared) — coach must re-log.
- ✅ **Coach draft now covers ad-hoc rows (crash/reload recovery) — last in-progress data-loss gap CLOSED.** Ad-hoc inputs (`an-adhoc-`/`wr-adhoc-`/`wt-adhoc-` + the × delete) now fire `saveDraftCoach()`; `saveDraftCoach` persists the ad-hoc rows in DOM order (`adhoc:[{name,reps,weight}]`) plus the **rendered** day index (`window._logRenderedDi`, so a Custom Workout di=-1 is captured correctly); `restoreDraftCoach` rebuilds them flat (clears `#adhoc-exercises`, resets `_adhocCount`, re-adds via `addAdHocExercise()` then fills) — matches how ad-hoc rows are saved (flat, no SS). `restoreDraftCoach()` runs in `init()` after clients load. Backward-compatible with old drafts (no `adhoc` key → `[]`).
- ✅ **Coach log-modal safety** — `closeLogSession(force)` confirms before discarding an in-progress session; wired to the **Cancel** button and the **backdrop-tap** (the global `.modal-overlay` click handler now special-cases `logModal`). `_coachLogHasData()` checks program-day rows (`wr-`/`wt-`) **and** ad-hoc/custom rows (`an-adhoc-`/`wr-adhoc-`/`wt-adhoc-`) + note. (Crash/reload is now recoverable via the draft too — see entry above.)
- ✅ **Audit "Verified ✓" checkoff** — per-exercise "✓ OK" button in Review Demos stores `bm_exverified` (localStorage, keyed by `_normExName`); verified rows force `sev=0` so they drop out of "Show only flagged". `window._libRevToggleVerified(name)`, `_isExVerified`, `_libVerifiedMap`. Summary shows verified count; category counts exclude verified.
- ✅ **Autocomplete dropdown scrollable** — `#_ex-ac-drop` was `overflow:hidden` with no height cap (suggestions below the keyboard unreachable). Now `overflow-y:auto` + `touch-action:pan-y`, height capped to available space, flips above the input when there's more room up top.
- ✅ **Exercise audit — "Review Demos" upgraded to a smart triage view (Library tab).** `_renderLibReview` now flags likely-wrong matches instead of making the coach eyeball all ~200. (1) **Confidence tier:** `_exDbMatch` sets `_exMatchTier` (`alias`/`exact`/`token-curated`=trust, `token`=fuzzy, `fallback`=guessed/risky, `none`). (2) **Demo↔muscle disagreement:** compares the matched demo's group (`_demoMuscleGroup`) vs our `exerciseToMuscles()` top group (`_ourTopGroup`, via `_OUR_COARSE` map) → red "muscle mismatch" (catches flutter-kicks-type wrong-on-both). (3) Shows OUR heatmap mapping per row (not just the dataset's), plus "untracked" flag when `exerciseToMuscles` returns nothing. Rows sorted problems-first by severity; summary counts; "Show only flagged" toggle (`window._libRevOnlyFlagged`). `Fix ✎`→`openEditLibEx` unchanged. **Next audit pieces offered but NOT yet built:** (4) "Verified ✓" checkoff (localStorage) to shrink the list; (5) matcher fixes e.g. rope/V-bar/EZ-bar/straight-bar = cable attachments (overhead rope extension → cable, not dumbbell); (6) offline batch triage report. Validate any matcher change with the Node harness ("blank beats wrong").
- ✅ **"Log This Workout Again"** in the read-only session viewer (`_showSessionDetail`): `window._repeatThisWorkout` dispatches by ctx → `_repeatWorkoutPortal` (client custom sheet) or `_repeatWorkoutCoach` (coach ad-hoc log, di=-1), pre-filling name/reps/weight. Superset prefixes flattened (custom savers store flat names). Viewer also got **swipe-down-to-dismiss** + grab handle (safe — read-only, no in-progress data; opposite of the workout sheet).
- ✅ **Custom-workout drag-reorder — FIXED & confirmed on the user's iPhone (both portals).** The whole prior multi-session saga was a **wiring bug, not a gesture bug**. The `_setupBlockDrag` pointer-event engine (`~line 2889`, reparent block to `<body>` + placeholder + DOM reorder; `_blockDrag` flag) was fine all along.
  - **Root cause (coach side):** `updateLogWorkout`'s Custom-Workout branch (`di===-1`) builds the ad-hoc rows then `return`s **before** the line that calls `_setupBlockDrag(#adhoc-exercises)` (that call only lived in the program-day branch). So on the coach Custom Workout screen the drag listener was **never attached** — every prior "approach" was tuning gesture code that wasn't running. Fix: added `_setupBlockDrag(document.getElementById('adhoc-exercises'))` inside the `di===-1` branch.
  - **Root cause (client side):** code was already correct (`renderCustomWorkoutSheet` calls `_setupCustomDrag()` → `_setupBlockDrag(#custom-ex-list)`); the "broken" report was a **stale Safari cache** on `pt-hub.vercel.app`. A reload showed the `⠿` handles and drag worked (confirmed via temp on-screen HUD: clean `pointerdown→grabbed→50+ moves→POINTERUP`, no `pointercancel`).
  - **Diagnosis method that cracked it:** a temporary on-screen debug HUD (`_dbg`) inside `_setupBlockDrag` logging pointerdown/move/up/cancel. It revealed "no HUD at all" on the coach screen = listener never attached. HUD has since been **removed**.
  - **Also fixed same pass — swipe-to-dismiss removed.** `#workout-sheet` had swipe-down-to-close handlers (the two `_swipeListenersAdded` blocks) that could discard an in-progress/finished-but-unlogged workout (catastrophic). **Both removed**; the sheet now closes only via the deliberate "← Back" button. (Coach log uses a `.modal`, unaffected.)
- **Smarter PRs by estimated 1RM (Epley)**: all PR/PB detection now uses `_bestE1RM` (rep PRs at same weight count). Touched coach live badge + `confirmLogSession` (program-day + ad-hoc), client portal live badge + `_logPortalSession` + `_logCustomPortalSession`, and client Home "PRs this month" chip. PRs *tab* (`renderPortalPRs`) already used e1RM. +0.01 float tolerance.
- **Tap a completed session to view it**: read-only `_showSessionDetail(s,histCtx)` (~line 3627, z-index 8900 so demo sheet 9000 layers above). Wired to coach session-history rows (`_coachShowSession`) and client Home "Recent Workouts" rows (`_portalShowSession`). Home "Recent Workouts" list made prominent (accent bar + Syne heading + "Tap to view").
- **Abbreviation matching**: `exerciseToMuscles` normalizes `oh→overhead, db→dumbbell, bb→barbell, kb→kettlebell` at the top; `_EX_ABBR` got `oh→overhead`. Rescues pre-dropdown hand-typed programs ("OH DB Extension" etc.).
- **DB-connect resilience**: `sb()` retries GET 3× w/ backoff; `init()` only fatal on clients fetch (equipment etc. `.catch`); error box has ↻ Retry + shows real error. (A "could not connect" report turned out to be the user's WiFi having no real internet path to Supabase.)
- **Exercise accuracy pass**: fixed muscle-chart mappings (0 untracked of 182) + blank/wrong demos. Notable demo aliases added: chest dips, reverse lunge, sissy squat, overhead/OH DB extension→Standing_Dumbbell_Triceps_Extension, machine dip(s)→Dip_Machine, hamstring curl(s)→Lying/Seated_Leg_Curl. Muscle-chart fixes: close-grip lat pulldown→back, wrist curl→forearms, nordic curl→hamstrings, cable crossover/svend→chest, reverse pec deck→shoulders, hanging knee raise/flutter/wood chop/hollow/med-ball-slam→abs, rack pull→back, thruster/farmers walk/sled push/olympic lifts/burpee mapped.

**Verification harness** (rebuild after edits to test matcher/muscle mapping in Node): a Python extractor pulls `_EX_ALIAS`, `_exDbMatch`, `exerciseToMuscles`, etc. from index.html into `/tmp/lib.js`; load with the dataset at `/tmp/exdb.json` (`curl raw.githubusercontent…free-exercise-db…/dist/exercises.json` with `dangerouslyDisableSandbox:true`). Used to verify exercise demos + muscle mappings without a browser.

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
- `package_size`, `remaining`, `package_started_at` (ISO date — when current package began; set on renew/package edit), `schedule`, `run_schedule`, `run_program_id`, `run_program_week`, `run_week_done`
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
| `_bestE1RM` / `_sessionVolume` / `_exChartRender` | ~1500 | strength-chart math + Est-1RM/Top/Volume toggle |
| `_coachExPts` / `_openExDetailCoach` | ~1700 | coach-side per-client history for the detail sheet |
| `_fillLastPortal` (window) | ~5820 | client portal "Fill Last Session" |
| `renderMuscleDiagram(scores,weeks)` | ~6644 | body-map SVG; colors `<g id>` groups via `muscleMappings` |
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
- Client-portal custom-workout logging NOW feeds the coach library (`_logCustomPortalSession` loads the library first — the portal never runs `init()` — then calls `_ensureLibraryHas`).

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

### Per-exercise strength charts (current session)
The detail sheet's history (`_exHistHtml` + `_exChartRender`) is a strength-progression view: **Est. 1RM** (Epley on the best set/session via `_bestE1RM`) by default, toggle to **Top Wt** / **Volume** (`_sessionVolume`), headline (current value, % change, 🏆 on all-time best), per-session bars, recent sets. **Client-specific**: portal passes the client's own pts (`_portalExPts`); coach passes the *viewed* client's pts (`_coachExPts` via `_openExDetailCoach`, wired by `coach:<clientId>` thumbnail context). Library detail (no client) shows demo only.

### Muscle diagram (`renderMuscleDiagram`)
- Stock anatomical SVG (workout-planner). Colors `<g id="...">` groups by setting a group `style="fill:..."`; child `.st4/.st5` paths converted to `fill:inherit`. `muscleMappings` wires our muscle keys → SVG group ids.
- **Untrained muscles blend into the body color** (`c()` 0-score fallback = `rgba(15,35,65,0.6)`, opacity 1) so there are no stark gray "holes"; trained muscles use the heat scale.
- Per-region tweak: the two long inner-thigh strands (`M760.41`/`M1015.98`) are repainted with the quad color (anatomically quad, were in `hip_adductor`).
- **Known stock-SVG limitations** (defer to visual rework / asset swap): lower-back drawn as two outward "wings" not a single erector block; `hip_abductor` (glute_med) region a bit large; thigh split across quads/adductor/abductor groups. Reshaping paths can't be done reliably "blind" — needs a better-segmented SVG.

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

### Secondary-muscle weights (calibrated current session, EMG-informed)
- **Chest press** → chest 1.0, triceps 0.5, **shoulders 0.3** (was 0.4)
- **Horizontal rows** → back 1.0, **traps 0.6** (mid-trap/rhomboid; was 0.25), biceps 0.4, forearms 0.25
- **Vertical pulls** (pull-up/pulldown) → back 1.0, **biceps 0.35** (was 0.5, lat-dominant), traps 0.3, forearms 0.2
- **Chin-up** → back 1.0, biceps 0.45, traps 0.3
- **Bench guard**: the chest `/bench|push.?up/` rule is guarded `&& !/thrust|glute|bridge|\brow\b|step.?up|sit.?up|crunch/` so "Hip Thrust on Bench", bench rows, etc. fall through to their correct mapping (don't get tagged chest).

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
- **`exercise_logs` is the source for the client PRs tab AND the muscle heatmap.** The portal *program-day* save (`_logPortalSession`) used to write only `sessions` + `exercise_history`, so self-logging clients had empty PRs/Muscles. Fixed (now writes `exercise_logs` too, SS-prefix stripped). Historical sessions were backfilled via a one-time SQL (`INSERT INTO exercise_logs … FROM sessions, jsonb_array_elements(workout) … NOT EXISTS`). The coach `confirmLogSession` and the custom-workout path always wrote it.
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

1. ✅ **DONE — Smarter PRs (estimated-1RM)**: all PR/PB detection now uses `_bestE1RM` (Epley) everywhere (see session log).
   - **"Repeat this workout" button** (requested, not urgent): add a "＋ Log this again" button in the `_showSessionDetail` viewer that pre-loads the exercises into the custom-workout sheet. User said nice-to-have for custom workouts.
2. **Continue `exerciseToMuscles()` calibration** via breakdown panel + untracked warning. Known untracked compound lifts: Thruster, Clean, Snatch, Farmers Walk, Sled Push (in `_EX_SUGGEST` but return `null` → untracked, no volume/PR credit).
3. **Home streak / "on track this week"** nudge on the client Home tab (uses `_portalRecentSessions` + `_portalScheduleDays`, already loaded).
4. **Body-tab goal lines** — target weight / body-fat % reference lines on the existing body-stat trend charts.
5. **Notifications** (low-session reminders) — the **Business tab is already built** (`renderBusinessView`: Needs Attention / Inactive 10+ / month overview / Renewals projection / Long-Term clients).
6. Longer-term SaaS direction: real per-user auth + RLS + multi-coach tenancy + white-label branding + Stripe tiers (see earlier roadmap discussion).

---

## Features Completed (latest session — library reach)

- ✅ **Client custom-workout → coach library sync** — `_logCustomPortalSession` now loads the library (the portal never runs `init()`, so the `library` global is empty there → load first or POST duplicates) then calls `_ensureLibraryHas`. Closes the documented gap.
- ✅ **Coach Library search → dataset fall-through** — searching the Library tab (`renderLibrary`, 2+ chars) now surfaces matching `free-exercise-db` exercises not already in the library, under an "Exercise Database" section with a **+ Add** button (`addLibFromDataset(id)`, links the demo via `demo_id`). Deduped by demo identity; one-shot re-render once the dataset loads (`_libDbReload` guard).

---

**Last Updated:** HEAD `2aba51e` — this session: **custom-workout drag-reorder FIXED & confirmed on the user's iPhone for BOTH portals** (root cause = missing `_setupBlockDrag` call in coach `di===-1` branch + stale client cache, not the gesture engine), and **swipe-to-dismiss removed** from `#workout-sheet` (was discarding in-progress workouts — close only via "← Back"). Diagnosed with a temp on-screen HUD, since removed. **Standing rule reaffirmed by user:** treat the custom-workout sheet as a shared feature — always update coach + client together. **Open items:** (1) "repeat this workout" button; (2) simplifying program building (user says it still feels slow — ask which part drags); (3) ongoing `exerciseToMuscles` calibration as the user reports wrong demos/muscles while training. Prior sessions: e1RM PRs, tap-to-view sessions, abbreviation matching, DB resilience, exercise accuracy pass, client→coach library sync, coach Library dataset search, strength charts, portal exercise_logs fix + backfill, EMG-calibrated secondary-muscle weights, muscle-diagram untrained-blend. Body-diagram anatomy deferred to the visual rework / SVG asset swap.
