// One-off migration from the first data format (separate wins, tasks and goals
// with a single area each) to the linked model in types.ts.
import { DEFAULT_AREAS } from './areas'
import type { AppData, Area, GoalDef, TimeEntry, Win } from './types'

export type LegacyWin = { id: string; title: string; area: Area; at: Date; minutes?: number }
export type LegacyTask = { id: string; title: string; done: boolean; area?: Area }
export type LegacyGoal = Omit<GoalDef, 'areas' | 'period'> & { area?: Area }

export type LegacyData = { wins: LegacyWin[]; tasks: LegacyTask[]; goals: LegacyGoal[] }

export function migrateLegacy(legacy: LegacyData, now: Date): AppData {
  const goals: GoalDef[] = legacy.goals.map(({ area, ...rest }) => ({
    ...rest,
    period: 'week' as const,
    areas: area ? [area] : [],
  }))

  // The old model matched goals by area, so keep results identical by linking
  // each old item to the leaf goals in its area.
  const goalIdsFor = (area?: Area): string[] =>
    area ? goals.filter((g) => !g.childIds && g.areas.includes(area)).map((g) => g.id) : []

  const wins: Win[] = []
  const timeEntries: TimeEntry[] = []

  for (const old of legacy.wins) {
    wins.push({
      id: old.id,
      title: old.title,
      status: 'done',
      createdAt: old.at,
      completedAt: old.at,
      goalIds: goalIdsFor(old.area),
      areas: [old.area],
      origin: 'logged',
    })
    if (old.minutes && old.minutes > 0) {
      timeEntries.push({
        id: crypto.randomUUID(),
        at: old.at,
        minutes: old.minutes,
        winId: old.id,
        goalIds: [],
        areas: [],
      })
    }
  }

  // Old tasks had no timestamps, so finished ones are stamped with the migration time.
  for (const old of legacy.tasks) {
    wins.push({
      id: old.id,
      title: old.title,
      status: old.done ? 'done' : 'todo',
      createdAt: now,
      completedAt: old.done ? now : undefined,
      goalIds: goalIdsFor(old.area),
      areas: old.area ? [old.area] : [],
      origin: 'todo',
    })
  }

  return { timer: null, areas: DEFAULT_AREAS, quickWins: [], goals, wins, timeEntries }
}
