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

**Current HEAD** `dbf48af`: found and fixed the vanishing-supersets bug's *real* trigger for Tim specifically — his stored exercise names use a legacy "SS1 Name" (bare space, no colon) tag format that every colon-requiring regex in the app silently failed to recognize (see "Session log" below and the "RESOLVED" section for full detail). The earlier same-session fix (`cf00676`, superset-unaware drag-reorder + `removeEx()`) was a real, separate bug and is still correct/needed — it just wasn't what was actually hitting Tim. Everything ships straight to `main` → Vercel. **Standing instruction from the user this session: push every fix/addition to `main` immediately, no holding changes on a review branch — the user checks on their phone as we go and will say if something needs reverting.**
**File**: `index.html`, ~9700 lines (line numbers shift constantly — ALWAYS grep, never trust the numbers in this doc)

---

## Generate Next Program: supersets not surviving generation — RESOLVED (was "⚠️ OPEN ISSUE")

**Original symptom:** generating a program for client "Tim" produced **zero supersets in any workout** — every exercise came out as a standalone row, even ones the user expected to be paired. Six earlier fixes in the prior session (lead-exercise flip-flop, back-region matching, over-aggressive keep-rate, unifying the generate-preview's editor with the real one, and fixing "superset of one" display) were all correct and are NOT being re-litigated here — see git history around `f34b19e`..`5441677` if ever needed.

**Actual root cause, found by code audit + an offline repro (not just the "check Tim's data" diagnostic step the prior session left as next-step):** the program-day editor's **drag-reorder** (`setupExDrag`) moved individual `.edit-ex-row` elements with zero awareness of superset grouping. Dragging just ONE member of a superset pair to a different spot in the list silently separated it from its partner in `editingExercises`/stored `structured_program`, while **both rows kept the same `.ss`/`SSn:` group tag** — same-tag-but-non-adjacent, a form of corruption invisible until something tried to group by that tag. `removeEx()` (deleting one exercise) had the identical failure class: no cleanup of the surviving partner's tag.

This is exactly what produced the "zero supersets" symptom, and why the normal editor and Generate Next Program could disagree on the *same* stored data:
- `_genOrderDay` (generator) grouped strictly by **adjacency** → saw the split pair as two orphaned singles → the (correct, previously-shipped) solo-demotion logic dropped both to plain exercises.
- `_parseExForEdit` (normal editor) grouped by raw **tag count**, not adjacency → behaved differently on the identical data, which is why the two paths never told a consistent story.

**Fix shipped (commit `cf00676`), verified offline against three scenarios — a scattered-but-real pair, a genuinely orphaned solo tag, and a normal well-formed pair — all behave correctly:**
1. **`_coalesceSsGroups(exs)`** (new) — regroups same-tag exercises back to adjacent regardless of how they ended up ordered in storage, so a pairing that got scattered is *rescued* instead of dropped. Both `_genOrderDay` and `_parseExForEdit` now call it first, so they can never diverge on the same input again.
2. **`setupExDrag` rewritten to be superset-aware.** Two modes based on which handle is grabbed: the superset header's own handle (new — `.ex-drag-handle-group`, added to the wrapper's "⊕ Superset" bar) moves the **whole group** as one block among other top-level blocks/exercises; a row's own handle, when that row lives *inside* a superset wrapper, now only reorders members **within** that same group — it can no longer escape and desync from its partner. Standalone rows behave exactly as before (unaffected).
3. **`removeEx(i)`** now demotes an orphaned partner immediately when a deletion leaves it alone in its group, instead of leaving a stale tag for something else to trip over later (this closes the exact gap the prior session flagged as a follow-up).

**Why this was missed before:** the prior session's diagnostic plan assumed the corruption (if any) was pre-existing in Tim's stored data from an old `removeEx()` call, and the next step was "ask the user to check the normal editor." The actual mechanism turned out to be reproducible in the app **today**, on fresh data, via ordinary drag-reordering in the program editor — a much more common coach action than deleting a superset member. No live-data check was needed to find or fix this; it was fully diagnosable and testable offline (see below).

**⚠️ This fix alone did NOT resolve Tim's symptom** — the user re-tested and still got zero supersets on every regenerate. A screenshot of Tim's day in the normal editor revealed the *actual* trigger: his exercise names are literally `"SS1 Lat Pulldown"`, `"SS2 Chest Fly"`, etc — **a bare space, not the `"SS1: Name"` colon-space format** every current save path (`_encodeEx`) writes and every read site's regex required. This is clearly data from an older version of the app, before the colon convention existed. Because the regex demanded a colon, it silently failed to recognize or strip the tag *anywhere* — not just in Generate: superset grouping in the normal editor, PR detection, `exercise_logs` writes, muscle-mapping input, autocomplete fill, and the session-detail viewer all treated these rows as plain exercises with a literal `"SS1 "` stuck in the visible name (exactly what the screenshot showed — six individually-bordered gray rows, no orange superset wrapper).

**Second fix, commit `dbf48af`:** introduced one shared `_SS_TAG_RE=/^SS(\d+)\s*:?\s*/i` (colon optional) and replaced all ~30 call sites across the file that previously used a colon-requiring pattern. `_buildGenProgram` additionally now rebuilds the tag in the canonical `"SS<n>: "` form on every generate pass (rather than preserving whatever separator the source data used), so a legacy-format program self-heals to the modern format the moment it's regenerated. Verified offline against Tim's *exact* data shape from the screenshot (SS1/SS2/SS3, three pairs, no colons) — both the generator and the normal editor now recognize all three pairs with clean display names.

**Residual, low-priority note:** any of Tim's *historical* `exercise_logs` rows that were written while this bug was live may have `"SS1 "`-polluted `exercise_name` values baked in permanently (those aren't retroactively cleaned — this only fixes read/write behavior going forward). Not worth a data migration unless it actually surfaces as a visible problem (e.g., in PR history or the muscle heatmap for old dates).

**Not yet independently confirmed:** the user has not yet re-tested Tim's actual program on their phone since the second fix shipped. If it's still not resolved, get a fresh screenshot of both the normal editor and a new Generate attempt.

> **Standing rule (user instruction):** Shared features like the **custom-workout sheet** must be updated for **BOTH** the coaching portal and the client portal in the **same state**, unless the user says otherwise. When something is clearly a shared feature, update both sides in one pass and call it out — don't ask each time.

> **Workflow habits this project expects:** syntax-check every edit (`node` extract script blocks → `new Function`) before commit; commit+push to `main` immediately after each verified change; update this file's Session log after each shipped item; the user tests on their iPhone (PWA, `viewport-fit=cover` — mind `env(safe-area-inset-*)` on anything fixed to screen edges).

## Visual System (established this session — do not regress)
- **Ambient particle canvas** `#ambient-bg` (see session log "Ambient v2/v3/v4"): fixed, z:0, `main` is z:1 above it. NEVER put it at negative z-index (iOS culls it behind composited scrollers).
- **Cards are near-transparent glass**: `rgba(16,22,29,0.22)` + hairline border (`--border2`), NO backdrop blur (blur smears the 2px motes invisible). Applies to `.card`/`.stat-card`/`.client-card`, dashboard stat tiles, Today ring card, Clients-grid rows (`rgba(23,29,38,0.2)`). Modals/sheets/inputs stay OPAQUE for readability.
- **Design tokens**: neutral hairline borders (`--border`/`--border2` rgba(148,180,220,…)), surfaces `#10161d/#171d26/#1d242f`, accent #4fa3e8/#2563eb, success #43d9a2, Syne (display) + Instrument Sans (body).
- **Signature elements**: Today gradient ring (blue→green, `#todayRingGrad`); per-client avatar = dark glassy tile + hue glint + colored initials (`_clientHue` golden-angle by join order, `_avatarStyle(c,size)`); top radial glow per view; bottom light source + rising motes.
- **Native feel**: no tap-highlight, `touch-action:manipulation`, `button:active` scale, `div[onclick]:active` dim (hover:none), stagger `_staggerIn` on first render only, stat count-up once (`_statsAnimated`).
- **Emoji policy**: none in persistent chrome (SVG/text instead); "moment" emoji OK (⚡ CTAs, 🏆 PBs, Crushed-it screen).

### Session log (most recent work — newest first)
- ✅ **"Combine two exercises into a superset" — new action in the program-day editor** (`531fdd1`). The existing "⊕ Superset" button (adds two blank paired slots) was kept as-is (user: "works well"); this adds the complement they asked for — grouping exercises that are *already* in the day as standalone rows. A "⊕ Combine two exercises into a superset" link (`_renderPairTrigger`, rendered into `#exPairTrigger` below the list) appears whenever the day has ≥2 standalone exercises. Tapping it enters a lightweight **pair mode** (`window._exPairMode`/`_exPairSel`): each standalone `.edit-ex-row` shows a tappable select circle (`.ex-pair-check`; superset-member rows aren't selectable), and a `.pair-mode-bar` at the top of the list shows the running count + Combine/Cancel. `_exCombineSelected()` assigns the picked rows a fresh `_nextSsGroup()` id and splices them contiguous, anchored at the first selection, so they render in one orange wrapper. Drag-reorder is disabled while pairing (`setupExDrag` bails on `_exPairMode`; handles hidden via `#editExerciseList.pairing .ex-drag-handle`); any add/remove or reopening the editor calls `_exExitPairState()` so stale indices can't be acted on. Lives in the shared editor, so it's available in normal edit, build-new-program, AND the generate-preview edit. Combine/reorder logic verified offline (adjacent, scattered, three-way, already-grouped-selection cases).
- ✅ **Generate Next Program — vanishing supersets, RESOLVED (took two fixes).** See the "Generate Next Program: supersets not surviving generation — RESOLVED" section near the top of this doc for full detail. **Fix 1** (`cf00676`): the program editor's drag-reorder (`setupExDrag`) and `removeEx()` were unaware of superset grouping — either could separate a paired exercise from its partner while both kept the same group tag, corrupting `structured_program`; the generator's adjacency-based grouping then correctly demoted these corrupted pairs, which looked like "zero supersets." Fixed with `_coalesceSsGroups()` (rescues scattered-but-real pairs) + a superset-aware drag-reorder + a self-healing `removeEx()`. **This was a real bug but didn't fix Tim** — user re-tested, still zero. A screenshot of Tim's day in the normal editor revealed the actual trigger: his exercise names are literally `"SS1 Lat Pulldown"` etc — a bare-space legacy tag format (pre-dates the `"SS1: Name"` colon convention every current save path writes) that every colon-requiring regex in the app silently failed to recognize, not just in Generate. **Fix 2** (`dbf48af`): introduced a shared `_SS_TAG_RE` (colon optional) and swapped it into ~30 call sites across the file (grouping, PR detection, `exercise_logs` writes, muscle mapping, autocomplete, session viewer); `_buildGenProgram` now also normalizes the tag to the canonical colon form on every generate pass, self-healing legacy data as it's used. Verified offline against Tim's exact data shape from the screenshot. **Still not independently confirmed on the user's phone as of this write-up** — the two-fixes-in-one-session history here is a reminder that a *plausible, real* root cause (fix 1) isn't necessarily *the* root cause for a specific user report; get an actual data sample (screenshot, or raw JSON) before declaring victory next time this class of bug comes up.
- ✅ **Coaching Insights (dashboard) + Protocol Library (program builder + Library tab) — new coach-facing feature pair**, built to solve a problem the user described directly: "I get stuck in the same patterns... doing the same exercises and rep schemes with everybody... I have the knowledge in my head but don't reach for it in the day-to-day." Two parts: (1) **Coaching Insights** (`computeCoachInsights()` — grep it): cross-client pattern detection on the dashboard, tappable → `openCoachInsightsDetail()` full detail view with actual client names + real alternative-exercise suggestions (reuses `_altExerciseFor`, the same swap logic Generate Next Program uses). Flags an exercise overused across ≥50% of active programs, rep-scheme homogeneity (≥70% straight 8-12 reps), and programs running 6+ weeks unchanged. Deliberately conservative — needs ≥3 active programs before saying anything, never guesses at signals the data can't support. (2) **Protocol Library** (`_PROTOCOL_LIBRARY` array + `openProtocolPicker()`): 17 set/rep schemes beyond straight sets (5x5, pyramids, wave loading, clusters, myo-reps, rest-pause, DUP, contrast/PAP, density blocks, EMOM, circuits, deload week, 1RM testing, isometric holds), grouped into 5 color-coded collapsible categories (Strength/Hypertrophy/Power/Conditioning/Recovery & Testing) matching the exercise-library's own collapsible-group visual pattern. Accessible standalone (Library tab) and contextually (💡 Ideas button per exercise row in the program builder, applies directly to that row). **Smart defaults layer on top** (`_prescSuggestionFor(clientId,name)`): every "+ Add Exercise" used to hardcode `prescription:'3x10'` as the seed value — found and fixed at the source (now seeds empty) so a dashed "💡 Suggested: X — tap to use" chip can appear instead, deliberately excluding whatever scheme that client's `exercise_history` shows they did last time. Same helper now also drives Generate Next Program's rep-scheme rotation. An inline (non-popup) day-completeness nudge (`_dayGapNudge()`) flags missing core work once a day has 3+ exercises, using the existing muscle mapping. **Explicitly deferred to a future session per user request:** a "continuing education" feature (surfacing current training/nutrition research to counter coaches calcifying on decades-old methods) — noted, not built.
- ✅ **Data safety: evaluated, built, then intentionally removed a DIY backup layer.** User was on Supabase free tier (zero automatic backups) — flagged as the most urgent item in the whole session given "I run my entire business through this." Built a Vercel Cron → `/api/backup` → dated JSON commits to a `backups/` folder in this repo (with `scripts/restore-backup.js` + a plain-English `BACKUP_AND_RESTORE.md`), explicitly 404'd `/backups/*` in `vercel.json` so client data (names/sessions/weights) couldn't be scraped as public static files. User then upgraded to Supabase Pro (real automatic backups + point-in-time recovery) and, on reflection, decided the DIY layer's ongoing setup/maintenance cost wasn't worth it as a second layer for a fairly low-probability failure mode (Supabase project/account itself being lost, as opposed to accidental data loss within it, which Pro covers) — all of it was cleanly removed (`git log` around `0f793bb`..`7a94cc3`). **If backups ever come up again: Supabase Pro is the actual safety net now — don't assume it's unhandled.**
- ✅ **Full visual pass across every remaining coach + client-portal surface** (dashboard/client-modal-header/login/log-modal already had atmosphere from the previous session — this pass covered what didn't): real app icon (recreated the user's "BM hex" brand mark from a photo of a design-system slide as static PNGs at every size, replacing a runtime canvas-drawn dumbbell) + `manifest.json`; redone login screen (glass card, brand mark, breathing atmospheric glow, spinner instead of plain text-swap on the button); log-session modal got its own ambient layer (thin rising blue→green streaks — deliberately a different SHAPE than the dot-based ambient elsewhere, was an explicit user request for differentiation); client portal (Home/Train tabs, header/tabbar) brought up to the same glass-card + ambient-canvas treatment as the coach dashboard, while deliberately leaving the actual workout-LOGGING sheet opaque (data-entry surfaces stay opaque for readability, browsing surfaces go glass — established rule, applied consistently); client-modal body (Program/Progress tabs) + Business tab + Programs tab template list converted from flat `var(--surface2)` fills to the same near-transparent glass card treatment as everywhere else. Also started (not finished, ongoing) chipping away at inline-style sprawl by introducing real shared classes (`.icon-btn`,`.pill-btn`,`.pill-btn-danger`,`.spinner-sm`,`.btn:disabled`) and converting call sites as screens get touched, rather than one unverifiable whole-file sweep.
- ✅ **Ambient v4 (final of this session):** blur was smearing the tiny motes invisible → cards now **near-fully transparent** (`rgba(16,22,29,0.22)`, border-defined, no backdrop-filter; grid rows 0.2 with border 0.12); compact-row hover bg-swap removed earlier stays. Particles **+20%** → 48–102 (area/13300).
- ✅ **Mid-workout draft survival (user: locking phone between sets sometimes lost the in-progress log).** Root cause found by audit: draft saved per keystroke + cold-start restore both worked, BUT any freshly-opened log modal's deferred render ran `saveDraftCoach()` on empty inputs — so after an iOS page eviction, tapping into a client (or "Up next") **faster than `restoreDraftCoach` fired overwrote the draft with empties**. Fixes: (1) `saveDraftCoach` now REFUSES to overwrite with an empty draft (hasData guard — empty states are never stored; explicit `clearDraftCoach` on complete/cancel is unaffected). (2) New `_tryFillFromDraft(clientId)` called from `openLogSession`'s deferred render (all 3 branches): if the stored draft is for THIS client and the modal is untouched, it refills program rows + ad-hoc rows + note — **switching the dropdown to the draft's day** if a different day was preselected; never clobbers live input (`_coachLogHasData` guard); re-persists + toasts "In-progress session restored ✓". (3) `restoreDraftCoach` simplified to just `openLogSession(draft.clientId, draft.dayIndex)` — fill happens via the same `_tryFillFromDraft` path. (4) `visibilitychange→hidden` runs `saveDraftCoach()` as insurance at the instant iOS suspends the page. Nav-blocking rejected: modal already covers the tab bar (z 200 > 100).
- ✅ **Frosted-glass cards (ambient v3 — user: cards block the background).** Card surfaces converted from opaque `var(--surface)` to `rgba(16,22,29,0.55)` + `backdrop-filter:blur(16px)` (+-webkit-): `.card`/`.stat-card`/`.client-card` (shared CSS line), dashboard stat tiles + Today ring card (inline), Clients-grid compact rows (`rgba(23,29,38,0.5)`, blur 14px). Particles now glow through every card as soft diffuse light. Modals/sheets/inputs stay OPAQUE deliberately (readability + full-screen blur cost). Also fixed pre-existing compact-row hover that set `this.style.background=''` on mouseout — with inline glass backgrounds that wiped the card bg entirely after a tap (hover bg-swap removed, border-only now). **Perf note:** ~10 live blur regions on screen at once — fine on modern iPhones; if older-device jank is ever reported, drop the blur and keep translucency. Root cause of vanishing: canvas was `z-index:-1` — **iOS culls fixed layers at negative z-index behind composited scroll layers** (the transformed/touch-scrolled `.view`s), so it painted during load then disappeared. Now canvas `z-index:0` + `main{position:relative;z-index:1}` (content above, canvas between body bg and content). Visibility: 40–85 particles (area/16000), alpha 0.12–0.38, r up to 2.6, **soft halo on motes r>1.7**, bottom glow 0.17. Robustness: `ensure()` single-loop manager restarted by `visibilitychange` + `pageshow` (bfcache restores don't fire visibilitychange) + `focus`. Nav/tabbar frost 0.92→0.84 so motes glow through. Auth screen (fixed z:999 opaque) covers it on login — fine.
- ✅ **Ambient particle background** (user idea: "dark ethereal vibe… light and dust particles radiating from the bottom"). IIFE at end of main script creates `#ambient-bg` canvas, `position:fixed;inset:0;z-index:-1;pointer-events:none` + CSS bottom radial glow (`rgba(37,99,235,0.10)` at 50% 108%). 26–54 motes (area-scaled), spawn at bottom, drift up slowly with sideways wander, sin-twinkle, `depth` fade (brighter near the bottom light source), 82% blue hue 208 / 18% teal 160, alpha ≤~0.22. Battery: pauses on `visibilitychange`, DPR capped at 2, `prefers-reduced-motion` → static single draw. Coach portal only (client portal replaces `document.body`). Pages are transparent so it shows everywhere cards aren't; nav/tabbar blur lets it glow through faintly.
- ✅ **Avatar rainbow fixed + modal safe-area.** (1) User: saturated per-client tiles made the roster "a big rainbow… like a Google doc" — `_avatarStyle` redesigned to **dark glassy tiles** (`#1b2330→#11151d` gradient) with the client hue as a WHISPER: `radial-gradient` tinted glint at the top-left corner (alpha 0.30), hue-tinted hairline border (0.22), **initials carry the color** (`hsl(h,60%,72%)`); golden-angle `_clientHue` kept underneath. (2) Client modal content started under the iOS status bar (the `.modal` drops from physical screen top under `viewport-fit=cover`) — `padding-top:calc(28px + env(safe-area-inset-top))`.
- ✅ **Visual phase 4 — "the factor" (user: app felt "very simple"): atmosphere + identity + life.** (1) **Atmosphere**: `.view` gets a fixed radial brand-blue glow bleeding from the top (`radial-gradient(620px 300px at 50% -110px,rgba(37,99,235,0.13),transparent)` — background sticks to the scroll container so it stays put); surface tokens lifted one shade (`--surface:#10161d`, `--surface2:#171d26`, `--surface3:#1d242f`) so cards read as material not outlines; dashboard stat numbers cast their color (`text-shadow:0 0 26px ${col}55`, hex cols only). (2) **Signature element**: `renderTodaySessions` rebuilt around a 64px **gradient progress ring** (SVG, `#todayRingGrad` #2563eb→#43d9a2, count centered, drop-shadow glow, animated dashoffset; all-done = solid green + ✓ state); old dots + thin bar removed; expand-list behavior unchanged. (3) **Life**: deterministic per-client avatars — `_clientHue(c)` hashes id into curated `_AVATAR_HUES` [212,262,291,340,12,32,160,187,225,145] (no muddy hues), `_avatarStyle(c,size)` gradient tile; dashboard rows 46px (was uniform blue), Clients grid rows 38px (was a bare tier dot — dot now sits beside the name). Palette/fonts/layout deliberately untouched.
- ✅ **Visual phases 3b–3e (the four-part "professional build" pass, all shipped).** (3b) **Client-modal Overview declutter**: package hero card = label + quiet "Renew ↻" text-action top-right + big number + start date + progress bar + ONE full-width "+ Log Session" (was a messy 3-button stack: primary/ghost/tiny Export); Export moved into the bottom utility row (Edit / Pause / Export equal-width); "Remove Client" demoted from full-width red button to a small dim "Remove client…" text link. (3c) **Emoji→monochrome sweep in chrome**: "📋 From Library"→text, "✨ Generate Next Program"→sparkle stroke-SVG, "✨ Next Program" header→text, "🔄 Regenerate"→"↻", "🔍 Review Demos"→text (×2 incl. toggle). Kept "moment" emoji (⚡ CTAs, 🏆 PBs, Crushed-it). (3d) **Skeletons**: `loadTemplates`/`loadRunPrograms` now show shimmer rows when their list is empty-loading (rest of app already had them). (3e) **Entrance motion**: `rowIn` keyframe + `_staggerIn(container,limit)` helper; dashboard alerts (limit 6) + dashboard client rows + Clients grid cascade in 26ms apart on FIRST render only (gates `_dashRowsAnimated`/`_clientGridAnimated`, skipped while searching so keystroke re-renders stay instant).
- ✅ **Visual phase 3a: native-app feel pass** (user goal: "professional app, not a website someone built"). CSS: `-webkit-tap-highlight-color:transparent` + `touch-action:manipulation` on body (no grey flash / no double-tap zoom), `user-select:none` on chrome (nav/tabbar/btns/badges), `button:active` scale(0.965), `@media (hover:none){div[onclick]:active{opacity:.72}}` = every tappable card dims like a native cell, `.view{overscroll-behavior-y:contain}`, `theme-color` meta. Dashboard alert emoji (⚠️/🔔) → stroke SVGs (`.alert-icon` now flex). Dashboard `stat-val` count-up on FIRST load only (`window._statsAnimated` gate). **Remaining phases discussed:** client-modal Overview declutter, emoji→SVG sweep in persistent chrome, consistent skeletons.
- ✅ **Gen-program exercise ORDER fixed** (user report: generated push day led with cable crossovers). Three-part fix in the generator: (1) `_exMechanic(name)` classifier — isolation name-cues (`_GEN_ISO_RE` fly/crossover/raise/curl/extension/…) override the dataset label (dataset tags some flyes "compound"!), then dataset mechanic, then `_GEN_COMP_RE`; `_genCandMech(e)` applies the same override to candidates. (2) `_altExerciseFor`: mechanic is now a **HARD pool filter** per slot (was only a +3 score bonus) with heuristic fallback when the original doesn't match the dataset — an unmatched original no longer makes the slot a free-for-all; lead slot = compounds-only unless the original deliberately led with an isolation. (3) `_genOrderDay(exs)` — final stable partition per generated day: compound units first, isolation after, SS groups move as one unit (compound if any member is); called at the end of `_buildGenProgram`. Validated offline vs the 873-exercise dataset (sloppy-ordered push/pull days → every trial leads with a real compound, flyes classify isolation).
- ✅ **iOS screenshot fixes (post bottom-tab-bar).** (1) Status bar overlapped the logo: `viewport-fit=cover` extends the page under the notch — `nav` height/padding now use `env(safe-area-inset-top)`, `main` padding-top matches, client-portal sticky header padded too. (2) "Weird grey square" bottom-center = the EMPTY toast peeking out (its hidden state was a fixed 100px translateY slide, no longer off-screen after the toast was lifted above the tab bar) — hidden state is now `opacity:0` + 24px drop + `pointer-events:none`; `.toast.show` restores opacity.
- ✅ **Coach nav → bottom tab bar (visual rework phase 2).** The top `.nav-tabs` (horizontally scrollable, hid tabs with no affordance) is REMOVED; coach portal now has `#coach-tabbar` (fixed bottom, 5 `.ctab` buttons: Home/Clients/Library/Programs/Business, icon over 10px Syne label, active = accent color only). Top `nav` slimmed to a 56px brand bar (logo + sign-out). Wiring: `showView` clears `.nav-tab,.ctab` (scrollIntoView dropped); swipe-view sync selector → `.ctab`; `showAuthScreen`/`hideAuthScreen` toggle the tabbar; `.view` bottom padding `calc(112px + env(safe-area-inset-bottom))`; toast lifted above the bar; viewport meta gained `viewport-fit=cover` (required for env() insets on iPhone). Client portal untouched (it replaces `document.body` so the coach bar never shows there).
- ✅ **FULL 3-AGENT AUDIT + fix sweep (23 findings, all verified & fixed or triaged).** Highest impact: (1) **ISO date filters on the TEXT `session_date` column were lexicographic no-ops** — PR-this-month badge, `renderMonthlyReport`, `renderBusinessView` ("Inactive 10+" never flagged anyone), and `openProgressReport` were all computing on ALL-TIME data; now fetch-all + client-side date bucketing (grep `lexicographic` for the four sites). (2) **Every portal save retry made idempotent** (program-day `_doPortalSave` two-stage `_sessSaved`/`_patchDone`; `_logRunSession` ×2 copies keyed `_runSaveState`; custom `_custSaveState` reset in `renderCustomWorkoutSheet`; coach `_coachSharedUpdated` separate flag) — retries could previously duplicate sessions, double-decrement remaining, double-advance run weeks. All client PATCHes now `r.ok`-checked. (3) **`saveEditSession` no longer DELETEs all logs for the date then re-inserts** (wiped other same-date sessions' logs; delete-then-fail lost logs) — now snapshot old ids → bulk POST new → DELETE `id=in.(...)`, worst case duplicates never loss. (4) **Portal Home calendar-strip workout tap was a ReferenceError** (closure-local `renderWorkoutCard` in inline onclick → `window._showPortalDay(i)`). (5) `_attr()`-escaped user data in edit-session/run-day/body-stat `value="…"` attrs. (6) Renew NaN guard + non-standard package sizes get an injected option. (7) Portal decrement rule aligned with coach (`pkg>0||remaining>0` — pay-per-session self-logs now charge). (8) Heatmap "month" divides by ELAPSED weeks not fixed 4.33. (9) Draft re-persisted after restore (was empty-overwritten by the deferred render). (10) Portal body-stat save failure now alerts. (11) Day-name fetches dropped `order=session_date.desc&limit=N` (alphabetical text sort under a limit returned wrong rows). **Known-accepted, NOT fixed:** absolute-value `remaining`/`exercise_history` writes can lose one update if coach + client log concurrently (architectural; needs server-side increment RPC); shared-package overuse past 0 is untracked/free; `_toggleSessions` dead code.
- ✅ **"From Library" on client page showed "No saved programs"** — `templates` only loaded on Programs-tab open; `openAssignFromLibrary` now fetches on demand (skeleton + silent refresh).
- ✅ **Visual declutter pass 1** (user wants sleek/modern/less cluttered, NO new data-density): neutral hairline `--border`/`--border2` (was blue-tinted everywhere), nav pill flattened (no border ring/inset), active-tab glow halved, alerts flat (bg + left accent only, no gradient/border), dashboard `mkStat` tiles calmed — one surface, color only in the number, warn/danger tiles muted when zero. **Next visual steps discussed:** per-screen declutter (client modal Overview, portal Home), consistent press states/skeletons; user will react on phone first.
- ✅ **"Last logged / X ago" date labels FIXED.** Dashboard cards (and client-portal "last done") computed relative time as `Math.floor(elapsedMs / 86400000)` — **elapsed 24h windows, not calendar days** — so a session logged yesterday evening read "Today" the next morning, and 2-days-ago read "Yesterday". New `_relDayLabel(x)` (accepts a Date or session) compares **local calendar days** via `_sessDayDate` (prefers the session's stored `date` string over the UTC `created_at` to avoid TZ drift). `Math.round` so DST 23/25h days don't misclassify. Replaced both coach call sites (`renderClientModal` card variants ~2124/2157) + portal `fmtAgo`.
- ✅ **Coach save reliability audit (income-critical).** Confirmed: (a) the session-history **list shows every session** from `c._sessions` (no date filter / dedup that could hide one), and (b) `showSuccessAnimation` fires **only after** the awaits succeed (seeing it = saved) — so a missing session means it was never submitted (forgot Complete, or a transient failure shown only as a fleeting toast). Hardening in `confirmLogSession`: **empty-session confirm guard**; side-effects guarded by `window._coachSessionSaved` / `window._coachClientUpdated` (reset in `openLogSession`) so a **Retry can't duplicate the session or double-decrement** the package; failure now turns the button into a persistent **red "↻ Save failed — Retry"** (modal stays open, data intact) instead of a transient toast. (Recommended next safeguard, not yet built: a dashboard "today: X logged / Y scheduled" so a miss is caught same-day, not at week's end.)
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
| `renderEditExerciseList()` / `_editExRowHtml` | ~3557 | program builder rows (grouped supersets, suggestion chip) |
| `addExerciseToDay` / `addSupersetToDay` / `addToSuperset` | ~2600 | one-at-a-time add + supersets (seed `prescription:''`, NOT `'3x10'`) |
| `_encodeEx` / `_parseExForEdit` | ~3862 | SS-prefix ⇄ `.ss` group marker (coalesces scattered same-tag pairs, demotes genuinely orphaned solo tags) |
| `_coalesceSsGroups` | ~3319 | shared self-healing regroup-by-tag helper — used by `_genOrderDay` AND `_parseExForEdit` so they can't diverge |
| `setupExDrag` / `_exBlocks` | ~4004 | superset-aware drag-reorder for the program editor (group handle moves whole pair; row handle only reorders within its group) |
| **Generate Next Program** | | |
| `generateNextProgram` / `_buildGenProgram` | ~3385 / ~3348 | entry point / builds `window._genProgram` (swap+reorder+resuggest) |
| `_altExerciseFor` / `_GEN_SWAP_GROUP` / `_exBaseMovement` | ~3277 | alternative-exercise search (muscle-group-broadened, movement-deduped) |
| `_genOrderDay` | ~3341 | compound-first ordering + orphaned-solo-superset demotion (coalesces first — see `_coalesceSsGroups`) |
| `editGenDayExercises` / `saveProgramDay`'s `'gen'` branch | ~3446 / grep `_editProgSaveMode==='gen'` | routes preview editing into the REAL `editProgramModal` |
| **Coaching Insights & Protocol Library** (new this session) | | |
| `computeCoachInsights()` / `openCoachInsightsDetail()` | ~2149 / ~3708 | dashboard card + tappable detail (client names, alt-exercise suggestions) |
| `_PROTOCOL_LIBRARY` / `openProtocolPicker()` | ~3611 / ~3666 | 17 schemes, 5 color-coded collapsible categories |
| `_prescSuggestionFor(clientId,name)` | ~3642 | shared suggestion helper — program builder chip AND generator both use this |
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

**Last Updated:** HEAD `531fdd1` — session that picked up the vanishing-supersets bug left open at the end of the prior session (needed TWO fixes to resolve it for Tim — see below), then added a "combine two existing exercises into a superset" action to the program-day editor at the user's request (see top session-log entry). Fix 1 (`cf00676`) addressed a real bug (superset-unaware drag-reorder + `removeEx()`) but didn't fix Tim's symptom; a screenshot from the user of Tim's day in the normal editor showed the real trigger — his data uses a legacy `"SS1 Name"` (no colon) tag format that every colon-requiring regex in the app silently failed on. Fix 2 (`dbf48af`) introduced a shared colon-optional `_SS_TAG_RE` and swapped it into ~30 call sites. See "Generate Next Program: supersets not surviving generation — RESOLVED" near the top of this doc for full detail. **User has not yet re-tested Tim's actual program on their phone since fix 2** — if it's still not resolved, get a fresh screenshot immediately rather than re-theorizing. **Standing instruction from the user this session:** push every fix/addition straight to `main` as it's shipped (no holding on a review branch) — they're checking along the way on their phone and will flag anything that needs reverting. **User's testing loop:** iPhone PWA, tests real client data (a client named "Tim" is the current test case for the generator), reports back with screenshots — implement, ship to main, they re-check on the phone.
