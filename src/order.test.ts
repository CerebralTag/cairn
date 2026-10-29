import { describe, expect, it } from 'vitest'
import { canMoveArea, canMoveGoal, goalGroup, moveArea, moveGoal, sortGoals } from './order'
import { SINCE, data, guitar, squats, workouts } from './testHelpers'
import type { GoalDef } from './types'

const AREAS = [
  { id: 'music', name: 'Music', colour: 1 },
  { id: 'health', name: 'Health', colour: 2 },
]
const g = (id: string, areas: string[], extra: Partial<GoalDef> = {}): GoalDef => ({ ...squats, id, title: id, areas, ...extra })
const withAreas = (goals: GoalDef[]) => ({ ...data(goals), areas: AREAS })

describe('where goals sit', () => {
  it('puts overarching goals first, then groups by first area in area order, then no area', () => {
    const overall: GoalDef = { id: 'o', title: 'O', areas: [], kind: 'completion', period: 'week', targets: [], childIds: ['a'] }
    const sorted = sortGoals([g('none', []), g('h1', ['health']), g('m1', ['music']), overall, g('h2', ['health']), g('m2', ['gone', 'music'])], AREAS)
    expect(sorted.map((x) => x.id)).toEqual(['o', 'm1', 'm2', 'h1', 'h2', 'none'])
  })

  it('groups a goal in several areas by the earliest one', () => {
    expect(goalGroup(g('x', ['health', 'music']), AREAS)).toBe(0)
  })
})

describe('moving goals', () => {
  const d = withAreas([g('a', ['music']), g('x', ['health']), g('b', ['music']), g('y', ['health'])])

  it('swaps a goal with its neighbour in the same group, not with another group\'s goal', () => {
    const moved = moveGoal(d, 'b', -1)
    expect(sortGoals(moved.goals, AREAS).map((x) => x.id)).toEqual(['b', 'a', 'x', 'y'])
    expect(moveGoal(d, 'a', 1).goals.map((x) => x.id)).toEqual(['b', 'x', 'a', 'y'])
  })

  it('does nothing at the ends of a group', () => {
    expect(canMoveGoal(d, 'a', -1)).toBe(false)
    expect(canMoveGoal(d, 'b', 1)).toBe(false)
    expect(canMoveGoal(d, 'a', 1)).toBe(true)
    expect(moveGoal(d, 'a', -1)).toBe(d)
  })

  it('skips archived goals and leaves them where they were', () => {
    const withArchived = withAreas([g('a', ['music']), g('old', ['music'], { archivedAt: SINCE }), g('b', ['music'])])
    const moved = moveGoal(withArchived, 'b', -1)
    expect(moved.goals.map((x) => x.id)).toEqual(['b', 'old', 'a'])
    expect(canMoveGoal(withArchived, 'old', 1)).toBe(false) // archived goals are not reordered
  })

  it('moves goals with no area among themselves, and ignores unknown ids', () => {
    const loose = withAreas([g('p', []), g('q', [])])
    expect(moveGoal(loose, 'q', -1).goals.map((x) => x.id)).toEqual(['q', 'p'])
    expect(moveGoal(loose, 'nope', 1)).toBe(loose)
  })
})

describe('moving areas', () => {
  const d = withAreas([guitar, workouts])
  it('swaps an area with the one above or below, which reorders the rings', () => {
    expect(moveArea(d, 'health', -1).areas.map((a) => a.id)).toEqual(['health', 'music'])
    expect(moveArea(d, 'music', 1).areas.map((a) => a.id)).toEqual(['health', 'music'])
  })
  it('does nothing at the ends', () => {
    expect(canMoveArea(d, 'music', -1)).toBe(false)
    expect(canMoveArea(d, 'health', 1)).toBe(false)
    expect(moveArea(d, 'music', -1)).toBe(d)
  })
})
