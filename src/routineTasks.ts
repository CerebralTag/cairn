// Choosing a Routine's tasks from the Routine's side: tick the repeatable tasks that belong to it,
// and name new ones. A task belongs to a Routine when the Routine is among its goals.
import { nameKey } from './suggest'
import type { AppData, GoalDef, QuickWin } from './types'

export type NewRoutineTask = { title: string; minutes?: number }
export type RoutineTasks = { ids: string[]; added: NewRoutineTask[] }

// The repeatable tasks tagged to a goal.
export function tasksIn(goalId: string, quickWins: QuickWin[]): QuickWin[] {
  return quickWins.filter((q) => q.goalIds.includes(goalId))
}

// Make the Routine's tasks exactly `ids` plus the `added` ones. A new name that matches an existing
// repeatable task (ignoring case, accents and spacing) tags that task instead of making a second
// one; otherwise a new task is made with the Routine's areas. Untagging leaves the task and its past
// wins alone, so earlier periods keep what they counted.
export function setRoutineTasks(data: AppData, goal: GoalDef, tasks: RoutineTasks): AppData {
  const wanted = new Set(tasks.ids)
  const made: QuickWin[] = []
  for (const t of tasks.added) {
    const title = t.title.trim()
    if (title === '') continue
    const existing = [...data.quickWins, ...made].find((q) => nameKey(q.title) === nameKey(title))
    if (existing) {
      wanted.add(existing.id)
      continue
    }
    const task: QuickWin = { id: crypto.randomUUID(), title, areas: goal.areas, goalIds: [], uses: 0 }
    made.push(t.minutes ? { ...task, minutes: t.minutes } : task)
    wanted.add(task.id)
  }

  const quickWins = [...data.quickWins, ...made].map((q) => {
    const has = q.goalIds.includes(goal.id)
    if (wanted.has(q.id) && !has) return { ...q, goalIds: [...q.goalIds, goal.id] }
    if (!wanted.has(q.id) && has) return { ...q, goalIds: q.goalIds.filter((id) => id !== goal.id) }
    return q
  })
  return { ...data, quickWins }
}
