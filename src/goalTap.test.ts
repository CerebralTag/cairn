import { describe, expect, it } from 'vitest'
import { completeGoal, goalFormStart, goalTapAction, uncompleteGoal } from './goalTap'
import { progressFor } from './goals'
import { SINCE, data, doneWin, guitar, squats, workouts } from './testHelpers'
import type { GoalDef } from './types'

const MON = new Date(2026, 9, 12)
const WED = new Date(2026, 9, 14, 10)
const SUN = new Date(2026, 9, 19)
const single: GoalDef = { id: 'mum', title: 'Call mum', areas: ['family'], kind: 'completion', period: 'week', targets: [{ from: SINCE, amount: 1 }] }

describe('what tapping a goal does', () => {
  const act = (g: GoalDef) => goalTapAction(g, progressFor(g, data([g]), MON))
  it('completes a goal that is one task, and opens the form for the rest', () => {
    expect(act(single)).toBe('complete')
    expect(act({ ...workouts, targets: [{ from: SINCE, amount: 1 }] })).toBe('complete') // a count of one is a task
    expect(act(guitar)).toBe('form')
    expect(act(workouts)).toBe('form')
    expect(act(squats)).toBe('form')
  })
  it('leaves Chores-style goals and rules a form win cannot satisfy alone', () => {
    expect(act({ ...workouts, source: 'each' })).toBeNull()
    expect(act({ ...workouts, source: 'todo' })).toBeNull()
    expect(act({ ...workouts, source: 'quick' })).toBeNull()
    expect(act({ ...workouts, source: 'any' })).toBe('form') // anything finished counts
  })
})

describe('the form a goal opens', () => {
  it('starts with the goal named, its areas, and the goal ticked', () => {
    expect(goalFormStart(guitar)).toEqual({ values: { title: 'Guitar', areas: guitar.areas, goalIds: ['guitar'] }, kind: 'time' })
  })
  it('sets the box to a number for an amount goal, and ticks nothing for a rule goal', () => {
    expect(goalFormStart(squats).kind).toBe('number')
    expect(goalFormStart({ ...guitar, source: 'any' }).values.goalIds).toEqual([])
  })
})

describe('completing and taking back a single-task goal', () => {
  const START = new Date(2026, 9, 12)
  const END = new Date(2026, 9, 19)

  it('completes it, so the goal is met', () => {
    const d = data([single])
    const done = completeGoal(d, single, WED)
    expect(done.data.wins[0]).toMatchObject({ title: 'Call mum', status: 'done', goalIds: ['mum'], areas: ['family'] })
    expect(progressFor(single, done.data, MON)).toMatchObject({ done: 1, met: true })
  })

  it('takes the latest one back, and restore brings it back', () => {
    const done = completeGoal(data([single]), single, WED)
    const back = uncompleteGoal(done.data, single, START, END)!
    expect(back.data.wins).toHaveLength(0)
    expect(progressFor(single, back.data, MON).met).toBe(false)
    expect(back.restore(back.data).wins.map((w) => w.id)).toEqual([done.winId])
    expect(back.restore(back.restore(back.data)).wins).toHaveLength(1) // restoring twice adds nothing
  })

  it('never takes back a to-do or an older week\'s completion', () => {
    const todo = { ...doneWin(WED, { id: 't', title: 'Call mum', goalIds: ['mum'] }), origin: 'todo' as const }
    expect(uncompleteGoal(data([single], [todo]), single, START, END)).toBeNull()
    const last = completeGoal(data([single]), single, new Date(2026, 9, 6, 9))
    expect(uncompleteGoal(last.data, single, START, END)).toBeNull()
    expect(uncompleteGoal(completeGoal(data([single]), single, SUN).data, single, START, END)).toBeNull() // next week
  })
})
