// Tapping a goal on Today. A goal that is just one task is completed (or taken back) with a tap;
// a goal of minutes, a number or several counts opens "I did something" ready filled in for it.
// Chores-style ("each") goals are not handled here: their bubbles log the tasks themselves.
import { addLoggedWin, type WinValues } from './edits'
import { goalSource } from './goals'
import { goalDisplay } from './todayAreas'
import type { AppData, GoalDef, GoalProgress } from './types'

export type GoalTapAction = 'complete' | 'form' | null

export function goalTapAction(goal: GoalDef, progress: GoalProgress): GoalTapAction {
  const source = goalSource(goal)
  if (source === 'each') return null // its bubbles do the logging
  // These count only to-dos you finish, or repeatable tasks you tap: an ad-hoc win would not count.
  if (source === 'todo' || source === 'quick') return null
  return goalDisplay(goal, progress) === 'task' ? 'complete' : 'form'
}

// What the form opens with: the goal's name and areas, the goal ticked if it counts what is
// linked to it (the rule goals count by themselves), and the box set to what the goal measures.
export function goalFormStart(goal: GoalDef): { values: Partial<WinValues>; kind: 'time' | 'number' } {
  return {
    values: {
      title: goal.title,
      areas: goal.areas,
      goalIds: goalSource(goal) === 'linked' ? [goal.id] : [],
    },
    kind: goal.kind === 'amount' ? 'number' : 'time',
  }
}

// Complete a single-task goal: a finished win named after the goal, counted toward it, stamped now.
export function completeGoal(data: AppData, goal: GoalDef, now: Date): { data: AppData; winId: string } {
  const next = addLoggedWin(data, { title: goal.title, areas: goal.areas, goalIds: goalSource(goal) === 'linked' ? [goal.id] : [] }, now)
  return { data: next, winId: next.wins[0].id }
}

// Take back the latest tap-completion of a single-task goal in [start, end): the win made by
// completeGoal (same name, logged, counted toward the goal). A to-do that happens to count toward
// the goal is never touched. `restore` puts it back for Undo.
export function uncompleteGoal(
  data: AppData,
  goal: GoalDef,
  start: Date,
  end: Date,
): { data: AppData; winId: string; restore: (d: AppData) => AppData } | null {
  const win = data.wins
    .filter(
      (w) =>
        w.status === 'done' &&
        w.origin === 'logged' &&
        w.quickWinId === undefined &&
        w.title === goal.title &&
        (goalSource(goal) !== 'linked' || w.goalIds.includes(goal.id)) &&
        w.completedAt !== undefined &&
        w.completedAt.getTime() >= start.getTime() &&
        w.completedAt.getTime() < end.getTime(),
    )
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0]
  if (!win) return null
  const entries = data.timeEntries.filter((e) => e.winId === win.id)
  return {
    data: { ...data, wins: data.wins.filter((w) => w.id !== win.id), timeEntries: data.timeEntries.filter((e) => e.winId !== win.id) },
    winId: win.id,
    restore: (d) => ({
      ...d,
      wins: d.wins.some((w) => w.id === win.id) ? d.wins : [win, ...d.wins],
      timeEntries: [...d.timeEntries, ...entries.filter((e) => !d.timeEntries.some((x) => x.id === e.id))],
    }),
  }
}
