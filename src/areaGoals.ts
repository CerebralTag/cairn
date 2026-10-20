// Filing goals under an area from the area's side: tick the goals that belong to it.
import { isActive } from './goals'
import type { AppData, GoalDef } from './types'

// The goals that can be filed under an area (overarching goals only combine other goals).
export function fileableGoals(goals: GoalDef[]): GoalDef[] {
  return goals.filter((g) => !g.childIds && isActive(g))
}

// Make `goalIds` exactly the (active, non-overarching) goals labelled with the area. Other goals,
// and the area's other labels on them, are left alone.
export function setAreaGoals(data: AppData, areaId: string, goalIds: string[]): AppData {
  const wanted = new Set(goalIds)
  let changed = false
  const goals = data.goals.map((g) => {
    if (g.childIds || !isActive(g)) return g
    const has = g.areas.includes(areaId)
    if (wanted.has(g.id) && !has) {
      changed = true
      return { ...g, areas: [...g.areas, areaId] }
    }
    if (!wanted.has(g.id) && has) {
      changed = true
      return { ...g, areas: g.areas.filter((a) => a !== areaId) }
    }
    return g
  })
  return changed ? { ...data, goals } : data
}
