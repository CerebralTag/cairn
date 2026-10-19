// Pure data edits behind the forms: log a win, change one, change a block of time,
// delete. Each takes the whole AppData and returns a new one, so they can be tested
// without any screen.
import type { AppData, Area } from './types'

export type WinValues = {
  title: string
  areas: Area[]
  goalIds: string[]
  minutes?: number // new ad-hoc wins only: becomes a time entry attached to the win
  at?: Date // when it happened; omitted means "now"
  amount?: number
}

export type TimeEntryPatch = {
  minutes: number
  at: Date
  title?: string
  areas: Area[]
  goalIds: string[]
}

// Log a finished win. It can be back-dated: `at` is when it happened.
export function addLoggedWin(data: AppData, values: WinValues, now: Date): AppData {
  const at = values.at ?? now
  const id = crypto.randomUUID()
  return {
    ...data,
    wins: [
      {
        id,
        title: values.title,
        status: 'done',
        createdAt: at,
        completedAt: at,
        goalIds: values.goalIds,
        areas: values.areas,
        amount: values.amount,
        origin: 'logged',
      },
      ...data.wins,
    ],
    // Minutes typed on an ad-hoc win become a time entry attached to it, at the same time.
    timeEntries: values.minutes
      ? [...data.timeEntries, { id: crypto.randomUUID(), at, minutes: values.minutes, winId: id, goalIds: [], areas: [] }]
      : data.timeEntries,
  }
}

export function addTask(data: AppData, values: WinValues, now: Date): AppData {
  return {
    ...data,
    wins: [
      ...data.wins,
      {
        id: crypto.randomUUID(),
        title: values.title,
        status: 'todo',
        createdAt: now,
        goalIds: values.goalIds,
        areas: values.areas,
        amount: values.amount,
        origin: 'todo',
      },
    ],
  }
}

// Edit a win or task. For a finished win, `at` moves its completion time (so it
// moves between days and periods); for an unfinished task `at` is ignored.
export function applyWinEdit(data: AppData, id: string, values: WinValues): AppData {
  return {
    ...data,
    wins: data.wins.map((w) => {
      if (w.id !== id) return w
      const moved =
        w.status === 'done' && values.at
          ? { completedAt: values.at, createdAt: new Date(Math.min(w.createdAt.getTime(), values.at.getTime())) }
          : {}
      return {
        ...w,
        title: values.title,
        areas: values.areas,
        goalIds: values.goalIds,
        amount: values.amount,
        ...moved,
      }
    }),
  }
}

export function applyEntryEdit(data: AppData, id: string, patch: TimeEntryPatch): AppData {
  return {
    ...data,
    timeEntries: data.timeEntries.map((e) =>
      e.id === id
        ? { ...e, minutes: patch.minutes, at: patch.at, title: patch.title, areas: patch.areas, goalIds: patch.goalIds }
        : e,
    ),
  }
}

export function deleteEntry(data: AppData, id: string): AppData {
  return { ...data, timeEntries: data.timeEntries.filter((e) => e.id !== id) }
}
