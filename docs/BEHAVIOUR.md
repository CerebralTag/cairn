# Screens and behaviour

What the app does and the rules it keeps. For how the data is shaped see
[DATA-MODEL.md](DATA-MODEL.md).

## Design rules (the user's decisions; do not break them)

- **No due dates, no "overdue", no backlog-by-age views.** Tasks are to do or done.
- **Never show failure.** Goal history is neutral: every period is a bar, a met period gets a check,
  and a period below target gets no mark (no red, no "missed").
- **Show what is done, never something to chase** (decided 2026-10-19): no badges, milestones, XP,
  levels, "next milestone", lifetime bars or empty placeholder beads.
- **Never show a zero** on the week screen: a goal reads just what is asked ("3h", "5") until
  something is done, then "45m of 3h".
- Prefer best stretches and running totals to streaks. Partial credit counts.
- **No units or measures.** An amount is a plain number ("10"), never "10 reps".
- **Areas are broad labels** (Home, Music), not granular (not "Woodshop"): the specific thing is a
  repeatable task or a goal.
- Every colour is a CSS variable ([src/index.css](../src/index.css)); the 7 area colours are validated
  for colour-blind separation, so keep their order and the maximum of 7.

## Navigation

A bottom bar with three items: **This week**, **History**, **Manage**. Phone width is limited, so do
not add tabs.

## This week (home)

Top to bottom:

1. **Overarching goal cards** (a segment per child goal).
2. **Header card**: a ring per area (see DATA-MODEL), then every goal for the week as one flat list.
   Colour is the only sign of a goal's area on its row; there are no area headers. Tap a ring to
   narrow the list to that area, tap again for everything. Under it, a bead per win finished this
   week (area coloured, grey if no area) with a caption "N wins this week · 9h logged".
3. **Running timer** card, when one is running.
4. **"I did something"**, then **one repeatable-task row**: `[task ▾] [✓ Log] [▶ Start]`, most-used
   first, "Something else…" last (it opens the plain form or the timer form). With no repeatable tasks
   the row is the plain "Start a timer" button plus a link to add some.
5. **This week's wins** (hidden until there is one; each shows its day and time, tap Edit to fix).
6. **Time by area · this week** (hidden until some time is logged; includes an Other bar).
7. **To do**: collapsed by default; the header has the open count, Show/Hide and **+ Add** (the add
   form works while collapsed); open, it has area filter chips (All, each area, No area).

### Tapping goals

- **A single-task goal** (just a name) completes with one tap (a logged win named after the goal,
  counted toward it); tapping a met one takes the latest such win back. Undo in the toast.
- **A time, amount or count goal** opens "I did something" filled in: the goal's name and areas, the
  goal ticked, the box on Time (Number for amount goals), the cursor in it.
- **A Routine** is untouched by those taps: its task bubbles do the logging. Tap one not yet done to
  log it (it asks how long first if the task is set to, or counts toward a time goal and has no
  minutes); tap a done one to take its latest log back. Each bubble takes its task's own area colour.
- Goals that count only to-dos finished or repeatable-task taps are not tappable (a plain win would
  not count).

## History

Week / Month / Year / Custom tabs: running totals, a calendar heatmap (tap a day for its detail), goal
history bars (neutral), time by area, and a **Full log** where any win or time entry can be edited
or deleted. Zero-minute days are neutral records and are left as they are.

## Manage

A segmented control: **Tasks / Goals / Areas / Backup**, with a Version card at the bottom of every tab.

- **Tasks**: a "Repeatable tasks" section (collapsed; add or edit templates; "Ask how long each time";
  a number with a Time/Number dropdown; tick the goals it counts toward), then sections Doing / To do /
  Done / Dropped with an area filter and a per-task menu (edit, +time, start/pause, drop, reopen,
  delete).
- **Goals**: add (type, period, what counts, areas, target), starter chips, move up/down, edit,
  archive. Types: Time, Count, Amount, **Routine** (with a "Track this routine" switch), Overarching.
- **Areas**: move up/down (this orders the rings), an On Today switch, edit (including "Goals in this
  area" checkboxes), remove, plus a fixed **Other** row (goals with no area) with its own switch.
- **Backup**: Export (Share sheet on iPhone, a download on a computer), Restore (validated import
  that replaces everything), and **Start over** (erase everything, for testing; Undo in a toast).
- **Version card**: shows the version and build time, where the app was served from, and which
  offline copy it holds. "Check for updates" compares with the live version; "Update to …" and
  "Reload fresh" fetch the newest copy (HOW: see HANDOFF.md).

## Forms

- Areas never tick goals; ticking a goal adds its areas (add-only).
- Time and a plain number share one optional box with a Time/Number dropdown (a to-do offers only
  the number).
- Typing a title suggests names used before (wins, tasks, timer titles, repeatable tasks, goal names);
  picking one fills in what you chose last time without overwriting anything already filled in.
  Suggestions are picked on a real tap, never on touchstart.
- Typed numbers go through `positiveNumber` ([src/limits.ts](../src/limits.ts)): finite, positive, at most 100,000.

## Phone and offline

An installable PWA (Add to Home Screen on iPhone), a 480px column with safe-area padding and
touch-sized targets. It works offline after first load. Two tabs stay in sync through the `storage`
event. The Year heatmap cells are too small to tap on a phone (known).
