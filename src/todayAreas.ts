// What Today's area rings show: for each area switched on, the goals in it and how far along
// they are. Pure: data in, cards out.
import { colourFor, NEUTRAL_COLOUR } from './areas'
import { countsToward, eachSteps, entryAreas, entryGoalIds, goalSource, isActive, isTracked, periodStartFor, progressFor, winAreas, winsById, type EachStep } from './goals'
import { doneWinsInRange, timeInRange, weekRange } from './reports'
import type { AppData, GoalDef, GoalProgress } from './types'

export type AreaGoal = { goal: GoalDef; progress: GoalProgress; steps?: EachStep[] }

export type AreaCard = {
  key: string // the area's id, or OTHER_KEY for goals with no area
  name: string
  colour: string // a CSS colour for the ring and bars
  goals: AreaGoal[]
  total: number // goals in the area (to-dos are not counted)
  met: number // goals met
  fraction: number // average progress of the goals (0..1); an area with none counts as complete
  extra: number // laps of extra effort this week outside the goals (the outer ring); 0 = none
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

// What the middle of an area's ring says: the number of goals while none is met ("2"), "1/2" once
// some are, and ✓ when all are (an area with no goals owes nothing, so that is a ✓ too).
export function ringCentre(met: number, total: number): string {
  if (total === 0 || met >= total) return '✓'
  return met === 0 ? String(total) : `${met}/${total}`
}

// The outer ring: this week's effort in an area that none of the area's goals counted. Time spent
// on things (tasks, to-dos, plain time) that are in the area but not in one of its goals fills it at
// a lap per 4 hours; each finished win in the area that is not in one of its goals adds what a goal
// of the area would add to the inner ring (a share of 1/goals, or a quarter when it has none).
export const EXTRA_LAP_MINUTES = 240
const NO_GOALS_SHARE = 1 / 4

export function areaExtra(data: AppData, areaId: string, goalsInArea: GoalDef[], now: Date): { laps: number; minutes: number; items: number } {
  const range = weekRange(now)
  const inGoal = new Set(goalsInArea.map((g) => g.id))
  const byId = winsById(data.wins)
  // A goal that counts "anything" already counts all the time; and a win is not extra if any count
  // goal of the area counts it, by a tag or by its rule (to-dos finished, repeatable tasks tapped...).
  const takesAllTime = goalsInArea.some((g) => g.kind === 'time' && goalSource(g) === 'any')
  const countGoals = goalsInArea.filter((g) => g.kind !== 'time')

  const minutes = takesAllTime
    ? 0
    : timeInRange(data.timeEntries, range)
        .filter((e) => entryAreas(e, byId, data.goals).includes(areaId) && !entryGoalIds(e, byId).some((id) => inGoal.has(id)))
        .reduce((sum, e) => sum + e.minutes, 0)
  const items = doneWinsInRange(data.wins, range).filter(
    (w) => winAreas(w, data.goals).includes(areaId) && !w.goalIds.some((id) => inGoal.has(id)) && !countGoals.some((g) => countsToward(g, w)),
  ).length

  const share = goalsInArea.length > 0 ? 1 / goalsInArea.length : NO_GOALS_SHARE
  return { laps: minutes / EXTRA_LAP_MINUTES + items * share, minutes, items }
}

export function areaCards(data: AppData, now: Date): AreaCard[] {
  const leaf = data.goals.filter((g) => !g.childIds && isActive(g) && isTracked(g)) // containers feed no ring
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
    const met = items.filter((i) => i.progress.met).length
    // Nothing assigned means nothing left to do: the ring is full and reads 0/0.
    return {
      key,
      name,
      colour,
      goals: items,
      total: items.length,
      met,
      fraction: items.length === 0 ? 1 : items.reduce((sum, i) => sum + i.progress.fraction, 0) / items.length,
      extra: key === OTHER_KEY ? 0 : areaExtra(data, key, goals, now).laps, // goals with no area have no area to credit
    }
  }

  // Every area switched on gets a ring. A goal sits under every area it is labelled with.
  const cards = data.areas
    .filter((a) => a.onToday !== false)
    .map((a) => card(a.id, a.name, colourFor(data.areas, a.id), leaf.filter((g) => g.areas.includes(a.id))))

  // Goals with no area (or only areas that no longer exist) are kept together so none vanish.
  const known = new Set(data.areas.map((a) => a.id))
  const loose = leaf.filter((g) => !g.areas.some((a) => known.has(a)))
  if (loose.length > 0 && data.otherOnToday !== false) cards.push(card(OTHER_KEY, data.areas.length === 0 ? 'Goals' : 'Other', NEUTRAL_COLOUR, loose))
  return cards
}

// A goal's colour on Today: that of the first of its areas that exists, else neutral grey.
// (Colour is the only sign of the area on a goal row; the rings carry the names.)
export function goalColourFor(areas: AppData['areas'], goal: GoalDef): string {
  return areasColour(areas, goal.areas) ?? NEUTRAL_COLOUR
}

// The colour of the first of these areas that exists, or null if none does.
export function areasColour(areas: AppData['areas'], ids: string[]): string | null {
  const area = ids.map((id) => areas.find((a) => a.id === id)).find((a) => a !== undefined)
  return area ? colourFor(areas, area.id) : null
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
