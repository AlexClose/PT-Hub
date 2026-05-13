# PT-Hub Coaching App — Context & Status

## Project Overview
Single-file SPA at `/home/user/PT-Hub/index.html` (~3000 lines) for a personal training coaching platform. Two portals:
- **Coaching Portal** (`#coach-*`): Coach manages clients, logs sessions, views dashboards
- **Client Portal** (`#client-*`): Clients log workouts, view training programs

## Tech Stack
- Vanilla JS, no framework
- Supabase for backend (REST API via `sb()` function)
- Single HTML file with inline CSS and JS
- Git-based workflow on branch `claude/check-repo-connection-0JGIq`

## Key Data Model
**Clients table:**
- `id`, `first`, `last`, `email`, `age`, `level`, `duration`
- `package_size` (total sessions in package) — can be 0
- `remaining` (sessions left) — can be negative (means owed)
- `package_size=0 && remaining>0` means "pay per session but tracked" (common bug point)
- `remaining<0` means client owes money
- Shared packages: `shared_package_id` links to `shared_packages` table

## Recent Major Bug Fixes (This Session)

### Root Cause
When adding new UI (colored stat tiles), session display logic broke. The issue was in how `hasPkg` (does client have a package?) was calculated and how progress bars rendered.

### What Was Broken
1. **hasPkg logic**: Used `c.remaining > 0` which failed for negative remaining — Ali at -1 was invisible
2. **Progress bar at 0%**: When `package_size=0`, `displayTotal=0`, causing `pct = remaining/0 = NaN → 0%` — invisible bar
3. **Auto-decrement**: Only decremented for `package_size>0` clients, broke for package_size=0
4. **Missing denominator**: Clients without `package_size` couldn't show "X / Y" format

### What Was Fixed
**Commit history (latest first):**
- `0ed2b8b` — Show full red bar when sessions at 0 or negative (100% width in red when remaining ≤ 0)
- `22b6587` — Update package size dropdown to 8, 12, 16, 20, 24, 30
- `78b36e6` — Revert sessions-owed display
- `ca2ec68` — Show 'X session(s) owed' text (reverted)
- `3b001bd` — Merge conflicts keeping feature branch fixes
- `f99fc16` — Merge PR #38 (session count fixes to main)
- `196322d` — Progress bar scaling + auto-decrement for all clients
- `af7ed3d` — hasPkg fix for negative remaining

### Current State (Live)
**All three client types now display correctly:**
- `package_size=16, remaining=4` (Michael): Shows "4 / 16" + green bar at 25%
- `package_size=0, remaining=8` (Beth/Lissette): Shows "8 remaining" + orange/yellow bar at 80%
- `package_size=8, remaining=-1` (Ali): Shows "-1 / 8" + full red bar at 100%
- `package_size=0, remaining=0`: Shows "Pay per session", no bar

## Code Locations (Key Functions)

| Function | Line | Purpose |
|----------|------|---------|
| `renderDashboard()` | 1004 | Coach dashboard: filters, stats tiles |
| `clientRowHtml(c)` | 1044 | Coach client card: hasPkg, badge, bar logic |
| `renderClientModal(c)` | 1167 | Coach client detail modal: sessions display |
| `openLogSession()` | 1658 | Log workout form |
| `logWorkout()` | 1680 | **Auto-decrement here (line 1691)** |
| `renderDayPicker()` | ~830 | Client portal hero + weekly stats pill |
| `openWorkout()` | ~1800 | Client portal workout sheet |

## Critical Lines for Package/Remaining Logic

```javascript
// Line 1046: Coach card
const hasPkg = c.package_size>0 || !!c.remaining || !!sharedPkg;

// Line 1049: Coach card progress bar
const effectivePct = !hasPkg ? 0 : displayRemaining<=0 ? 100 : displayTotal>0 ? Math.min(displayRemaining/displayTotal*100, 100) : Math.min((displayRemaining||0)*10, 100);

// Line 1691: Auto-decrement on session log
let newRemaining=(c.package_size>0||(c.remaining||0)>0)?c.remaining-1:c.remaining;

// Line 1172: Modal progress bar
const pct=!hasPkg?0:displayRem<=0?100:displayTotal>0?Math.min(displayRem/displayTotal*100,100):Math.min((displayRem||0)*10,100);
```

**Key insight:** 
- `!!c.remaining` is truthy for any non-zero (positive OR negative)
- `displayRemaining<=0 ? 100` forces full red bar when out or owed
- Clients with `package_size=0` now use `remaining*10%` as scaled estimate for bar width

## Known Data Issues
- Some old clients have `package_size=0` when they should have a number — must be set manually via Edit
- Ali's data was at `remaining=-1, package_size=0` → now shows correctly as `-1 / 8` after manual edit

## Branch & Deployment
- Feature branch: `claude/check-repo-connection-0JGIq`
- All changes go here first, then PR to `main` (which is branch-protected)
- Main is auto-deployed (GitHub Pages or similar)
- Always resolve merge conflicts by keeping feature branch (HEAD) version

## Next Steps (If Any)
- Monitor for any remaining visual regressions
- Consider prompting users to set `package_size` when creating clients with `remaining>0`
- Could add validation in the edit form

## Git Workflow Reminder
```bash
# Always work on feature branch:
git checkout claude/check-repo-connection-0JGIq

# Commit when done:
git add index.html
git commit -m "Clear message"
git push -u origin claude/check-repo-connection-0JGIq

# Create PR via mcp__github__create_pull_request
# Merge via mcp__github__merge_pull_request (handles conflicts)
```

---
**Last Updated:** May 13, 2026 at session end after full session count/bar fixes
