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
export type AreaDef = { id: Area; name: string; colour: number }

export type WinStatus = 'todo' | 'doing' | 'done' | 'dropped'

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

export type GoalDef = {
  id: string
  title: string
  areas: Area[] // label and colour only; progress comes from explicit links
  kind: GoalKind
  targets: GoalTarget[]
  childIds?: string[] // set => overarching goal, met when ALL children are met (same period as it)
  period: GoalPeriod // how often the target repeats
  archivedAt?: Date // archived goals stop appearing, but their past periods keep their results
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
  uses: number
}

// A running timer. Only the start time is stored; elapsed time is always derived
// from it, so the timer is correct even if the app was closed or suspended.
export type ActiveTimer = {
  startedAt: Date
  title: string
  winId?: string // attached to this task, or standalone when absent
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
}
