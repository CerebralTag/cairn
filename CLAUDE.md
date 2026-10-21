# Project: feel-good task & goal tracker (working name: Cairn)

## What this app is
A personal tracker whose job is to make its user feel accomplished, not stressed.
The user does a lot but often feels unaccomplished; the app should show progress and a history of wins.

**Hard rules**
- No due dates, no "overdue", no backlog-by-age views. Tasks are just to do / done.
- Never show failure: goal history is *neutral* — every period is a bar, hits get a check, below-target periods get no mark (no red, no "missed").
- Prefer "best stretches" / running totals over streaks (streaks feel bad when broken).
- Partial credit counts (1h30 of a 2h goal = 75%, not a miss).
- **Show what's done, never something to chase** (the user's decision, 2026-10-19). The Today header shows one bead per win finished today (area-coloured, grey if no area). There are NO badges, milestones, XP, levels, "next milestone", lifetime bars or empty/hollow placeholder beads. The app tracks what you could be doing and lets you see what you've done.

## Data model (agreed; implemented in src/types.ts)
Links are all optional and independent; views are derived from them:
`Win/TimeEntry -> Goal -> Overarching goal`, `Win/TimeEntry -> Area` (directly too), `Goal -> Area` (label + colour).
- **Win** = task = win (one record). Status todo/doing/done/dropped. Pre-logged to-dos start `todo`; ad-hoc wins are created `done`. `completedAt` is the timestamp reports and count goals use. Links to many goals and many areas. No due dates.
- **TimeEntry**: the only place minutes live. Standalone or attached to a task (`winId`); an attached entry also counts toward its task's goals/areas (inherited, so fixing the task's links flows through). Sessions on a task show as "so far"; the task is one win when finished.
- **Goals**: target over a repeating period: **day, week or month** (fixed at creation, like the type). Overarching goals may only include goals with the same period. Kinds: time (sum of linked entries' minutes), count (linked wins finished in the period), completion (= count with target 1).
  - **What counts** (`GoalDef.source`, absent = `linked`): `linked` = only wins/time tagged to the goal; count goals may instead count `any` finished task, `todo` (origin to-do) or `quick` (quick-win taps); time goals may count `any` (all logged time). Rule-based goals are never offered for tagging. Wins carry `origin` (`todo` | `quick` | `logged`) and quick-win taps carry `quickWinId`.
  - Goals count what is **explicitly linked**, not what matches by area. Areas on a goal are label/colour only, so editing them never rewrites history. A new goal can backfill links by area.
  - **Overarching goals** are goals with `childIds`, met when **all** children are met; a goal may sit under several.
  - Period results are *calculated*, never stored. Goal target history (`targets[]` with effective-from dates) is kept so old periods use the target in effect then.
- **Archive, not delete**: archiving a goal hides it from Today and pickers and gives it no periods from that moment on, but every earlier period keeps its result (History still charts it, marked archived). Delete-for-good is only offered from the Archived list.
- **Timer**: only the start time is stored (`AppData.timer`), so elapsed time survives closing the app. Stopping saves a time entry that begins at the start time (minimum 1 minute), attached to a task or standalone; a toast offers Undo.
- **Back-dating and corrections**: ad-hoc wins and finished wins have a "when" (never in the future). History > Full log lists every win and time entry as its own row with Edit and Delete; deleting a task keeps its time as standalone entries.
- **Quick wins**: saved one-tap templates (title, areas, optional goal links, optional minutes, optional amount; `asksForMinutes`: tapping asks how long when the template is set to, or counts toward a time goal and has no minutes). Tapping one logs an ordinary finished win stamped now, shows a toast with what it counted toward, and offers Undo. Today shows the six most-used, with "More".
  - **"Each" goals** (`source: 'each'`, count kind): met when as many different repeatable tasks were done in the period as the target says. The target is the number of tasks tagged to the goal and is kept in the normal `targets[]` history: `syncEachGoals` records the new number from the current period on whenever a task is tagged, untagged or removed, so past periods are never rewritten. What was done comes from finished wins that carry the goal id and a `quickWinId`. Offered only in the repeatable-task form (`isTemplateLinkable`); an each goal with no tasks yet is ignored by overarching goals.
  - **Areas are optional**: a new start has none and forms show no area chips until some are added under Manage.
  - **Forms**: areas never tick goals; ticking a goal adds its areas (add-only). Time and a plain number share one optional box with a Time/Number dropdown (a to-do offers only the number).
  - **Vocabulary (the user's decision, 2026-10-19)**: a *task* is any win record. A *to-do* is a planned task (origin `todo`); a *repeatable task* is a saved template you do again and again (code name `QuickWin`, origin `quick`; the UI says "repeatable task"); a *win* is a finished task. A repeatable task may set `askMinutes` (tap asks how long, saved as time on the win), and Today's ▶ beside it starts a timer (`ActiveTimer.quickWinId`) that logs the win with the measured time when stopped.
- **Amount** (the user's decision, 2026-10-19: NO units or measures): a win or task may carry a plain number `amount` ("10"); it is shown as just the number next to the title. An *amount* goal ("100 per week") adds up the amounts of the finished wins **linked** to it in the period (a linked win with no amount counts as 1), exactly like the other goal kinds count linked wins. There is no matching by unit.
- **Fixing entries after the fact**: results are always recalculated from each entry's links, so adding an area/goal/amount to a win changes the current week AND any past week it belongs to. Today's list and beads let a win or standalone time entry be edited/deleted in place. Editing a quick win offers to add the template's areas, goals and amount to earlier wins with the same name (this week or all; adds only, never removes; Undo available). Name matching ignores case, accents, spacing and punctuation (`nameKey` in src/suggest.ts); titles are stored and shown as typed.
- **Today's goals** (src/todayAreas.ts, components/AreaRings.tsx): EVERY active goal for the period shows in one flat list, whether or not its area has a ring or it has an area at all. Colour is the only sign of a goal's area on its row (first area that exists; neutral grey for none); there are no area headers. Above the list, one ring per area that is switched on (`AreaDef.onToday`, absent = on; switch in Manage > Areas) summarises it: fill = average progress of the area's goals and open/this-week to-dos, middle = done/total (an empty area is a full ring reading 0/0). Tap a ring to narrow the list to that area (its to-dos are listed by name, ✓ when done); tap again for everything. Goals with no area feed an "Other" ("Goals" if no areas exist) ring, which has its own fixed, undeletable row in Manage > Areas with an On Today switch (`AppData.otherOnToday`, false = hidden); that switch only affects the ring, never whether the goals show. A goal row is a name only (a single task), a bar (time/amount/big counts), bubbles (counts up to 6), or a labelled bubble per task (each-goals; tapping a task not yet done logs it, asking how long first if that repeatable task is set to; tapping a done one takes its latest log back, with Undo in the toast). Today also shows "Time by area · this week" above the to-do list once some time is logged. Overarching goals keep their own cards above.
- **Filing goals under areas**: besides ticking areas on a goal, an area's edit form (Manage > Areas) has "Goals in this area" checkboxes (`setAreaGoals`, add/remove that area only). The goal list shows each goal's areas, and the "Other" ring says its goals have no area yet.
- **Name suggestions**: as you type a title (win, task, timer) the dialog suggests names used before (wins, tasks, timer titles, quick wins, active goal names). Picking one fills in what you chose last time (areas, goals, amount) without overwriting anything already filled in; a name equal to an active goal's name ticks that goal. See src/suggest.ts.
- **Areas**: user-managed data (name + palette slot 1-7), seeded with Music, Health, Work, Learning, Home. Palette in CSS is validated for colour-blind separation: keep the order, max 7.
- By-area totals credit a record to every one of its effective areas (bars can exceed the total); records with no area are not charted.

## Screens
Bottom nav is three items: **Today, History, Manage** (phone width is limited; do not add more tabs).
- **Today (home)**: overarching goal card (segment per child goal) + goal rings (each says today / this week / this month), running timer, "I did something" (with back-dating and an optional amount), start-a-timer, one repeatable-task row (`[task ▾] [✓ Log] [▶ Start]`, most-used first, "Something else…" last; without repeatable tasks the plain "Start a timer" button), today's wins/progress (the wins section is hidden when there are none), quick to-do list with a link to all tasks. First run starts with no goals and a gentle prompt.
- **History**: Week / Month / Year / Custom tabs, running totals, calendar heatmap (tap a day for its detail), goal history bars, time by area, and a Full log (edit/delete any entry).
- **Manage**: segmented Tasks / Goals / Areas / Backup (Backup also has "Start over": erase everything for testing, with Undo). Tasks: sections Doing / To do / Done / Dropped, area filter, per-task actions behind a menu (edit, +time, start/pause, drop, reopen, delete).

## Data safety rules (keep these true)
- **Never write data the loader would refuse.** `saveData` goes through `serializeChecked`, which round-trips the text and refuses (with a calm on-screen notice) rather than store something unreadable. `deserialize` validates every field of every record, plus unique ids and no overarching-goal cycles. If stored data is unreadable the app shows the recovery screen and never saves over it.
- If a save fails (storage full), the screen rolls back to the last saved data and shows a calm notice, so what you see is always what is stored.
- Suggestions are picked on a real tap (`click`), never on touchstart (a scroll must not pick). Area backfill never links a win without an amount to an amount goal.
- `scripts/deploy.sh` refuses roots/home/shallow folders and folders without a `.cairn-site` marker (first deploy needs `CAIRN_INIT=1`), previews and asks first, and caps deletions at 200.
- Typed numbers go through `positiveNumber` (src/limits.ts): finite, positive, at most 100,000.
- Backups exclude the running timer; importing keeps a running timer.
- Two tabs sync through the `storage` event; the save effect skips the write that follows adopting another tab's data.
- The service worker precache list and cache name are generated at build time (vite.config.ts); matches ignore `Vary`. Run `npm run test:tz` when touching date logic (suite passes in several time zones).
- There are no existing exports, and legacy saved data does not matter: the old-format migration code is kept but not maintained or tested further.

## Stack
- Vite + React + TypeScript, installable web app (PWA) for iPhone + laptop.
- Data: Postgres via Supabase (later). Charts: an established charting library.
- ESLint. Local git repo; GitHub later.
- **Theming**: every colour is a CSS variable from day one (palette swappable, dark mode later, per-area colours).

## How to work (important)
- **Priority is a working app the user actually uses**, not teaching the code. **Claude writes the code**, in small commits the user can follow.
- Walk the user through the parts worth understanding: data model, goal math, the reporting layer, and async/data-saving. Skip React plumbing unless asked. Short notes, not lectures.
- Keep answers short and direct.
- Personal working notes about the user are kept outside this repo (in Claude's per-project memory), not in this file.

## Build plan
1. ✅ Setup (Vite react-ts scaffold, first commit)
2. ✅ Home screen as React components + "JavaScript for C# developers" primer; CSS variables for theme
3. ✅ Logging wins: state, forms, data types
4. ✅ (browser storage) / Supabase still to do: saving data
5. ✅ Goal math: progress, partial credit, overarching goals (pure TS, add tests)
6. ✅ History & reports: date ranges, totals, charts
7. Install on phone (PWA) + phone layout + JSON export/import backup
8. ✅ Goals UI, Manage tab (tasks/goals/areas), linked data model
9. ✅ JSON backup (export via Share sheet / download, validated import), persistent-storage request
10. ✅ PWA: manifest, icons, hand-written service worker (offline), iOS meta tags, safe-area + touch-target CSS. **Still to do: host over HTTPS** (needed to install on iPhone), then try "Add to Home Screen" on the real phone.
11. ✅ Quick wins + amount goals
12. ✅ Back-dating, full log with edit/delete, timer, day/week/month goals, archive, overarching card, amount on wins, name suggestions
13. ✅ Independent QA (two rounds with a separate Opus reviewer), fixes, recovery screen, year heatmap scroll; NAS files in deploy/ (nothing hosted yet)
14. Host: self-hosting on a NAS or a static host such as GitHub Pages is under consideration (needs HTTPS the iPhone trusts), then real-iPhone testing

## Future work / ideas
- **Deferred**: tasks with a quantity target (e.g. "Do 50 squats") that quick wins fill in; pin favourite quick wins; dark mode; code-splitting.

- **Phone layout**: first pass done (480px column, safe-area padding, 44px-ish touch targets). Not yet verified on a real iPhone; the Year heatmap cells are too small to tap.
- Dark mode not started.

## Decisions (2026-10-18)
- **iPhone-first PWA, no cross-device sync for now.** Data stays in browser storage on the phone; Supabase deferred (the async `src/storage.ts` is the seam to swap later).
- **Backup**: manual JSON export (Share sheet -> Files/iCloud Drive) and import (file picker), plus a gentle, non-nagging "last backed up" note (never "overdue"). iOS web apps cannot write to Files directly (no File System Access API); iCloud-backup of PWA storage is unverified; iOS may evict storage. Request persistent storage at startup.
- If automatic backup is wanted later: one-way Supabase backup (not a native wrapper).

## Commits
- End commit messages with `Assisted-by: Claude:<model-id>` (not `Co-Authored-By`). Don't add a "Generated with Claude Code" line to PRs.
