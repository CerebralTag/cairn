import { describe, expect, it } from 'vitest'
import { EXTRA_LAP_MINUTES, OTHER_KEY, areaCards, areaExtra, areasColour, goalColourFor, goalDisplay, ringCentre, todayGoals } from './todayAreas'
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
    expect(music).toMatchObject({ total: 0, met: 0, fraction: 1, goals: [] })
  })

  it('counts only goals: to-dos assigned to the area do not change its ring', () => {
    const open = { ...todo({ id: 'a', title: 'Fix shelf', areas: ['music'] }), origin: 'todo' as const }
    const done = { ...doneWin(WED, { id: 'b', title: 'Tune up', areas: ['music'] }), origin: 'todo' as const }
    const [music] = areaCards(withAreas(data([], [open, done])), WED)
    expect(music).toMatchObject({ total: 0, met: 0, fraction: 1, goals: [] })
    expect('tasks' in music).toBe(false)
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

  it('leaves out the Other ring when it is switched off', () => {
    const loose: GoalDef = { ...squats, areas: [] }
    expect(areaCards({ ...withAreas(data([loose])), otherOnToday: false }, WED).some((c) => c.key === OTHER_KEY)).toBe(false)
    expect(areaCards(withAreas(data([loose])), WED).some((c) => c.key === OTHER_KEY)).toBe(true)
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
      { id: 'dishes', title: 'dishes', areas: [], count: 1, need: 1, unit: 'taps', done: true },
      { id: 'bins', title: 'bins', areas: [], count: 0, need: 1, unit: 'taps', done: false },
    ])
  })
})

describe('todayGoals', () => {
  it('lists every active goal, even with no area or in an area that has no ring', () => {
    const noArea: GoalDef = { ...squats, areas: [] }
    const offArea: GoalDef = { ...workouts, areas: ['work'] } // work is switched off
    const d = { ...withAreas(data([noArea, offArea, guitar])), otherOnToday: false }
    expect(todayGoals(d, WED).map((i) => i.goal.id).sort()).toEqual(['guitar', 'squats', 'workouts'])
  })

  it('keeps goals of one area together, in area order, with no-area goals last', () => {
    const health: GoalDef = { ...workouts, id: 'h', areas: ['health'] }
    const music: GoalDef = { ...guitar, id: 'm', areas: ['music'] }
    const none: GoalDef = { ...squats, id: 'n', areas: [] }
    expect(todayGoals(withAreas(data([none, health, music])), WED).map((i) => i.goal.id)).toEqual(['m', 'h', 'n'])
  })

  it('leaves out archived and overarching goals', () => {
    const archived: GoalDef = { ...guitar, id: 'x', archivedAt: SINCE }
    const overall: GoalDef = { id: 'o', title: 'O', areas: [], kind: 'completion', period: 'week', targets: [], childIds: ['guitar'] }
    expect(todayGoals(withAreas(data([archived, overall])), WED)).toEqual([])
  })
})

describe('goalColourFor', () => {
  it('uses the first area that exists, else neutral grey', () => {
    const areas = withAreas(data([])).areas
    expect(goalColourFor(areas, { ...guitar, areas: ['gone', 'health'] })).toBe('var(--palette-2)')
    expect(goalColourFor(areas, { ...guitar, areas: [] })).toBe('var(--color-bead-neutral)')
  })
})

describe('ringCentre', () => {
  it('shows the number of goals until one is met, then met/total, then a tick', () => {
    expect(ringCentre(0, 2)).toBe('2')
    expect(ringCentre(0, 1)).toBe('1')
    expect(ringCentre(1, 2)).toBe('1/2')
    expect(ringCentre(1, 1)).toBe('✓')
    expect(ringCentre(2, 2)).toBe('✓')
  })
  it('never shows a zero: an area with no goals owes nothing', () => {
    expect(ringCentre(0, 0)).toBe('✓')
    for (const [m, t] of [[0, 1], [0, 3], [1, 3], [3, 3], [0, 0]]) expect(ringCentre(m, t)).not.toMatch(/0/)
  })
})

describe('a Routine kept as a container', () => {
  const box: GoalDef = { id: 'box', title: 'Evening', areas: [], kind: 'count', period: 'week', source: 'each', tracked: false, targets: [{ from: SINCE, amount: 2 }] }
  const tracked: GoalDef = { ...box, id: 'tr', title: 'Chores', tracked: undefined, areas: ['music'] }

  it('feeds no ring, but still shows on Today for logging', () => {
    const d = withAreas(data([box, tracked]))
    expect(areaCards(d, WED).flatMap((c) => c.goals.map((g) => g.goal.id))).toEqual(['tr'])
    expect(todayGoals(d, WED).map((i) => i.goal.id).sort()).toEqual(['box', 'tr'])
  })

  it('is not an Other-ring goal either', () => {
    const d = { ...withAreas(data([box])), areas: [] }
    expect(areaCards(d, WED)).toEqual([])
  })
})

describe('areasColour', () => {
  it('is the colour of the first area that exists, else null (so a caller can fall back)', () => {
    const areas = withAreas(data([])).areas
    expect(areasColour(areas, ['gone', 'health'])).toBe('var(--palette-2)')
    expect(areasColour(areas, [])).toBeNull()
    expect(areasColour(areas, ['gone'])).toBeNull()
  })
})

describe('the outer ring: extra effort in an area outside its goals', () => {
  const NOW = new Date(2026, 9, 14, 12)
  const goalA: GoalDef = { ...guitar, id: 'ga', areas: ['music'] }
  const goalB: GoalDef = { ...guitar, id: 'gb', areas: ['music'] }
  const extra = (d: ReturnType<typeof data>, goals: GoalDef[]) => areaExtra(d, 'music', goals, NOW)

  it('counts time in the area that no goal of it counted, at a lap per four hours', () => {
    const d = data([goalA], [], [session(new Date(2026, 9, 13, 9), 60, { areas: ['music'] }), session(new Date(2026, 9, 13, 10), 120, { areas: ['music'], goalIds: ['ga'] })])
    const e = extra(d, [goalA])
    expect(e.minutes).toBe(60) // the 120 minutes counted toward its goal
    expect(e.laps).toBeCloseTo(60 / EXTRA_LAP_MINUTES)
  })

  it('counts a finished win in the area outside its goals as a goal-sized share of the ring', () => {
    const win = doneWin(new Date(2026, 9, 13, 9), { areas: ['music'] })
    expect(extra(data([goalA, goalB], [win]), [goalA, goalB])).toMatchObject({ items: 1, laps: 0.5 }) // 1 of 2 goals
    expect(extra(data([], [win]), [])).toMatchObject({ items: 1, laps: 0.25 }) // no goals: a quarter
  })

  it('leaves out what a goal in the area counted, other weeks, other areas, and unfinished tasks', () => {
    const inGoal = doneWin(new Date(2026, 9, 13, 9), { areas: ['music'], goalIds: ['ga'] })
    const lastWeek = doneWin(new Date(2026, 9, 6, 9), { areas: ['music'] })
    const elsewhere = doneWin(new Date(2026, 9, 13, 9), { areas: ['health'] })
    const open = todo({ areas: ['music'] })
    expect(extra(data([goalA], [inGoal, lastWeek, elsewhere, open]), [goalA])).toMatchObject({ items: 0, minutes: 0, laps: 0 })
  })

  it('counts time on a task the same way: in its goal or not', () => {
    const inside = { ...todo({ id: 't1', areas: ['music'], goalIds: ['ga'] }) }
    const outside = todo({ id: 't2', areas: ['music'] })
    const d = data([goalA], [inside, outside], [session(new Date(2026, 9, 13, 9), 30, { winId: 't1' }), session(new Date(2026, 9, 13, 10), 45, { winId: 't2' })])
    expect(extra(d, [goalA]).minutes).toBe(45)
  })

  it('is nothing when a goal in the area counts anything', () => {
    const anyTime: GoalDef = { ...goalA, source: 'any' }
    const d = data([anyTime], [doneWin(new Date(2026, 9, 13, 9), { areas: ['music'] })], [session(new Date(2026, 9, 13, 9), 90, { areas: ['music'] })])
    expect(extra(d, [anyTime]).minutes).toBe(0)
    const anyCount: GoalDef = { ...workouts, id: 'gc', areas: ['music'], source: 'any' }
    expect(extra(data([anyCount], [doneWin(new Date(2026, 9, 13, 9), { areas: ['music'] })]), [anyCount]).items).toBe(0)
  })

  it('shows up on the area card, and goals with no area never have any', () => {
    const d = { ...withAreas(data([goalA], [], [session(new Date(2026, 9, 13, 9), 120, { areas: ['music'] })])) }
    expect(areaCards(d, NOW).find((c) => c.key === 'music')?.extra).toBeCloseTo(0.5)
    const loose: GoalDef = { ...squats, areas: [] }
    expect(areaCards(withAreas(data([loose], [], [session(new Date(2026, 9, 13, 9), 120)])), NOW).find((c) => c.key === OTHER_KEY)?.extra).toBe(0)
  })
})
