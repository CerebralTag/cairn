import { describe, expect, it } from 'vitest'
import {
  PERIOD_WORDS,
  archivedBefore,
  childrenFor,
  currentTarget,
  goalSource,
  isActive,
  isLinkable,
  linkByArea,
  periodEnd,
  periodStartFor,
  progressFor,
  startOfWeek,
  targetFor,
  withTarget,
} from './goals'
import { SINCE, data, doneWin, guitar, session, todo, workouts } from './testHelpers'
import type { GoalDef } from './types'

// Months are 0-based in JS: new Date(2026, 9, 12) is 12 Oct 2026, a Monday.
const MON = new Date(2026, 9, 12)

describe('startOfWeek', () => {
  it('goes back to Monday midnight', () => {
    expect(startOfWeek(new Date(2026, 9, 17, 14, 30))).toEqual(MON) // Saturday
  })
  it('keeps a Monday, and treats Sunday as the end of the week', () => {
    expect(startOfWeek(new Date(2026, 9, 12, 8))).toEqual(MON)
    expect(startOfWeek(new Date(2026, 9, 18, 23, 59))).toEqual(MON)
  })
})

describe('targetFor', () => {
  const raised: GoalDef = {
    ...guitar,
    targets: [
      { from: new Date(2026, 0, 1), amount: 120 },
      { from: new Date(2026, 9, 1), amount: 180 },
    ],
  }
  it('uses the target in effect at the start of the period', () => {
    expect(targetFor(raised, new Date(2026, 8, 28))).toBe(120)
    expect(targetFor(raised, MON)).toBe(180)
  })
  it('is undefined before the goal existed', () => {
    expect(targetFor(raised, new Date(2025, 5, 1))).toBeUndefined()
  })
})

describe('withTarget', () => {
  const LAST_WEEK = new Date(2026, 9, 5)

  it('applies from this week and leaves earlier weeks on the old target', () => {
    const raised = withTarget(guitar, 180, new Date(2026, 9, 14)) // Wednesday
    expect(targetFor(raised, MON)).toBe(180)
    expect(targetFor(raised, LAST_WEEK)).toBe(120)
  })

  it('replaces, not stacks, when edited twice in the same week', () => {
    const once = withTarget(guitar, 180, new Date(2026, 9, 13))
    const twice = withTarget(once, 150, new Date(2026, 9, 16))
    expect(twice.targets).toHaveLength(2)
    expect(targetFor(twice, MON)).toBe(150)
  })

  it('does not mutate the original goal', () => {
    withTarget(guitar, 999, MON)
    expect(guitar.targets).toHaveLength(1)
  })
})

describe('time goals', () => {
  it('give partial credit: 1h30 of 2h is 75%, not a miss', () => {
    const d = data([guitar], [], [session(MON, 90, { goalIds: ['guitar'] })])
    expect(progressFor(guitar, d, MON)).toEqual({ done: 90, target: 120, fraction: 0.75, met: false })
  })

  it('are met when the sessions add up to the target, however many it takes', () => {
    const d = data(
      [guitar],
      [],
      [
        session(MON, 45, { goalIds: ['guitar'] }),
        session(new Date(2026, 9, 14), 45, { goalIds: ['guitar'] }),
        session(new Date(2026, 9, 16), 30, { goalIds: ['guitar'] }),
      ],
    )
    expect(progressFor(guitar, d, MON)).toMatchObject({ done: 120, met: true })
  })

  it('cap the fraction at 1 but keep the raw amount when over target', () => {
    const d = data([guitar], [], [session(MON, 150, { goalIds: ['guitar'] })])
    const p = progressFor(guitar, d, MON)
    expect(p.fraction).toBe(1)
    expect(p.done).toBe(150)
    expect(p.met).toBe(true)
  })

  it('only count linked entries in the period [Mon, next Mon)', () => {
    const link = { goalIds: ['guitar'] }
    const d = data(
      [guitar],
      [],
      [
        session(new Date(2026, 9, 11, 23, 59), 60, link), // Sunday before: excluded
        session(new Date(2026, 9, 12, 0, 0), 30, link), // Monday 00:00: included
        session(new Date(2026, 9, 18, 23, 59), 30, link), // Sunday night: included
        session(new Date(2026, 9, 19, 0, 0), 60, link), // next Monday: excluded
        session(MON, 60, { areas: ['music'] }), // same area but not linked: excluded
      ],
    )
    expect(progressFor(guitar, d, MON).done).toBe(60)
  })

  it('credit one session to several goals at once', () => {
    const lessons: GoalDef = { ...guitar, id: 'lessons', title: 'Lessons', areas: ['learning'] }
    const d = data([guitar, lessons], [], [session(MON, 60, { goalIds: ['guitar', 'lessons'] })])
    expect(progressFor(guitar, d, MON).done).toBe(60)
    expect(progressFor(lessons, d, MON).done).toBe(60)
  })

  it("inherit a task's goals for sessions attached to it", () => {
    const task = todo({ id: 't1', status: 'doing', goalIds: ['guitar'] })
    const d = data([guitar], [task], [session(MON, 40, { winId: 't1' })])
    expect(progressFor(guitar, d, MON).done).toBe(40)
  })

  it('are not met, and not a divide-by-zero, before the goal existed', () => {
    const d = data([guitar], [], [session(MON, 60, { goalIds: ['guitar'] })])
    expect(progressFor(guitar, d, new Date(2025, 5, 2))).toEqual({ done: 0, target: 0, fraction: 0, met: false })
  })
})

describe('count goals', () => {
  it('count linked wins once, when they were finished', () => {
    const d = data([workouts], [
      doneWin(MON, { goalIds: ['workouts'] }),
      doneWin(new Date(2026, 9, 14), { goalIds: ['workouts'] }),
      doneWin(new Date(2026, 9, 14), { goalIds: [] }), // not linked
      todo({ goalIds: ['workouts'] }), // not finished yet
      todo({ status: 'doing', goalIds: ['workouts'] }),
    ])
    expect(progressFor(workouts, d, MON)).toEqual({ done: 2, target: 2, fraction: 1, met: true })
  })

  it("do not count a task's work sessions, only its completion", () => {
    const task = todo({ id: 't1', status: 'doing', goalIds: ['workouts'] })
    const d = data([workouts], [task], [session(MON, 30, { winId: 't1' })])
    expect(progressFor(workouts, d, MON).done).toBe(0)
  })
})

describe('overarching goals', () => {
  const overall: GoalDef = {
    id: 'overall',
    title: 'Everything',
    areas: [],
    kind: 'completion',
    period: 'week',
    targets: [],
    childIds: ['guitar', 'workouts'],
  }
  const goals = [guitar, workouts, overall]

  it('is met only when ALL children are met', () => {
    const d = data(
      goals,
      [doneWin(MON, { goalIds: ['workouts'] }), doneWin(MON, { goalIds: ['workouts'] })],
      [session(MON, 120, { goalIds: ['guitar'] })],
    )
    expect(progressFor(overall, d, MON)).toMatchObject({ done: 2, target: 2, met: true })
  })

  it('shows average partial credit when some children are unmet', () => {
    const d = data(goals, [], [session(MON, 60, { goalIds: ['guitar'] })]) // guitar 50%, workouts 0%
    const p = progressFor(overall, d, MON)
    expect(p.met).toBe(false)
    expect(p.fraction).toBe(0.25)
    expect(p.done).toBe(0)
  })

  it('lets one goal sit under several overarching goals', () => {
    const other: GoalDef = { ...overall, id: 'other', childIds: ['guitar'] }
    const d = data([guitar, workouts, overall, other], [], [session(MON, 120, { goalIds: ['guitar'] })])
    expect(progressFor(other, d, MON).met).toBe(true)
    expect(progressFor(overall, d, MON).met).toBe(false)
  })
})

describe('linkByArea (backfill for a new goal)', () => {
  const lessons: GoalDef = { id: 'lessons', title: 'Lessons', areas: ['music'], kind: 'count', period: 'week', targets: [] }

  it('links the wins in the goal areas, and leaves the rest', () => {
    const musicWin = doneWin(MON, { id: 'w1', areas: ['music'] })
    const healthWin = doneWin(MON, { id: 'w2', areas: ['health'] })
    const standalone = session(MON, 30, { areas: ['music'] })
    const attached = session(MON, 30, { winId: 'w1' })
    const result = linkByArea(lessons, data([guitar, lessons], [musicWin, healthWin], [standalone, attached]))

    expect(result.wins.find((w) => w.id === 'w1')?.goalIds).toEqual(['lessons'])
    expect(result.wins.find((w) => w.id === 'w2')?.goalIds).toEqual([])
    // Minutes only matter to time goals, so a count goal leaves standalone entries alone.
    expect(result.timeEntries.find((e) => e.id === standalone.id)?.goalIds).toEqual([])
    // attached entries inherit from their task instead
    expect(result.timeEntries.find((e) => e.id === attached.id)?.goalIds).toEqual([])
  })

  it('does not double-link a win that already has the goal', () => {
    const w = doneWin(MON, { areas: ['music'], goalIds: ['lessons'] })
    expect(linkByArea(lessons, data([lessons], [w])).wins[0].goalIds).toEqual(['lessons'])
  })
})

describe('periods', () => {
  const WED = new Date(2026, 9, 14, 15, 30)

  it('finds the start and end of a day, week and month', () => {
    expect(periodStartFor('day', WED)).toEqual(new Date(2026, 9, 14))
    expect(periodEnd('day', new Date(2026, 9, 14))).toEqual(new Date(2026, 9, 15))
    expect(periodStartFor('week', WED)).toEqual(MON)
    expect(periodEnd('week', MON)).toEqual(new Date(2026, 9, 19))
    expect(periodStartFor('month', WED)).toEqual(new Date(2026, 9, 1))
    expect(periodEnd('month', new Date(2026, 9, 1))).toEqual(new Date(2026, 10, 1))
    expect(periodEnd('month', new Date(2026, 11, 1))).toEqual(new Date(2027, 0, 1)) // December rolls the year
  })

  it('judges a daily goal on one day only', () => {
    const daily: GoalDef = { ...guitar, id: 'd', period: 'day', targets: [{ from: SINCE, amount: 30 }] }
    const d = data([daily], [], [
      session(new Date(2026, 9, 14, 9), 20, { goalIds: ['d'] }),
      session(new Date(2026, 9, 14, 21), 10, { goalIds: ['d'] }),
      session(new Date(2026, 9, 15, 9), 60, { goalIds: ['d'] }), // next day: excluded
    ])
    expect(progressFor(daily, d, new Date(2026, 9, 14))).toMatchObject({ done: 30, met: true })
    expect(progressFor(daily, d, new Date(2026, 9, 13)).done).toBe(0)
  })

  it('judges a monthly goal across the whole month', () => {
    const monthly: GoalDef = { ...guitar, id: 'm', period: 'month', targets: [{ from: SINCE, amount: 600 }] }
    const d = data([monthly], [], [
      session(new Date(2026, 9, 1, 8), 300, { goalIds: ['m'] }),
      session(new Date(2026, 9, 31, 22), 300, { goalIds: ['m'] }),
      session(new Date(2026, 10, 1, 0, 0), 99, { goalIds: ['m'] }), // November: excluded
    ])
    expect(progressFor(monthly, d, new Date(2026, 9, 1))).toMatchObject({ done: 600, met: true })
  })

  it('applies a target change from the start of the goal\'s own period', () => {
    const monthly: GoalDef = { ...guitar, period: 'month', targets: [{ from: SINCE, amount: 600 }] }
    const raised = withTarget(monthly, 900, WED)
    expect(targetFor(raised, new Date(2026, 9, 1))).toBe(900)
    expect(targetFor(raised, new Date(2026, 8, 1))).toBe(600)
    expect(currentTarget(raised, WED)).toBe(900)
  })

  it('keeps period words for the UI', () => {
    expect(PERIOD_WORDS.day.this).toBe('today')
    expect(PERIOD_WORDS.month.per).toBe('per month')
  })
})

describe('archived goals', () => {
  const archivedOn = new Date(2026, 9, 14) // Wednesday of the week starting Oct 12
  const archived: GoalDef = { ...guitar, archivedAt: archivedOn }
  const entries = [
    session(new Date(2026, 9, 6), 60, { goalIds: ['guitar'] }), // week of Oct 5
    session(new Date(2026, 9, 13), 60, { goalIds: ['guitar'] }), // week of Oct 12
    session(new Date(2026, 9, 20), 60, { goalIds: ['guitar'] }), // week of Oct 19
  ]
  const d = data([archived], [], entries)

  it('keeps results for periods that began before archiving, including the partial one', () => {
    expect(progressFor(archived, d, new Date(2026, 9, 5)).done).toBe(60)
    expect(progressFor(archived, d, MON).done).toBe(60)
  })

  it('has no periods from the archive date onward', () => {
    expect(progressFor(archived, d, new Date(2026, 9, 19))).toEqual({ done: 0, target: 0, fraction: 0, met: false })
  })

  it('is excluded from an overarching goal in later periods only', () => {
    const other: GoalDef = { ...workouts }
    const overall: GoalDef = {
      id: 'overall', title: 'All', areas: [], kind: 'completion', period: 'week', targets: [], childIds: ['guitar', 'workouts'],
    }
    const dd = data([archived, other, overall], [doneWin(new Date(2026, 9, 20), { goalIds: ['workouts'] }), doneWin(new Date(2026, 9, 21), { goalIds: ['workouts'] })], entries)
    // Before archiving, guitar still counts as a child, and it is unmet at 60/120.
    expect(progressFor(overall, dd, MON).target).toBe(2)
    // Afterwards only workouts remains.
    expect(progressFor(overall, dd, new Date(2026, 9, 19))).toMatchObject({ target: 1, met: true })
  })

  it('reports whether a goal is active', () => {
    expect(isActive(guitar)).toBe(true)
    expect(isActive(archived)).toBe(false)
  })
})

describe('childrenFor (the one rule the math and the Today card share)', () => {
  const archivedOn = new Date(2026, 9, 14) // Wednesday of the week starting Oct 12
  const archivedChild: GoalDef = { ...workouts, archivedAt: archivedOn }
  const overall: GoalDef = {
    id: 'overall', title: 'All', areas: [], kind: 'completion', period: 'week', targets: [], childIds: ['guitar', 'workouts', 'gone'],
  }
  const all = [guitar, archivedChild, overall]

  it('includes a child archived DURING the period: that period keeps its result', () => {
    expect(childrenFor(overall, all, MON).map((g) => g.id)).toEqual(['guitar', 'workouts'])
  })

  it('drops a child from the first period that starts after it was archived, and ids that no longer exist', () => {
    expect(childrenFor(overall, all, new Date(2026, 9, 19)).map((g) => g.id)).toEqual(['guitar'])
  })

  it('agrees with progressFor about how many goals are being counted', () => {
    const d = data(all, [], [session(MON, 120, { goalIds: ['guitar'] })])
    expect(progressFor(overall, d, MON).target).toBe(childrenFor(overall, all, MON).length)
    expect(progressFor(overall, d, new Date(2026, 9, 19)).target).toBe(childrenFor(overall, all, new Date(2026, 9, 19)).length)
  })

  it('says whether a goal was archived before a period began', () => {
    expect(archivedBefore(archivedChild, MON)).toBe(false)
    expect(archivedBefore(archivedChild, new Date(2026, 9, 19))).toBe(true)
  })
})

describe('linkByArea for amount and time goals', () => {
  const squatsGoal: GoalDef = { id: 'squats', title: 'Squats', areas: ['health'], kind: 'amount', period: 'week', targets: [] }
  const walk = doneWin(MON, { id: 'walk', title: 'Walk', areas: ['health'] })
  const gym = doneWin(MON, { id: 'gym', title: 'Gym', areas: ['health'] })
  const squatWin = { ...doneWin(MON, { id: 'sq', title: 'Squats', areas: ['health'] }), amount: 20 }

  it('only links wins that have an amount to an amount goal, so unrelated wins are not counted as 1', () => {
    const d = data([squatsGoal], [walk, gym, squatWin])
    const linked = { ...d, ...linkByArea({ ...squatsGoal, targets: [{ from: MON, amount: 100 }] }, d) }
    expect(linked.wins.find((w) => w.id === 'walk')?.goalIds).toEqual([])
    expect(linked.wins.find((w) => w.id === 'gym')?.goalIds).toEqual([])
    expect(linked.wins.find((w) => w.id === 'sq')?.goalIds).toEqual(['squats'])
    expect(progressFor({ ...squatsGoal, targets: [{ from: MON, amount: 100 }] }, linked, MON).done).toBe(20)
  })

  it('links standalone time entries only for time goals', () => {
    const entry = session(MON, 30, { areas: ['health'] })
    const d = data([squatsGoal, { ...guitar, areas: ['health'] }], [], [entry])
    expect(linkByArea(squatsGoal, d).timeEntries[0].goalIds).toEqual([])
    expect(linkByArea({ ...guitar, areas: ['health'] }, d).timeEntries[0].goalIds).toEqual(['guitar'])
  })
})

describe('goals that count by a rule instead of by tags', () => {
  const NEXT_MON = new Date(2026, 9, 19)
  const rule = (kind: 'count' | 'time' | 'amount', source: 'any' | 'todo' | 'quick'): GoalDef => ({
    id: 'g', title: 'g', areas: [], kind, period: 'week', source, targets: [{ from: SINCE, amount: 10 }],
  })
  const wins = [
    doneWin(MON, { origin: 'todo', title: 'planned and finished' }),
    doneWin(MON, { origin: 'quick', quickWinId: 'q', title: 'quick tap' }),
    doneWin(MON, { origin: 'logged', title: 'logged after the fact' }),
    doneWin(MON, { title: 'saved before origins existed' }),
    { ...todo({ title: 'not finished' }), origin: 'todo' as const },
    { ...doneWin(MON, { origin: 'todo' }), status: 'dropped' as const },
    doneWin(NEXT_MON, { origin: 'todo', title: 'next week' }),
  ]

  it('"anything I finish" counts every finished task, tagged or not, in the period it finished', () => {
    expect(progressFor(rule('count', 'any'), data([rule('count', 'any')], wins), MON).done).toBe(4)
  })

  it('"to-dos I finish" counts only tasks that started as to-dos', () => {
    expect(progressFor(rule('count', 'todo'), data([], wins), MON).done).toBe(1)
  })

  it('"quick wins I tap" counts only quick-win taps', () => {
    expect(progressFor(rule('count', 'quick'), data([], wins), MON).done).toBe(1)
  })

  it('never count an unfinished, reopened or dropped task, and move with the completion date', () => {
    expect(progressFor(rule('count', 'any'), data([], wins), NEXT_MON).done).toBe(1)
  })

  it('"all the time I log" adds up every time entry in the period, linked or not', () => {
    const d = data([], [], [
      session(MON, 30), // linked to nothing
      session(new Date(2026, 9, 14), 45, { goalIds: ['guitar'] }),
      session(new Date(2026, 9, 11, 23, 59), 60), // the Sunday before: another week
      session(NEXT_MON, 60), // next week
    ])
    expect(progressFor(rule('time', 'any'), d, MON).done).toBe(75)
  })

  it('amount goals can add up the amounts of every finished task', () => {
    const d = data([], [{ ...doneWin(MON), amount: 10 }, doneWin(MON), { ...doneWin(MON), amount: 5 }])
    expect(progressFor(rule('amount', 'any'), d, MON).done).toBe(16) // 10 + 1 (no amount) + 5
  })

  it('leave a plain goal alone: no source means tagged wins only', () => {
    const plain = { ...rule('count', 'any'), source: undefined }
    expect(goalSource(plain)).toBe('linked')
    const d = data([plain], [doneWin(MON), doneWin(MON, { goalIds: ['g'] })])
    expect(progressFor(plain, d, MON).done).toBe(1)
  })

  it('are not offered for tagging, and the backfill never touches them', () => {
    expect(isLinkable({ ...rule('count', 'any'), areas: ['health'] })).toBe(false)
    expect(isLinkable({ ...rule('count', 'any'), source: undefined })).toBe(true)
    const d = data([], [doneWin(MON, { areas: ['health'] })], [session(MON, 20, { areas: ['health'] })])
    const result = linkByArea({ ...rule('time', 'any'), areas: ['health'] }, d)
    expect(result.wins[0].goalIds).toEqual([])
    expect(result.timeEntries[0].goalIds).toEqual([])
  })

  it('work inside an overarching goal like any other child', () => {
    const child = rule('count', 'any')
    const overall: GoalDef = { id: 'all', title: 'All', areas: [], kind: 'completion', period: 'week', targets: [], childIds: ['g'] }
    const d = data([child, overall], Array.from({ length: 10 }, () => doneWin(MON, { origin: 'logged' })))
    expect(progressFor(overall, d, MON)).toMatchObject({ done: 1, target: 1, met: true })
  })
})
