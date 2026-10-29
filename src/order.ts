// Putting goals and areas in the order you want. Areas set the order of the rings (and of the
// area groups on Today); goals are grouped by their first area, in area order, and you order them
// within their group. Overarching goals come first, goals with no area last.
import { isActive } from './goals'
import type { AppData, AreaDef, GoalDef } from './types'

export type Direction = -1 | 1 // -1 = up (earlier), 1 = down (later)

// Which group a goal sits in on Today: overarching goals first, then by the position of its first
// area that exists, then goals with no area.
export function goalGroup(goal: GoalDef, areas: AreaDef[]): number {
  if (goal.childIds) return -1
  const positions = goal.areas.map((id) => areas.findIndex((a) => a.id === id)).filter((n) => n >= 0)
  return positions.length > 0 ? Math.min(...positions) : areas.length
}

// Goals in the order Today shows them: by group, then in the order they are stored.
export function sortGoals(goals: GoalDef[], areas: AreaDef[]): GoalDef[] {
  return goals
    .map((goal, index) => ({ goal, index, group: goalGroup(goal, areas) }))
    .sort((a, b) => a.group - b.group || a.index - b.index)
    .map((x) => x.goal)
}

// The active goal next to this one, in the same group, in the direction asked (or null at the end).
function neighbour(data: AppData, id: string, dir: Direction): GoalDef | null {
  const goal = data.goals.find((g) => g.id === id)
  if (!goal || !isActive(goal)) return null
  const group = goalGroup(goal, data.areas)
  const peers = data.goals.filter((g) => isActive(g) && goalGroup(g, data.areas) === group) // stored order
  const at = peers.findIndex((g) => g.id === id)
  return peers[at + dir] ?? null
}

export const canMoveGoal = (data: AppData, id: string, dir: Direction): boolean => neighbour(data, id, dir) !== null

// Swap a goal with its neighbour in the same group. Archived goals keep their places.
export function moveGoal(data: AppData, id: string, dir: Direction): AppData {
  const other = neighbour(data, id, dir)
  if (!other) return data
  const i = data.goals.findIndex((g) => g.id === id)
  const j = data.goals.findIndex((g) => g.id === other.id)
  const goals = [...data.goals]
  ;[goals[i], goals[j]] = [goals[j], goals[i]]
  return { ...data, goals }
}

export const canMoveArea = (data: AppData, id: string, dir: Direction): boolean => {
  const i = data.areas.findIndex((a) => a.id === id)
  return i >= 0 && data.areas[i + dir] !== undefined
}

// Swap an area with the one above or below it: this reorders the rings.
export function moveArea(data: AppData, id: string, dir: Direction): AppData {
  if (!canMoveArea(data, id, dir)) return data
  const i = data.areas.findIndex((a) => a.id === id)
  const areas = [...data.areas]
  ;[areas[i], areas[i + dir]] = [areas[i + dir], areas[i]]
  return { ...data, areas }
}
