// What Today's area rings show: for each area switched on, the goals in it and how far along
// they are. Pure: data in, cards out.
import { colourFor, NEUTRAL_COLOUR } from './areas'
import { eachSteps, goalSource, isActive, periodStartFor, progressFor, type EachStep } from './goals'
import type { AppData, GoalDef, GoalProgress } from './types'

export type AreaGoal = { goal: GoalDef; progress: GoalProgress; steps?: EachStep[] }

// A to-do assigned to the area: just its name, with a ✓ once it is done.
export type AreaTask = { id: string; title: string; done: boolean }

export type AreaCard = {
  key: string // the area's id, or OTHER_KEY for goals with no area
  name: string
  colour: string // a CSS colour for the ring and bars
  goals: AreaGoal[]
  tasks: AreaTask[]
  total: number // goals + tasks in the area
  met: number // goals met + tasks done
  fraction: number // average progress across them (0..1); an empty area counts as complete
}

export const OTHER_KEY = '__other'

// How a goal row draws itself: just the name for a single task, a labelled bubble per task,
// a bubble per count for small counts, otherwise a bar. (Overarching goals have their own card and never come here.)
export type GoalDisplay = 'task' | 'steps' | 'bubbles' | 'bar'
export const MAX_BUBBLES = 6

export function goalDisplay(goal: GoalDef, progress: GoalProgress): GoalDisplay {
  if (goalSource(goal) === 'each') return 'steps'
  // Just a task, nothing to measure: list its name (a ✓ appears when it is done).
  if (goal.kind === 'completion' || (goal.kind === 'count' && progress.target === 1)) return 'task'
  if (goal.kind === 'count' && progress.target >= 1 && progress.target <= MAX_BUBBLES) return 'bubbles'
  return 'bar'
}

export function areaCards(data: AppData, now: Date): AreaCard[] {
  const leaf = data.goals.filter((g) => !g.childIds && isActive(g))
  const entry = (goal: GoalDef): AreaGoal => {
    const start = periodStartFor(goal.period, now)
    return {
      goal,
      progress: progressFor(goal, data, start),
      steps: goalSource(goal) === 'each' ? eachSteps(goal, data, start) : undefined,
    }
  }
  const card = (key: string, name: string, colour: string, goals: GoalDef[], tasks: AreaTask[] = []): AreaCard => {
    const items = goals.map(entry)
    const total = items.length + tasks.length
    const met = items.filter((i) => i.progress.met).length + tasks.filter((t) => t.done).length
    const sum = items.reduce((s, i) => s + i.progress.fraction, 0) + tasks.filter((t) => t.done).length
    // Nothing assigned means nothing left to do: the ring is full and reads 0/0.
    return { key, name, colour, goals: items, tasks, total, met, fraction: total === 0 ? 1 : sum / total }
  }

  // To-dos assigned to an area: those still open, and those finished this week.
  const weekStart = periodStartFor('week', now).getTime()
  const tasksIn = (areaId: string): AreaTask[] =>
    data.wins
      .filter(
        (w) =>
          w.origin === 'todo' &&
          w.areas.includes(areaId) &&
          (w.status === 'todo' || w.status === 'doing' || (w.status === 'done' && (w.completedAt?.getTime() ?? 0) >= weekStart)),
      )
      .map((w) => ({ id: w.id, title: w.title, done: w.status === 'done' }))

  // Every area switched on gets a ring. A goal sits under every area it is labelled with.
  const cards = data.areas
    .filter((a) => a.onToday !== false)
    .map((a) =>
      card(a.id, a.name, colourFor(data.areas, a.id), leaf.filter((g) => g.areas.includes(a.id)), tasksIn(a.id)),
    )

  // Goals with no area (or only areas that no longer exist) are kept together so none vanish.
  const known = new Set(data.areas.map((a) => a.id))
  const loose = leaf.filter((g) => !g.areas.some((a) => known.has(a)))
  if (loose.length > 0 && data.otherOnToday !== false) cards.push(card(OTHER_KEY, data.areas.length === 0 ? 'Goals' : 'Other', NEUTRAL_COLOUR, loose))
  return cards
}

// A goal's colour on Today: that of the first of its areas that exists, else neutral grey.
// (Colour is the only sign of the area on a goal row; the rings carry the names.)
export function goalColourFor(areas: AppData['areas'], goal: GoalDef): string {
  const area = goal.areas.map((id) => areas.find((a) => a.id === id)).find((a) => a !== undefined)
  return area ? colourFor(areas, area.id) : NEUTRAL_COLOUR
}

// Every active goal for the period, whether or not its area has a ring (or has any area at all).
// Ordered by area, in the order areas are listed, with goals that have none last, so goals that
// share a colour sit together. Overarching goals have their own cards and are not included.
export function todayGoals(data: AppData, now: Date): AreaGoal[] {
  const rank = (g: GoalDef) => {
    const i = Math.min(...g.areas.map((id) => data.areas.findIndex((a) => a.id === id)).filter((n) => n >= 0))
    return Number.isFinite(i) ? i : data.areas.length
  }
  return data.goals
    .filter((g) => !g.childIds && isActive(g))
    .map((g, index) => ({ g, index, rank: rank(g) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ g }) => {
      const start = periodStartFor(g.period, now)
      return { goal: g, progress: progressFor(g, data, start), steps: goalSource(g) === 'each' ? eachSteps(g, data, start) : undefined }
    })
}
