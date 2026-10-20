// Small builders so tests read as scenarios, not boilerplate.
import type { AppData, Area, AreaDef, GoalDef, QuickWin, TimeEntry, Win, WinOrigin } from './types'

export function doneWin(
  at: Date,
  opts: { id?: string; goalIds?: string[]; areas?: Area[]; title?: string; origin?: WinOrigin; quickWinId?: string } = {},
): Win {
  return {
    origin: opts.origin,
    quickWinId: opts.quickWinId,
    id: opts.id ?? crypto.randomUUID(),
    title: opts.title ?? 'x',
    status: 'done',
    createdAt: at,
    completedAt: at,
    goalIds: opts.goalIds ?? [],
    areas: opts.areas ?? [],
  }
}

export function todo(opts: { id?: string; status?: 'todo' | 'doing'; goalIds?: string[]; areas?: Area[]; title?: string } = {}): Win {
  return {
    id: opts.id ?? crypto.randomUUID(),
    title: opts.title ?? 'task',
    status: opts.status ?? 'todo',
    createdAt: new Date(2026, 0, 1),
    goalIds: opts.goalIds ?? [],
    areas: opts.areas ?? [],
  }
}

export function session(
  at: Date,
  minutes: number,
  opts: { winId?: string; goalIds?: string[]; areas?: Area[]; title?: string } = {},
): TimeEntry {
  return {
    id: crypto.randomUUID(),
    at,
    minutes,
    winId: opts.winId,
    goalIds: opts.goalIds ?? [],
    areas: opts.areas ?? [],
    title: opts.title,
  }
}

export function data(
  goals: GoalDef[],
  wins: Win[] = [],
  timeEntries: TimeEntry[] = [],
  areas: AreaDef[] = [],
  quickWins: QuickWin[] = [],
): AppData {
  return { timer: null, areas, quickWins, goals, wins, timeEntries }
}

// A finished win with an amount ("10"), linked to the goals given.
export function amountWin(at: Date, amount: number | undefined, goalIds: string[] = [], id?: string): Win {
  return { ...doneWin(at, { goalIds, ...(id ? { id } : {}) }), amount }
}


export const SINCE = new Date(2026, 0, 1)

export const guitar: GoalDef = {
  id: 'guitar',
  title: 'Guitar',
  areas: ['music'],
  kind: 'time',
  period: 'week',
  targets: [{ from: SINCE, amount: 120 }],
}

export const workouts: GoalDef = {
  id: 'workouts',
  title: 'Workouts',
  areas: ['health'],
  kind: 'count',
  period: 'week',
  targets: [{ from: SINCE, amount: 2 }],
}

export const squats: GoalDef = {
  id: 'squats',
  title: 'Squats',
  areas: ['health'],
  kind: 'amount',
  period: 'week',
  targets: [{ from: SINCE, amount: 100 }],
}
