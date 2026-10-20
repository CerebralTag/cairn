import { describe, expect, it } from 'vitest'
import { OTHER_KEY, areaCards, goalDisplay } from './todayAreas'
import { eachSteps } from './goals'
import { SINCE, data, doneWin, guitar, session, squats, todo, workouts } from './testHelpers'
import type { GoalDef, QuickWin } from './types'

const MON = new Date(2026, 9, 12)
const WED = new Date(2026, 9, 14, 10)
const AREAS = [
  { id: 'music', name: 'Music', colour: 1 },
  { id: 'health', name: 'Health', colour: 2 },
  { id: 'work', name: 'Work', colour: 3, onToday: false },
]
const withAreas = (d: ReturnType<typeof data>) => ({ ...d, areas: AREAS })

describe('areaCards', () => {
  it('gives each area with goals a card, with its goals and how many are met', () => {
    // guitar (music, time, 120m) is met by 120m; workouts (health, count) is not
    const d = withAreas(data([guitar, workouts], [], [session(WED, 120, { goalIds: ['guitar'] })]))
    const cards = areaCards(d, WED)
    expect(cards.map((c) => c.key)).toEqual(['music', 'health'])
    expect(cards[0]).toMatchObject({ name: 'Music', met: 1, fraction: 1 })
    expect(cards[1]).toMatchObject({ name: 'Health', met: 0, fraction: 0 })
    expect(cards[0].colour).toBe('var(--palette-1)')
  })

  it('averages the goals\' progress for the ring', () => {
    const a: GoalDef = { ...guitar, id: 'a', areas: ['music'] }
    const b: GoalDef = { ...guitar, id: 'b', areas: ['music'] }
    const d = withAreas(data([a, b], [], [session(WED, 120, { goalIds: ['a'] })])) // a full, b empty
    expect(areaCards(d, WED)[0].fraction).toBeCloseTo(0.5)
  })

  it('gives every area switched on a ring, and none to one switched off', () => {
    const d = withAreas(data([{ ...guitar, areas: ['work'] }]))
    expect(areaCards(d, WED).map((c) => c.key)).toEqual(['music', 'health']) // work is off
    expect(areaCards({ ...d, areas: [{ id: 'work', name: 'Work', colour: 3 }] }, WED).map((c) => c.key)).toEqual(['work'])
  })

  it('an area with nothing assigned is complete and reads 0/0', () => {
    const [music] = areaCards(withAreas(data([])), WED)
    expect(music).toMatchObject({ total: 0, met: 0, fraction: 1, goals: [], tasks: [] })
  })

  it('counts to-dos assigned to the area: open ones are not done, ones finished this week are', () => {
    const open = todo({ id: 'a', title: 'Fix shelf', areas: ['music'] })
    const done = { ...doneWin(WED, { id: 'b', title: 'Tune up', areas: ['music'] }), origin: 'todo' as const }
    const old = { ...doneWin(new Date(2026, 9, 1), { id: 'c', areas: ['music'] }), origin: 'todo' as const }
    const dropped = { ...todo({ id: 'd', areas: ['music'] }), status: 'dropped' as const }
    const other = todo({ id: 'e', areas: ['health'] })
    const d = withAreas(data([], [{ ...open, origin: 'todo' as const }, done, old, dropped, { ...other, origin: 'todo' as const }]))
    const [music] = areaCards(d, WED)
    expect(music.tasks).toEqual([
      { id: 'a', title: 'Fix shelf', done: false },
      { id: 'b', title: 'Tune up', done: true },
    ])
    expect(music).toMatchObject({ total: 2, met: 1, fraction: 0.5 })
  })

  it('shows a goal under every area it is labelled with', () => {
    const both: GoalDef = { ...guitar, areas: ['music', 'health'] }
    expect(areaCards(withAreas(data([both])), WED).map((c) => c.goals.length)).toEqual([1, 1])
  })

  it('keeps goals with no area together so none disappear, named by whether areas exist', () => {
    const loose: GoalDef = { ...squats, areas: [] }
    const orphan: GoalDef = { ...workouts, areas: ['gone'] }
    const cards = areaCards(withAreas(data([loose, orphan])), WED)
    const other = cards.find((c) => c.key === OTHER_KEY)!
    expect(other).toMatchObject({ name: 'Other', total: 2 })
    expect(cards.at(-1)).toBe(other)
    expect(areaCards({ ...data([loose]), areas: [] }, WED)[0].name).toBe('Goals')
  })

  it('leaves out archived goals and overarching goals', () => {
    const archived: GoalDef = { ...guitar, archivedAt: SINCE }
    const overall: GoalDef = { id: 'o', title: 'O', areas: ['music'], kind: 'completion', period: 'week', targets: [], childIds: ['guitar'] }
    expect(areaCards(withAreas(data([archived, overall])), WED).flatMap((c) => c.goals)).toEqual([])
  })
})

describe('how a goal row is drawn', () => {
  const p = (target: number) => ({ done: 0, target, fraction: 0, met: false })
  it('uses a bar for time and amount goals', () => {
    expect(goalDisplay(guitar, p(120))).toBe('bar')
    expect(goalDisplay(squats, p(3))).toBe('bar') // amount goal
  })
  it('lists just the name for a single task', () => {
    expect(goalDisplay({ ...workouts, kind: 'completion' }, p(1))).toBe('task')
    expect(goalDisplay(workouts, p(1))).toBe('task') // a count of one is just a task
  })
  it('uses bubbles for small counts, a bar for big ones', () => {
    expect(goalDisplay(workouts, p(3))).toBe('bubbles')
    expect(goalDisplay(workouts, p(6))).toBe('bubbles')
    expect(goalDisplay(workouts, p(7))).toBe('bar')
  })
  it('uses a labelled bubble per task for an each goal', () => {
    expect(goalDisplay({ ...workouts, source: 'each' }, p(4))).toBe('steps')
  })
})

describe('eachSteps', () => {
  const chores: GoalDef = { id: 'c', title: 'Chores', areas: [], kind: 'count', period: 'week', source: 'each', targets: [{ from: SINCE, amount: 1 }] }
  const q = (id: string): QuickWin => ({ id, title: id, areas: [], goalIds: ['c'], uses: 0 })
  it('lists each tagged task and whether it was done this period', () => {
    const d = { ...data([chores], [doneWin(WED, { origin: 'quick', quickWinId: 'dishes', goalIds: ['c'] })]), quickWins: [q('dishes'), q('bins')] }
    expect(eachSteps(chores, d, MON)).toEqual([
      { id: 'dishes', title: 'dishes', done: true },
      { id: 'bins', title: 'bins', done: false },
    ])
  })
})
