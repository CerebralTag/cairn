import { describe, expect, it } from 'vitest'
import { eachSteps, progressFor, syncEachGoals, currentTarget } from './goals'
import { withStatus } from './manage'
import { applyQuickWin } from './quickWins'
import { setRoutineTasks, tasksIn, todoChoices } from './routineTasks'
import { SINCE, data, todo } from './testHelpers'
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

describe('to-dos in a Routine', () => {
  const NEXT_MON = new Date(2026, 9, 19)
  const fix = { ...todo({ id: 'f', title: 'Fix the gate' }), origin: 'todo' as const }
  const other = { ...todo({ id: 'o', title: 'Call the bank' }), origin: 'todo' as const }
  const base = { ...data([{ ...chores, targets: [{ from: SINCE, amount: 1 }] }], [fix, other]), quickWins: [trash] }
  const withFix = syncEachGoals(setRoutineTasks(base, chores, { ids: ['t'], added: [], todoIds: ['f'] }), WED)

  it('are added and taken out from the Routine, and count toward its target', () => {
    expect(withFix.wins.find((w) => w.id === 'f')?.goalIds).toEqual(['ch'])
    expect(withFix.wins.find((w) => w.id === 'o')?.goalIds).toEqual([])
    expect(currentTarget(withFix.goals[0], WED)).toBe(2)
    const out = setRoutineTasks(withFix, chores, { ids: ['t'], added: [], todoIds: [] })
    expect(out.wins.find((w) => w.id === 'f')?.goalIds).toEqual([])
    expect(setRoutineTasks(withFix, chores, { ids: ['t'], added: [] }).wins).toBe(withFix.wins) // no choice given: left alone
  })

  it('show as a step, done once finished and still done the next week, but not before', () => {
    expect(eachSteps(withFix.goals[0], withFix, MON).find((s) => s.id === 'f')).toMatchObject({ todo: true, done: false })
    const done = { ...withFix, wins: withFix.wins.map((w) => (w.id === 'f' ? withStatus(w, 'done', WED) : w)) }
    expect(eachSteps(done.goals[0], done, MON).find((s) => s.id === 'f')?.done).toBe(true)
    expect(eachSteps(done.goals[0], done, NEXT_MON).find((s) => s.id === 'f')?.done).toBe(true)
    expect(eachSteps(done.goals[0], done, new Date(2026, 9, 5)).find((s) => s.id === 'f')?.done).toBe(false)
    expect(progressFor(done.goals[0], done, MON)).toMatchObject({ done: 1, target: 2 })
  })

  it('leave the Routine when dropped, and only open ones (or its own) are offered', () => {
    const dropped = syncEachGoals({ ...withFix, wins: withFix.wins.map((w) => (w.id === 'f' ? { ...w, status: 'dropped' as const } : w)) }, WED)
    expect(currentTarget(dropped.goals[0], WED)).toBe(1)
    const doneElsewhere = { ...other, id: 'x', status: 'done' as const, completedAt: WED }
    const doneHere = { ...fix, status: 'done' as const, completedAt: WED, goalIds: ['ch'] }
    expect(todoChoices('ch', [other, doneElsewhere, doneHere]).map((w) => w.id)).toEqual(['o', 'f'])
  })
})
