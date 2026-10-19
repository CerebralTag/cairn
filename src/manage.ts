// Pure functions behind the Manage screen: status changes and deletions that
// have to keep the rest of the data consistent.
import type { AppData, Win, WinStatus } from './types'

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

// Change a task's status. Only 'done' carries a completion time, so reopening or
// dropping a finished task clears it and it stops appearing in reports.
export function withStatus(win: Win, status: WinStatus, now: Date): Win {
  return { ...win, status, completedAt: status === 'done' ? now : undefined }
}

// Delete a task. Time logged on it really happened, so its sessions are kept as
// standalone entries carrying the task's title and links.
export function deleteWin(data: AppData, id: string): AppData {
  const win = data.wins.find((w) => w.id === id)
  if (!win) return data
  return {
    ...data,
    // A timer running on the deleted task keeps counting toward the task's goals and
    // areas, the same as the sessions already saved on it.
    timer:
      data.timer?.winId === id
        ? {
            ...data.timer,
            winId: undefined,
            goalIds: unique([...data.timer.goalIds, ...win.goalIds]),
            areas: unique([...data.timer.areas, ...win.areas]),
          }
        : data.timer,
    wins: data.wins.filter((w) => w.id !== id),
    timeEntries: data.timeEntries.map((e) =>
      e.winId !== id
        ? e
        : {
            ...e,
            winId: undefined,
            title: e.title ?? win.title,
            goalIds: unique([...e.goalIds, ...win.goalIds]),
            areas: unique([...e.areas, ...win.areas]),
          },
    ),
  }
}

// Archive a goal: it stops appearing on Today and in pickers, and from this
// moment on has no periods, but every earlier period keeps its result.
export function archiveGoal(data: AppData, id: string, now: Date): AppData {
  return { ...data, goals: data.goals.map((g) => (g.id === id ? { ...g, archivedAt: now } : g)) }
}

export function restoreGoal(data: AppData, id: string): AppData {
  return { ...data, goals: data.goals.map((g) => (g.id === id ? { ...g, archivedAt: undefined } : g)) }
}

// Delete a goal for good, removing every reference to it. Wins and time entries
// are kept, but the goal's past results are gone.
export function removeGoal(data: AppData, id: string): AppData {
  return {
    ...data,
    timer: data.timer ? { ...data.timer, goalIds: data.timer.goalIds.filter((g) => g !== id) } : null,
    goals: data.goals
      .filter((g) => g.id !== id)
      .map((g) => (g.childIds ? { ...g, childIds: g.childIds.filter((c) => c !== id) } : g)),
    wins: data.wins.map((w) => ({ ...w, goalIds: w.goalIds.filter((g) => g !== id) })),
    timeEntries: data.timeEntries.map((e) => ({ ...e, goalIds: e.goalIds.filter((g) => g !== id) })),
    quickWins: data.quickWins.map((q) => ({ ...q, goalIds: q.goalIds.filter((g) => g !== id) })),
  }
}

// Remove an area everywhere it is referenced. Entries and goals are kept.
export function removeArea(data: AppData, id: string): AppData {
  const without = (areas: string[]) => areas.filter((a) => a !== id)
  return {
    ...data,
    timer: data.timer ? { ...data.timer, areas: without(data.timer.areas) } : null,
    areas: data.areas.filter((a) => a.id !== id),
    goals: data.goals.map((g) => ({ ...g, areas: without(g.areas) })),
    wins: data.wins.map((w) => ({ ...w, areas: without(w.areas) })),
    timeEntries: data.timeEntries.map((e) => ({ ...e, areas: without(e.areas) })),
    quickWins: data.quickWins.map((q) => ({ ...q, areas: without(q.areas) })),
  }
}
