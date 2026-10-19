// Goal math. Pure functions: data in, result out, no React, no storage.
// Period results are always calculated from entries, never stored.
import type { Area, AppData, GoalDef, GoalPeriod, GoalProgress, TimeEntry, Win } from './types'

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

// Progress for the period (of the goal's own length) starting at `periodStart`.
export function progressFor(goal: GoalDef, data: AppData, periodStart: Date): GoalProgress {
  if (archivedBefore(goal, periodStart)) return { done: 0, target: 0, fraction: 0, met: false }

  if (goal.childIds && goal.childIds.length > 0) {
    const children = childrenFor(goal, data.goals, periodStart)
    const results = children.map((c) => progressFor(c, data, periodStart))
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

  let done: number
  if (goal.kind === 'time') {
    // Time goals add up the minutes of linked time entries, when they happened.
    const byId = winsById(data.wins)
    done = data.timeEntries
      .filter((e) => inPeriod(e.at) && entryGoalIds(e, byId).includes(goal.id))
      .reduce((sum, e) => sum + e.minutes, 0)
  } else {
    // Count, completion and amount goals use the wins linked to them, in the period they
    // were finished. A count goal counts each one once; an amount goal adds up their
    // amounts (a linked win with no amount counts as 1).
    const linked = data.wins.filter(
      (w) => w.status === 'done' && w.completedAt && inPeriod(w.completedAt) && w.goalIds.includes(goal.id),
    )
    done = goal.kind === 'amount' ? linked.reduce((sum, w) => sum + (w.amount ?? 1), 0) : linked.length
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
