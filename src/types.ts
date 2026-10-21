// Domain types. `type` is like a C# record/interface: it only exists at compile
// time and describes the shape of plain objects. See CLAUDE.md for the data model.
//
//   Win / TimeEntry --(many)--> Goal --(many)--> Overarching goal
//   Win / TimeEntry --(many)--> Area   (directly, as well as via goals)
//   Goal            --(many)--> Area   (label and colour)
//
// All links are optional and independent; views are derived from the links.

// An area's id. Areas are user-managed data (see AreaDef), so this is a plain string.
export type Area = string

// Label + colour used for grouping. `colour` is a palette slot (1-7) rather than
// a hex value, so the whole palette can be swapped or themed from CSS alone.
// `onToday: false` takes the area off Today's rings; absent means it gets one.
export type AreaDef = { id: Area; name: string; colour: number; onToday?: boolean }

export type WinStatus = 'todo' | 'doing' | 'done' | 'dropped'

// How a task came to exist. Tasks are one kind of object; this says which way it was made:
//  - 'todo':   planned first as a to-do, then worked and finished (one-off)
//  - 'quick':  tapped from a quick-win template (repeatable); `quickWinId` says which one
//  - 'logged': recorded already done with "I did something" (one-off)
// Tasks saved before this existed have no origin; they count as "anything I finish" only.
export type WinOrigin = 'todo' | 'quick' | 'logged'

// "Task" and "win" are one record. A pre-logged to-do starts as 'todo' with no
// completedAt; an ad-hoc win is created already 'done'. `completedAt` is the
// timestamp History and count goals use.
export type Win = {
  id: string
  title: string
  status: WinStatus
  createdAt: Date
  completedAt?: Date
  goalIds: string[]
  areas: Area[] // direct areas; the effective areas also include those of its goals
  // How much, as a plain number ("10"). No unit: the title says what it was. An amount
  // goal that this win is linked to adds the amounts up (a win with none counts as 1).
  amount?: number
  origin?: WinOrigin
  quickWinId?: string // the quick win this was tapped from, when origin is 'quick'
}

// The only place minutes live. Attached to a task (winId) or standalone.
// An entry attached to a task also counts toward that task's goals and areas.
export type TimeEntry = {
  id: string
  at: Date
  minutes: number
  title?: string // for standalone entries ("practising")
  winId?: string
  goalIds: string[]
  areas: Area[]
}

export type GoalPeriod = 'day' | 'week' | 'month'

export type GoalKind = 'time' | 'count' | 'completion' | 'amount'

// A target in effect from a given date. A goal keeps a list of these so old
// periods are judged against the target that applied then.
// `amount` is minutes for time goals, the summed amount for amount goals, and
// number of completed wins otherwise.
export type GoalTarget = { from: Date; amount: number }

// What a goal counts. 'linked' (the default) counts only what you have tagged to the goal.
// The others are rules that count automatically, with nothing to tag:
//  - 'any':   count goals: every finished task; time goals: all time logged
//  - 'todo':  count goals: every to-do you finish
//  - 'quick': count goals: every quick-win tap
export type GoalSource = 'linked' | 'any' | 'todo' | 'quick' | 'each'

export type GoalDef = {
  id: string
  title: string
  areas: Area[] // label and colour only; progress comes from explicit links
  kind: GoalKind
  targets: GoalTarget[]
  childIds?: string[] // set => overarching goal, met when ALL children are met (same period as it)
  period: GoalPeriod // how often the target repeats
  archivedAt?: Date // archived goals stop appearing, but their past periods keep their results
  source?: GoalSource // what counts toward it; absent means 'linked'
}

// Calculated from entries, never stored.
export type GoalProgress = {
  done: number // raw amount achieved (can exceed target)
  target: number
  fraction: number // 0..1, capped: partial credit, 90 of 120 min = 0.75
  met: boolean
}

// A one-tap template for a win. Tapping it logs a normal win stamped with the
// current time. `uses` drives which ones are shown first on Today.
export type QuickWin = {
  id: string
  title: string
  areas: Area[]
  goalIds: string[] // optional fixed links
  minutes?: number
  amount?: number
  askMinutes?: boolean // ask how long each time it is tapped
  uses: number
}

// A running timer. Only the start time is stored; elapsed time is always derived
// from it, so the timer is correct even if the app was closed or suspended.
export type ActiveTimer = {
  startedAt: Date
  title: string
  winId?: string // attached to this task, or standalone when absent
  quickWinId?: string // started from this repeatable task: stopping logs a win from it, with the time
  areas: Area[]
  goalIds: string[]
}

export type AppData = {
  timer: ActiveTimer | null
  areas: AreaDef[]
  quickWins: QuickWin[]
  goals: GoalDef[]
  wins: Win[]
  timeEntries: TimeEntry[]
  otherOnToday?: boolean // false hides the "Other" ring (goals with no area) on Today; absent means shown
}
