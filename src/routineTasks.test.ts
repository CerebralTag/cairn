import { describe, expect, it } from 'vitest'
import { eachSteps, syncEachGoals, currentTarget } from './goals'
import { applyQuickWin } from './quickWins'
import { setRoutineTasks, tasksIn } from './routineTasks'
import { SINCE, data } from './testHelpers'
import type { GoalDef, QuickWin } from './types'

const WED = new Date(2026, 9, 14, 9)
const MON = new Date(2026, 9, 12)
const chores: GoalDef = { id: 'ch', title: 'Chores', areas: ['home'], kind: 'count', period: 'week', source: 'each', targets: [{ from: SINCE, amount: 2 }] }
const trash: QuickWin = { id: 't', title: 'Trash', areas: ['home'], goalIds: ['ch'], uses: 3 }
const dishes: QuickWin = { id: 'd', title: 'Dishes', areas: ['home'], goalIds: ['ch', 'other'], uses: 1 }
const reading: QuickWin = { id: 'r', title: 'Reading', areas: [], goalIds: [], minutes: 120, uses: 0 }
const start = { ...data([chores]), quickWins: [trash, dishes, reading] }

describe("a Routine's tasks, from the Routine", () => {
  it('removes and adds existing repeatable tasks, leaving their other goals alone', () => {
    const d = setRoutineTasks(start, chores, { ids: ['t', 'r'], added: [] })
    expect(tasksIn('ch', d.quickWins).map((q) => q.id)).toEqual(['t', 'r'])
    expect(d.quickWins.find((q) => q.id === 'd')?.goalIds).toEqual(['other'])
  })

  it('makes a new task with the Routine areas, or tags one that already has that name', () => {
    const d = setRoutineTasks(start, chores, { ids: ['t', 'd'], added: [{ title: '  Water plants ', minutes: 10 }, { title: 'reading' }, { title: ' ' }] })
    const plants = d.quickWins.find((q) => q.title === 'Water plants')
    expect(plants).toMatchObject({ areas: ['home'], goalIds: ['ch'], minutes: 10, uses: 0 })
    expect(d.quickWins.filter((q) => q.title.toLowerCase() === 'reading')).toHaveLength(1) // no duplicate
    expect(tasksIn('ch', d.quickWins).map((q) => q.title)).toEqual(['Trash', 'Dishes', 'Reading', 'Water plants'])
  })

  it('moves the target with it from this week, and a removed task keeps counting where it was done', () => {
    const tapped = applyQuickWin(start, 'd', WED)!.data
    const d = syncEachGoals(setRoutineTasks(tapped, chores, { ids: ['t'], added: [] }), WED)
    expect(currentTarget(d.goals[0], WED)).toBe(1)
    expect(eachSteps(d.goals[0], d, MON).map((s) => s.id)).toEqual(['t'])
  })
})
