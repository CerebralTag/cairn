// Goal math. Pure functions: data in, result out, no React, no storage.
// Period results are always calculated from entries, never stored.
import type { Area, AppData, GoalDef, GoalPeriod, GoalProgress, GoalSource, QuickWin, TimeEntry, Win } from './types'

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// Midnight (local time) at the start of the week containing `date`.
// weekStartsOn: 0 = Sunday, 1 = Monday.
export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysSinceStart = (day.getDay() - weekStartsOn + 7) % 7
  return addDays(day, -daysSinceStart)
}

// The start of the period (day, week or month) that contains `date`.
export function periodStartFor(period: GoalPeriod, date: Date): Date {
  if (period === 'day') return startOfDay(date)
  if (period === 'month') return startOfMonth(date)
  return startOfWeek(date)
}

// The start of the NEXT period, which is also the exclusive end of this one.
export function periodEnd(period: GoalPeriod, start: Date): Date {
  if (period === 'day') return addDays(start, 1)
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 1)
  return addDays(start, 7)
}

export const PERIOD_WORDS: Record<GoalPeriod, { per: string; this: string }> = {
  day: { per: 'per day', this: 'today' },
  week: { per: 'per week', this: 'this week' },
  month: { per: 'per month', this: 'this month' },
}

export function isActive(goal: GoalDef): boolean {
  return goal.archivedAt === undefined
}

export function goalSource(goal: GoalDef): GoalSource {
  return goal.source ?? 'linked'
}

// A goal you tag things to. Goals that count by a rule need no tags, so they are not
// offered in the "Counts toward" lists, and overarching goals only combine other goals.
export function isLinkable(goal: GoalDef): boolean {
  return !goal.childIds && isActive(goal) && goalSource(goal) === 'linked'
}

// A goal repeatable tasks can be tagged to: the plain "linked" goals, and "each" goals,
// which are met when every repeatable task tagged to them has been done.
export function isTemplateLinkable(goal: GoalDef): boolean {
  return !goal.childIds && isActive(goal) && (goalSource(goal) === 'linked' || goalSource(goal) === 'each')
}

// The repeatable tasks an "each" goal is made of (those tagged to it right now).
export function taggedTemplates(goal: GoalDef, data: AppData): QuickWin[] {
  return data.quickWins.filter((q) => q.goalIds.includes(goal.id))
}

// How many times a tagged task must be done per period for an "each" goal (1 unless set).
export function timesFor(goal: GoalDef, quickWinId: string): number {
  return Math.max(1, goal.stepTimes?.[quickWinId] ?? 1)
}

// The tagged repeatable tasks of an "each" goal: how often each was done in the period starting
// at `periodStart`, how often it must be, and whether that is enough.
export type EachStep = { id: string; title: string; count: number; times: number; done: boolean }

export function eachSteps(goal: GoalDef, data: AppData, periodStart: Date): EachStep[] {
  const start = periodStart.getTime()
  const end = periodEnd(goal.period, periodStart).getTime()
  const counts = eachCounts(goal, data, start, end)
  return taggedTemplates(goal, data).map((q) => {
    const count = counts.get(q.id) ?? 0
    const times = timesFor(goal, q.id)
    return { id: q.id, title: q.title, count, times, done: count >= times }
  })
}

// How often each repeatable task was done in [start, end) toward an "each" goal: finished wins
// carrying the goal's id (copied from the task when it was tapped, so this stays true even if
// the task is later renamed, untagged or removed).
function eachCounts(goal: GoalDef, data: AppData, start: number, end: number): Map<string, number> {
  const counts = new Map<string, number>()
  for (const w of data.wins) {
    if (w.status !== 'done' || !w.completedAt || !w.quickWinId || !w.goalIds.includes(goal.id)) continue
    if (w.completedAt.getTime() >= start && w.completedAt.getTime() < end) counts.set(w.quickWinId, (counts.get(w.quickWinId) ?? 0) + 1)
  }
  return counts
}

// What an "each" goal's target should be right now: the times its tagged tasks are each needed.
function eachTarget(goal: GoalDef, data: AppData): number {
  return taggedTemplates(goal, data).reduce((sum, q) => sum + timesFor(goal, q.id), 0)
}

// "Each" goals take their target from their tagged tasks (and how often each is needed). Whenever
// that changes, record the new number from the current period on, so earlier periods keep the
// target they had.
export function syncEachGoals(data: AppData, now: Date): AppData {
  let changed = false
  const goals = data.goals.map((g) => {
    if (g.childIds || !isActive(g) || goalSource(g) !== 'each') return g
    const count = eachTarget(g, data)
    if (g.targets.length > 0 && currentTarget(g, now) === count) return g
    changed = true
    return withTarget(g, count, now)
  })
  return changed ? { ...data, goals } : data
}

// The target in effect for the period starting at `periodStart`: the latest
// target whose `from` is on or before it. undefined if the goal didn't exist yet.
export function targetFor(goal: GoalDef, periodStart: Date): number | undefined {
  const inOrder = [...goal.targets].sort((a, b) => a.from.getTime() - b.from.getTime())
  let amount: number | undefined
  for (const t of inOrder) {
    if (t.from.getTime() <= periodStart.getTime()) amount = t.amount
  }
  return amount
}

// The target for the current period (0 if the goal has none yet).
export function currentTarget(goal: GoalDef, now: Date): number {
  return targetFor(goal, periodStartFor(goal.period, now)) ?? 0
}

// Change a goal's target from the current period onward. Earlier periods keep
// the target they had (that's the point of the history list). Editing again in
// the same period replaces that period's entry instead of stacking duplicates.
export function withTarget(goal: GoalDef, amount: number, now: Date): GoalDef {
  const from = periodStartFor(goal.period, now)
  const others = goal.targets.filter((t) => t.from.getTime() !== from.getTime())
  return { ...goal, targets: [...others, { from, amount }] }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

export function winsById(wins: Win[]): Map<string, Win> {
  return new Map(wins.map((w) => [w.id, w]))
}

// Goals a time entry counts toward: its own links plus its task's links.
// The task's links are stored once, so fixing them later flows through to its sessions.
export function entryGoalIds(entry: TimeEntry, byId: Map<string, Win>): string[] {
  const task = entry.winId ? byId.get(entry.winId) : undefined
  return task ? unique([...entry.goalIds, ...task.goalIds]) : entry.goalIds
}

function areasOfGoals(goalIds: string[], goals: GoalDef[]): Area[] {
  return goals.filter((g) => goalIds.includes(g.id)).flatMap((g) => g.areas)
}

// Effective areas of a win: its own plus those of its goals.
export function winAreas(win: Win, goals: GoalDef[]): Area[] {
  return unique([...win.areas, ...areasOfGoals(win.goalIds, goals)])
}

// Effective areas of a time entry: its own, its goals', and its task's.
export function entryAreas(entry: TimeEntry, byId: Map<string, Win>, goals: GoalDef[]): Area[] {
  const task = entry.winId ? byId.get(entry.winId) : undefined
  return unique([
    ...entry.areas,
    ...areasOfGoals(entry.goalIds, goals),
    ...(task ? winAreas(task, goals) : []),
  ])
}

// From the moment a goal is archived, later periods no longer exist for it.
// Periods that began before then keep their results.
export function archivedBefore(goal: GoalDef, periodStart: Date): boolean {
  return goal.archivedAt !== undefined && periodStart.getTime() >= goal.archivedAt.getTime()
}

// The child goals that count toward an overarching goal in the period starting at
// `periodStart`. Used by both the progress math and the card on Today, so the two
// can never disagree about what is being counted.
export function childrenFor(goal: GoalDef, allGoals: GoalDef[], periodStart: Date): GoalDef[] {
  return (goal.childIds ?? [])
    .map((id) => allGoals.find((g) => g.id === id))
    .filter((g): g is GoalDef => g !== undefined && !archivedBefore(g, periodStart))
}

// Whether a finished win counts toward a count/amount goal under that goal's rule.
export function countsToward(goal: GoalDef, win: Win): boolean {
  switch (goalSource(goal)) {
    case 'any':
      return true
    case 'todo':
      return win.origin === 'todo'
    case 'quick':
      return win.origin === 'quick'
    default:
      return win.goalIds.includes(goal.id)
  }
}

// Progress for the period (of the goal's own length) starting at `periodStart`.
export function progressFor(goal: GoalDef, data: AppData, periodStart: Date): GoalProgress {
  if (archivedBefore(goal, periodStart)) return { done: 0, target: 0, fraction: 0, met: false }

  if (goal.childIds && goal.childIds.length > 0) {
    const children = childrenFor(goal, data.goals, periodStart)
    // An "each" goal with no tasks tagged yet has nothing to meet, so it must not hold the rest back.
    const results = children
      .map((c) => ({ c, p: progressFor(c, data, periodStart) }))
      .filter(({ c, p }) => !(goalSource(c) === 'each' && p.target === 0))
      .map(({ p }) => p)
    return {
      done: results.filter((r) => r.met).length,
      target: results.length,
      fraction: results.length === 0 ? 0 : results.reduce((sum, r) => sum + r.fraction, 0) / results.length,
      met: results.length > 0 && results.every((r) => r.met),
    }
  }

  const target = targetFor(goal, periodStart) ?? 0
  const start = periodStart.getTime()
  const end = periodEnd(goal.period, periodStart).getTime()
  const inPeriod = (d: Date) => d.getTime() >= start && d.getTime() < end

  const source = goalSource(goal)
  let done: number
  if (source === 'each') {
    // Each tagged task counts up to the number of times it is needed; a task since removed or
    // untagged counts once, so a past hit is never erased. The target is the total needed at the
    // time (kept in the target history by syncEachGoals), and what was done comes from the wins
    // themselves, so changing the tasks later never rewrites a past period.
    const counts = eachCounts(goal, data, start, end)
    const tagged = new Set(taggedTemplates(goal, data).map((q) => q.id))
    let eachDone = 0
    for (const [id, count] of counts) eachDone += Math.min(count, tagged.has(id) ? timesFor(goal, id) : 1)
    return {
      done: eachDone,
      target,
      fraction: target > 0 ? Math.min(eachDone / target, 1) : 0,
      met: target > 0 && eachDone >= target,
    }
  }
  if (goal.kind === 'time') {
    // Time goals add up minutes, when they happened: all time logged for 'any', otherwise
    // only the entries linked to the goal (directly or through their task).
    const byId = winsById(data.wins)
    done = data.timeEntries
      .filter((e) => inPeriod(e.at) && (source === 'any' || entryGoalIds(e, byId).includes(goal.id)))
      .reduce((sum, e) => sum + e.minutes, 0)
  } else {
    // Count, completion and amount goals use finished wins, in the period they were finished.
    // Which ones depends on the goal's rule: every finished task, only to-dos, only quick-win
    // taps, or just those linked to it. A count goal counts each once; an amount goal adds up
    // their amounts (a win with no amount counts as 1).
    const counted = data.wins.filter(
      (w) => w.status === 'done' && w.completedAt && inPeriod(w.completedAt) && countsToward(goal, w),
    )
    done = goal.kind === 'amount' ? counted.reduce((sum, w) => sum + (w.amount ?? 1), 0) : counted.length
  }

  return {
    done,
    target,
    fraction: target > 0 ? Math.min(done / target, 1) : 0,
    met: target > 0 && done >= target,
  }
}

// Backfill for a newly created goal: link existing wins and standalone time
// entries whose areas overlap the goal's areas. Entries attached to a task
// inherit from the task, so they are left alone.
//  - A time goal also takes the standalone time entries (that is where its minutes live).
//  - An amount goal only takes wins that HAVE an amount: a linked win with none would
//    count as 1, so linking "Walk" and "Gym" to a squats goal would add two squats.
//  - Other goals take every matching win, since each counts once.
export function linkByArea(goal: GoalDef, data: AppData): Pick<AppData, 'wins' | 'timeEntries'> {
  const overlaps = (areas: Area[]) => areas.some((a) => goal.areas.includes(a))
  const byId = winsById(data.wins)
  const takesWin = (w: Win) => goal.kind !== 'amount' || w.amount !== undefined
  // Rule-based goals count automatically, so there is nothing to link.
  if (goalSource(goal) !== 'linked') return { wins: data.wins, timeEntries: data.timeEntries }
  return {
    wins: data.wins.map((w) =>
      !w.goalIds.includes(goal.id) && takesWin(w) && overlaps(winAreas(w, data.goals))
        ? { ...w, goalIds: [...w.goalIds, goal.id] }
        : w,
    ),
    timeEntries:
      goal.kind === 'time'
        ? data.timeEntries.map((e) =>
            !e.winId && !e.goalIds.includes(goal.id) && overlaps(entryAreas(e, byId, data.goals))
              ? { ...e, goalIds: [...e.goalIds, goal.id] }
              : e,
          )
        : data.timeEntries,
  }
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function progressLabel(goal: GoalDef, p: GoalProgress): string {
  if (goal.childIds) return `${p.done} of ${p.target} goals met`
  if (goal.kind === 'time') return `${formatMinutes(p.done)} of ${formatMinutes(p.target)}`
  if (goal.kind === 'amount') return `${p.done} of ${p.target}`
  return `${p.done} of ${p.target}`
}
