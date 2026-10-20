// What Today's area rings show: for each area switched on, the goals in it and how far along
// they are. Pure: data in, cards out.
import { colourFor, NEUTRAL_COLOUR } from './areas'
import { eachSteps, goalSource, isActive, periodStartFor, progressFor, type EachStep } from './goals'
import type { AppData, GoalDef, GoalProgress } from './types'

export type AreaGoal = { goal: GoalDef; progress: GoalProgress; steps?: EachStep[] }

export type AreaCard = {
  key: string // the area's id, or OTHER_KEY for goals with no area
  name: string
  colour: string // a CSS colour for the ring and bars
  goals: AreaGoal[]
  met: number // goals fully met
  fraction: number // average progress across the goals (0..1)
}

export const OTHER_KEY = '__other'

// How a goal row draws itself: a labelled bubble per task, a bubble per count for small
// counts, otherwise a bar. (Overarching goals have their own card and never come here.)
export type GoalDisplay = 'steps' | 'bubbles' | 'bar'
export const MAX_BUBBLES = 6

export function goalDisplay(goal: GoalDef, progress: GoalProgress): GoalDisplay {
  if (goalSource(goal) === 'each') return 'steps'
  if ((goal.kind === 'count' || goal.kind === 'completion') && progress.target >= 1 && progress.target <= MAX_BUBBLES) return 'bubbles'
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
  const card = (key: string, name: string, colour: string, goals: GoalDef[]): AreaCard => {
    const items = goals.map(entry)
    return {
      key,
      name,
      colour,
      goals: items,
      met: items.filter((i) => i.progress.met).length,
      fraction: items.reduce((sum, i) => sum + i.progress.fraction, 0) / items.length,
    }
  }

  // A goal sits under every area it is labelled with; an area with no goals gets no ring.
  const cards = data.areas
    .filter((a) => a.onToday !== false)
    .map((a) => ({ area: a, goals: leaf.filter((g) => g.areas.includes(a.id)) }))
    .filter((x) => x.goals.length > 0)
    .map((x) => card(x.area.id, x.area.name, colourFor(data.areas, x.area.id), x.goals))

  // Goals with no area (or only areas that no longer exist) are kept together so none vanish.
  const known = new Set(data.areas.map((a) => a.id))
  const loose = leaf.filter((g) => !g.areas.some((a) => known.has(a)))
  if (loose.length > 0) cards.push(card(OTHER_KEY, data.areas.length === 0 ? 'Goals' : 'Other', NEUTRAL_COLOUR, loose))
  return cards
}
