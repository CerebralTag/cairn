# Data model and goal math

Everything here lives in [src/types.ts](../src/types.ts) and the pure modules next to it. Results
(progress, rings, history) are **always calculated** from the stored records; they are never stored.

## Vocabulary

| Word | Meaning | In code |
|---|---|---|
| **Task** | Any win record, whatever state it is in | `Win` |
| **To-do** | A planned task you finish later | `Win` with `origin: 'todo'` |
| **Repeatable task** | A saved template you do again and again; one tap logs a win | `QuickWin` (the UI never says "quick win") |
| **Win** | A finished task | `Win` with `status: 'done'` |
| **Area** | A broad label with a colour (Music, Home...) | `AreaDef` |
| **Goal** | A target over a repeating period | `GoalDef` |
| **Routine** | A goal made of repeatable tasks (a "Chores" goal) | `GoalDef` with `source: 'each'` |

## How things link

Links are all optional and independent; views are derived from them.

```
Win / TimeEntry -> Goal -> Overarching goal
Win / TimeEntry -> Area            (directly, too)
Goal            -> Area            (label and colour only)
```

A goal counts what is **explicitly linked to it** (or what its rule counts, below). An area on a
goal never makes entries count toward it, so editing areas never rewrites history.

## Records

- **Win** (a task is a win; one record). `status` is `todo`, `doing`, `done` or `dropped`.
  `completedAt` is the time reports and count goals use. It links to many goals and many areas
  (`goalIds`, `areas`) and may carry a plain number `amount`. `origin` says how it was made:
  `todo` (planned first), `quick` (tapped from a repeatable task; `quickWinId` says which) or
  `logged` (ad hoc, created already done). There are **no due dates anywhere**.
- **TimeEntry** is the only place minutes live. Standalone, or attached to a task (`winId`); an
  attached entry also counts toward the task's goals and areas (inherited, so fixing the task's
  links flows through). Sessions on an open task show as "so far".
- **GoalDef**
  - `kind`: `time` (minutes), `count`, `amount` (sums win amounts) or `completion` (a count of 1).
  - `period`: `day`, `week` (Monday start) or `month`. Fixed at creation, like the kind.
  - `targets[]`: the target with the date it took effect, so past periods use the target that was in
    force then. Editing a target adds a row from the current period on.
  - `source` (absent = `linked`): what counts. `linked` = only wins and time tagged to the goal.
    Count goals may count `any` finished task, `todo` (to-dos finished), `quick` (repeatable-task
    taps) or `each` (a Routine); time goals may count `any` (all logged time). Only `linked` and
    `each` goals can be tagged to; the loader refuses rule and kind combinations the app never makes.
  - `childIds`: an **overarching** goal, met when **all** children are met. Children must share its
    period; a goal may sit under several; cycles are refused by the loader.
  - `archivedAt`: archived goals vanish from Today and the pickers and get no periods from then on,
    but every earlier period keeps its result. Delete-for-good is offered only from Archived.
  - `tracked: false` (Routines only, stored only as `false`): a container; see Routines.
  - `areas`: label and colour; a goal may be in several areas.
- **AreaDef**: `{ id, name, colour (palette slot 1-7), onToday? }`. `onToday: false` hides its ring.
  New installs start with Music, Health, Work, Learning and Home (`DEFAULT_AREAS`).
- **QuickWin** (repeatable task): title, areas, `goalIds`, optional `minutes`, optional `amount`,
  `askMinutes`, and `uses` (for ordering). See `asksForMinutes` in
  [src/quickWins.ts](../src/quickWins.ts): a tap asks how long when the task is set to, or counts toward
  a time goal and has no minutes of its own.
- **ActiveTimer**: only `startedAt` is stored, so elapsed time survives closing the app. Stopping
  saves a time entry beginning at the start time (at least 1 minute). A timer started from a
  repeatable task (`quickWinId`) logs a win from it, with the measured time attached.
- **AppData** holds all of the above plus `otherOnToday` (false hides the "Other" ring).

## Goal math ([src/goals.ts](../src/goals.ts))

`progressFor(goal, data, periodStart)` returns `{ done, target, fraction, met }`.

- **Linked time/count/amount**: counts the linked entries or finished wins in the period (a linked
  win with no amount counts as 1 toward an amount goal). Partial credit counts: 1h30 of 2h is 75%.
- **Rule goals** count by their rule and need no tagging.
- **Overarching**: the children's progress; met only when every child is met. A Routine with no
  tasks yet is ignored so it cannot hold the rest back.
- **Routine ("each") goals**: met when as many tasks are complete as the target says. A task is
  complete when it has had what it needs, read from **the task itself** (`eachNeed`): its minutes
  if it has them (the minutes logged on its taps in the period reach it), else its number if that is
  2 or more (that many taps), else once. The target is how many tasks are tagged; `syncEachGoals`
  records the new number in `targets[]` from the current period on whenever a task is tagged,
  untagged or removed, so past periods keep theirs. What was done comes from finished wins that
  carry the goal id and a `quickWinId`; a task since removed still counts once, so a past hit is never
  erased. Caveat: a task's requirement is read as it is now, so editing it changes how past weeks look.
  - **Tracked** (default): it has areas, feeds their rings, shows in History and "x of y".
  - **Container** (`tracked: false`): no areas, no ring, no history, never offered to overarching
    goals or to area filing, no toast line, no count or tick. Today shows only its name and its
    tasks' bubbles.
- **Backfill**: a new goal can link existing entries in its areas (an opt-in checkbox, off by
  default). An amount goal only takes wins that have an amount.

## Areas, rings and the week screen ([src/todayAreas.ts](../src/todayAreas.ts))

- **Effective areas**: a win's own areas plus those of its goals; a time entry's own, its goals' and
  its task's. By-area totals credit a record to every one of them (bars can exceed the total).
  Records with no area at all are credited to a catch-all **Other** (`OTHER_AREA`), shown last.
- **Ring order** is the order of `AppData.areas`. **Goal order on Today** is by area group (in area
  order, goals with several areas by the earliest), then as arranged within the group; overarching
  goals first, goals with no area last ([src/order.ts](../src/order.ts)). Manage has up/down arrows for both.
- **A ring per area switched on**: inner ring = average progress of the area's goals; the middle
  shows the number of goals while none is met, `1/2` once some are, a tick when all are (an area
  with no goals is a tick). **Rings count goals only, never to-dos.** Goals with no area feed an
  "Other" ring ("Goals" if no areas exist) with its own switch in Manage.
- **Outer ring** (`areaExtra`): this week's extra effort in the area outside its goals: time on
  things in the area that no goal of it counted (a lap per `EXTRA_LAP_MINUTES` = 240), plus each
  finished win in the area outside its goals (worth what one goal of the area is worth on the inner
  ring, a quarter if it has none). A win a rule goal of the area already counts is not extra. A thin
  light first lap, then a bolder second lap; nothing is drawn until there is some.
- **Never shows a zero**: a goal row reads just what is asked ("3h", "5", "2 goals") until something
  is done (`todayLabel`); `ringCentre` follows the same rule.
- **Row kinds** (`goalDisplay`): a name only (a single task), a bar (time, amount, big counts),
  bubbles (counts up to `MAX_BUBBLES` = 6), or a labelled ring-bubble per task (Routines).

## Edits and undo

Every action that changes data offers Undo in a toast. The pure functions that make the changes also
return what is needed to reverse them: `undoQuickWin`, `removeTap` (take back the latest tap of a
repeatable task), `uncompleteGoal` (take back a single-task goal), `revertTemplateApplication`.
Editing a repeatable task offers to add its areas, goals and amount to earlier wins with the same name
(adds only, never removes). Name matching (`nameKey` in [src/suggest.ts](../src/suggest.ts)) ignores case,
accents, spacing and punctuation but keeps symbols, so `C++`, `C#` and `C` stay distinct.

## Storage and safety ([src/serialize.ts](../src/serialize.ts), [src/storage.ts](../src/storage.ts))

- Data lives in the browser's `localStorage`, key `cairn.data` (JSON, `DATA_VERSION` 2); the last
  backup time is `cairn.lastBackup`. **The web address owns the data**: another address starts
  empty (export a backup, import it there).
- `deserialize` validates every field of every record, unique ids, and no overarching cycles.
  `serializeChecked` round-trips before saving and refuses to store anything the loader would reject.
  Adding a field means adding its check there and a round-trip test.
- A backup is that same JSON plus `app` and `exportedAt`; it excludes the running timer, and
  importing keeps a timer that is running.
