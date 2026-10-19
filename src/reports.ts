// Reporting layer. Pure functions over the data: pick a date range, then
// aggregate. Think of wins and time entries as tables and each function as a query:
//   doneWinsInRange / timeInRange = WHERE ts >= start AND ts < end
//   totalsFor    = COUNT(wins), SUM(minutes), COUNT(DISTINCT day)
//   byArea       = ... GROUP BY effective area ORDER BY minutes DESC
//   dailyTotals  = GROUP BY day, left-joined to a calendar so empty days appear
import { addDays, entryAreas, formatMinutes, periodEnd, periodStartFor, progressFor, startOfDay, startOfWeek, targetFor, winAreas, winsById } from './goals'
import type { AppData, Area, GoalDef, GoalProgress, TimeEntry, Win } from './types'

// Half-open: includes `start`, excludes `end`. This is what makes "Sep 27-29"
// unambiguous: it's 27th 00:00 up to (not including) 30th 00:00.
export type DateRange = { start: Date; end: Date }

export { startOfDay }

export function dayRange(date: Date): DateRange {
  const start = startOfDay(date)
  return { start, end: addDays(start, 1) }
}

export function weekRange(date: Date, weekStartsOn = 1): DateRange {
  const start = startOfWeek(date, weekStartsOn)
  return { start, end: addDays(start, 7) }
}

export function monthRange(date: Date): DateRange {
  // Month 12 rolls over to January of the next year, so this is safe for December.
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  }
}

export function yearRange(date: Date): DateRange {
  return { start: new Date(date.getFullYear(), 0, 1), end: new Date(date.getFullYear() + 1, 0, 1) }
}

// Custom range as people think of it: both days inclusive (Sep 27 to Sep 29).
export function customRange(fromDay: Date, toDay: Date): DateRange {
  return { start: startOfDay(fromDay), end: addDays(startOfDay(toDay), 1) }
}

function inRange(date: Date, range: DateRange): boolean {
  return date.getTime() >= range.start.getTime() && date.getTime() < range.end.getTime()
}

export type DoneWin = Win & { completedAt: Date }

// Wins finished within the range, by completion time. To-dos not yet done have
// no timestamp and never appear in reports.
export function doneWinsInRange(wins: Win[], range: DateRange): DoneWin[] {
  return wins.filter(
    (w): w is DoneWin => w.status === 'done' && w.completedAt !== undefined && inRange(w.completedAt, range),
  )
}

export function timeInRange(entries: TimeEntry[], range: DateRange): TimeEntry[] {
  return entries.filter((e) => inRange(e.at, range))
}

export type Totals = { count: number; minutes: number; activeDays: number }

export function totalsFor(data: AppData, range: DateRange): Totals {
  const wins = doneWinsInRange(data.wins, range)
  const entries = timeInRange(data.timeEntries, range)
  const days = new Set([
    ...wins.map((w) => startOfDay(w.completedAt).getTime()),
    ...entries.map((e) => startOfDay(e.at).getTime()),
  ])
  return {
    count: wins.length,
    minutes: entries.reduce((sum, e) => sum + e.minutes, 0),
    activeDays: days.size,
  }
}

export type AreaTotal = { area: Area; count: number; minutes: number }

// Time by area, biggest first. A record is credited to EVERY one of its effective
// areas, so the bars can add up to more than the total. Records with no area at
// all are not charted (they still count in totalsFor).
export function byArea(data: AppData, range: DateRange): AreaTotal[] {
  const groups = new Map<Area, AreaTotal>()
  const group = (area: Area) => {
    const g = groups.get(area) ?? { area, count: 0, minutes: 0 }
    groups.set(area, g)
    return g
  }
  const byId = winsById(data.wins)

  for (const w of doneWinsInRange(data.wins, range)) {
    for (const area of winAreas(w, data.goals)) group(area).count += 1
  }
  for (const e of timeInRange(data.timeEntries, range)) {
    for (const area of entryAreas(e, byId, data.goals)) group(area).minutes += e.minutes
  }
  return [...groups.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count)
}

export type DayTotal = { day: Date; count: number; minutes: number }

// One row per calendar day in the range, including days with nothing logged
// (count 0). `count` is the number of distinct things you did that day: each
// task counts once for a day it was finished or worked on, plus standalone time
// entries. That's what a heatmap needs: a cell for every day.
export function dailyTotals(data: AppData, range: DateRange): DayTotal[] {
  const buckets = new Map<number, { day: Date; things: Set<string>; minutes: number }>()
  const bucket = (date: Date) => {
    const day = startOfDay(date)
    const b = buckets.get(day.getTime()) ?? { day, things: new Set<string>(), minutes: 0 }
    buckets.set(day.getTime(), b)
    return b
  }

  for (const w of doneWinsInRange(data.wins, range)) bucket(w.completedAt).things.add(w.id)
  for (const e of timeInRange(data.timeEntries, range)) {
    const b = bucket(e.at)
    b.minutes += e.minutes
    b.things.add(e.winId ?? e.id)
  }

  const result: DayTotal[] = []
  for (let day = range.start; day.getTime() < range.end.getTime(); day = addDays(day, 1)) {
    const b = buckets.get(day.getTime())
    result.push({ day, count: b ? b.things.size : 0, minutes: b ? b.minutes : 0 })
  }
  return result
}

// Longest run of consecutive days with at least one thing done. A "best stretch"
// only ever goes up; unlike a streak, a quiet day never resets anything shown.
export function bestStretch(days: DayTotal[]): number {
  let best = 0
  let current = 0
  for (const d of days) {
    current = d.count > 0 ? current + 1 : 0
    best = Math.max(best, current)
  }
  return best
}

export type ActivityItem = {
  key: string
  kind: 'win' | 'progress' | 'time'
  title: string
  at: Date
  minutes: number
  amount?: number // a finished win's amount, if it has one
  areas: Area[]
}

// What you did in a range, newest first, for the Today list and day detail:
//  - 'win':      a task/win finished in the range (with its time in the range)
//  - 'progress': time on a task NOT finished in the range ("so far")
//  - 'time':     a standalone time entry
export function activityFor(data: AppData, range: DateRange): ActivityItem[] {
  const byId = winsById(data.wins)
  const done = doneWinsInRange(data.wins, range)
  const doneIds = new Set(done.map((w) => w.id))
  const entries = timeInRange(data.timeEntries, range)
  const items: ActivityItem[] = []

  for (const w of done) {
    items.push({
      key: w.id,
      kind: 'win',
      title: w.title,
      at: w.completedAt,
      minutes: entries.filter((e) => e.winId === w.id).reduce((sum, e) => sum + e.minutes, 0),
      amount: w.amount,
      areas: winAreas(w, data.goals),
    })
  }

  const progress = new Map<string, ActivityItem>()
  for (const e of entries) {
    if (e.winId && doneIds.has(e.winId)) continue // folded into its win above
    const task = e.winId ? byId.get(e.winId) : undefined
    if (task) {
      const item = progress.get(task.id) ?? {
        key: `progress-${task.id}`,
        kind: 'progress' as const,
        title: task.title,
        at: e.at,
        minutes: 0,
        areas: winAreas(task, data.goals),
      }
      item.minutes += e.minutes
      if (e.at.getTime() > item.at.getTime()) item.at = e.at
      progress.set(task.id, item)
    } else {
      items.push({
        key: e.id,
        kind: 'time',
        title: e.title ?? 'Time logged',
        at: e.at,
        minutes: e.minutes,
        areas: entryAreas(e, byId, data.goals),
      })
    }
  }

  return [...items, ...progress.values()].sort((a, b) => b.at.getTime() - a.at.getTime())
}

// e.g. "3 sessions · 2h 10m so far" for an unfinished task.
export function soFarLabel(taskId: string, entries: TimeEntry[]): string | null {
  const mine = entries.filter((e) => e.winId === taskId)
  if (mine.length === 0) return null
  const total = mine.reduce((sum, e) => sum + e.minutes, 0)
  return `${mine.length} ${mine.length === 1 ? 'session' : 'sessions'} · ${formatMinutes(total)} so far`
}

export type PeriodResult = { periodStart: Date; progress: GoalProgress }

// One result per period (day, week or month, by the goal's own period) overlapping
// the range, each judged against the target in effect then. Neutral by design:
// the UI shows a bar for every period, a check when met, and nothing special when
// not. Periods from the moment a goal was archived onward are left out.
export function goalHistory(goal: GoalDef, data: AppData, range: DateRange): PeriodResult[] {
  const results: PeriodResult[] = []
  for (
    let start = periodStartFor(goal.period, range.start);
    start.getTime() < range.end.getTime();
    start = periodEnd(goal.period, start)
  ) {
    if (goal.archivedAt && start.getTime() >= goal.archivedAt.getTime()) break
    if (targetFor(goal, start) === undefined) continue // before the goal existed: nothing to show
    results.push({ periodStart: start, progress: progressFor(goal, data, start) })
  }
  return results
}

export type LogEntry = {
  key: string
  kind: 'win' | 'time'
  id: string
  at: Date
  title: string
  minutes?: number
  amount?: number
  attachedTo?: string // for time entries: the task they belong to
  areas: Area[]
}

// Every record in the range as its own row, newest first, for the full log. Unlike
// activityFor this does not merge anything, so each row maps to exactly one record
// that can be edited or deleted.
export function logEntries(data: AppData, range: DateRange): LogEntry[] {
  const byId = winsById(data.wins)
  const rows: LogEntry[] = []

  for (const w of doneWinsInRange(data.wins, range)) {
    rows.push({
      key: `win-${w.id}`,
      kind: 'win',
      id: w.id,
      at: w.completedAt,
      title: w.title,
      amount: w.amount,
      areas: winAreas(w, data.goals),
    })
  }
  for (const e of timeInRange(data.timeEntries, range)) {
    const task = e.winId ? byId.get(e.winId) : undefined
    rows.push({
      key: `time-${e.id}`,
      kind: 'time',
      id: e.id,
      at: e.at,
      title: e.title ?? task?.title ?? 'Time logged',
      minutes: e.minutes,
      attachedTo: task?.title,
      areas: entryAreas(e, byId, data.goals),
    })
  }
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime())
}
