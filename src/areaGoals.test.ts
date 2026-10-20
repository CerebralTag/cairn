import { describe, expect, it } from 'vitest'
import { fileableGoals, setAreaGoals } from './areaGoals'
import { SINCE, data, guitar, squats, workouts } from './testHelpers'
import type { GoalDef } from './types'

const loose = (g: GoalDef): GoalDef => ({ ...g, areas: [] })

describe('setAreaGoals', () => {
  it('files the ticked goals under the area', () => {
    const d = data([loose(guitar), loose(workouts)])
    const result = setAreaGoals(d, 'music', ['guitar'])
    expect(result.goals.find((g) => g.id === 'guitar')?.areas).toEqual(['music'])
    expect(result.goals.find((g) => g.id === 'workouts')?.areas).toEqual([])
  })

  it('takes unticked goals out of the area, and keeps their other areas', () => {
    const both: GoalDef = { ...guitar, areas: ['music', 'health'] }
    const result = setAreaGoals(data([both]), 'music', [])
    expect(result.goals[0].areas).toEqual(['health'])
  })

  it('leaves everything alone when nothing changes, so no needless save', () => {
    const d = data([{ ...guitar, areas: ['music'] }, loose(squats)])
    expect(setAreaGoals(d, 'music', ['guitar'])).toBe(d)
  })

  it('never touches overarching or archived goals', () => {
    const overall: GoalDef = { id: 'o', title: 'O', areas: [], kind: 'completion', period: 'week', targets: [], childIds: ['guitar'] }
    const archived: GoalDef = { ...loose(squats), archivedAt: SINCE }
    const d = data([overall, archived])
    expect(setAreaGoals(d, 'music', ['o', 'squats'])).toBe(d)
    expect(fileableGoals([overall, archived, guitar]).map((g) => g.id)).toEqual(['guitar'])
  })
})
