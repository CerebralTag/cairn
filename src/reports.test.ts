import { describe, expect, it } from 'vitest'
import {
  activityFor,
  bestStretch,
  OTHER_AREA,
  byArea,
  customRange,
  dailyTotals,
  dayRange,
  doneWinsInRange,
  goalHistory,
  logEntries,
  monthRange,
  soFarLabel,
  totalsFor,
  weekRange,
  yearRange,
} from './reports'
import { data, doneWin, guitar, session, todo } from './testHelpers'

// Months are 0-based: new Date(2026, 8, 27) is 27 Sep 2026.

describe('ranges', () => {
  it('dayRange covers one calendar day', () => {
    const r = dayRange(new Date(2026, 8, 27, 15, 30))
    expect(r.start).toEqual(new Date(2026, 8, 27))
    expect(r.end).toEqual(new Date(2026, 8, 28))
  })

  it('customRange includes both end days: Sep 27-29 is three days', () => {
    const r = customRange(new Date(2026, 8, 27, 18), new Date(2026, 8, 29, 6))
    expect(r.start).toEqual(new Date(2026, 8, 27))
    expect(r.end).toEqual(new Date(2026, 8, 30))
    expect(dailyTotals(data([]), r)).toHaveLength(3)
  })

  it('weekRange is Monday to next Monday', () => {
    const r = weekRange(new Date(2026, 9, 17))
    expect(r.start).toEqual(new Date(2026, 9, 12))
    expect(r.end).toEqual(new Date(2026, 9, 19))
  })

  it('monthRange and yearRange roll over correctly', () => {
    expect(monthRange(new Date(2026, 11, 25)).end).toEqual(new Date(2027, 0, 1))
    expect(monthRange(new Date(2026, 1, 10))).toEqual({ start: new Date(2026, 1, 1), end: new Date(2026, 2, 1) })
    expect(yearRange(new Date(2026, 5, 1)).end).toEqual(new Date(2027, 0, 1))
  })
})

describe('doneWinsInRange', () => {
  it('uses completion time: includes the start instant, excludes the end, skips unfinished', () => {
    const r = dayRange(new Date(2026, 8, 27))
    const wins = [
      doneWin(new Date(2026, 8, 26, 23, 59)), // yesterday
      doneWin(new Date(2026, 8, 27, 0, 0)), // start: in
      doneWin(new Date(2026, 8, 27, 23, 59)), // in
      doneWin(new Date(2026, 8, 28, 0, 0)), // end: out
      todo(), // no completion time: never reported
    ]
    expect(doneWinsInRange(wins, r)).toHaveLength(2)
  })
})

describe('totalsFor and byArea', () => {
  const r = customRange(new Date(2026, 8, 27), new Date(2026, 8, 29))
  const d = data(
    [guitar],
    [
      doneWin(new Date(2026, 8, 27, 9), { id: 'w1', goalIds: ['guitar'] }), // area via goal: music
      doneWin(new Date(2026, 8, 29, 7), { areas: ['health'] }),
      doneWin(new Date(2026, 8, 30, 9)), // outside range
    ],
    [
      session(new Date(2026, 8, 27, 9), 30, { winId: 'w1' }), // inherits music from its task
      session(new Date(2026, 8, 27, 20), 45, { goalIds: ['guitar'] }),
      session(new Date(2026, 8, 28, 20), 15), // no links at all
    ],
  )

  it('counts wins, sums all minutes, and counts distinct active days', () => {
    expect(totalsFor(d, r)).toEqual({ count: 2, minutes: 90, activeDays: 3 })
  })

  it('credits records to their effective areas; time with no area at all goes to Other, last', () => {
    expect(byArea(d, r)).toEqual([
      { area: 'music', count: 1, minutes: 75 },
      { area: 'health', count: 1, minutes: 0 },
      { area: OTHER_AREA, count: 0, minutes: 15 }, // the session with no links at all
    ])
  })

  it('puts a finished win with no area under Other as well', () => {
    const loose = data([], [doneWin(new Date(2026, 8, 27, 10))], [])
    expect(byArea(loose, r)).toEqual([{ area: OTHER_AREA, count: 1, minutes: 0 }])
  })

  it('credits a record with several areas to each of them', () => {
    const multi = data([], [doneWin(new Date(2026, 8, 27), { areas: ['music', 'learning'] })], [])
    expect(byArea(multi, r).map((a) => a.area).sort()).toEqual(['learning', 'music'])
  })
})

describe('dailyTotals and bestStretch', () => {
  const r = customRange(new Date(2026, 8, 27), new Date(2026, 9, 2)) // 6 days
  const d = data(
    [],
    [
      doneWin(new Date(2026, 8, 27, 10)),
      doneWin(new Date(2026, 8, 28, 10)),
      // Sep 29 quiet
      doneWin(new Date(2026, 8, 30, 10)),
      doneWin(new Date(2026, 9, 1, 10)),
      doneWin(new Date(2026, 9, 1, 18)),
      todo({ id: 'big', status: 'doing' }),
    ],
    [
      // working on an unfinished task counts as a day of activity, once per task per day
      session(new Date(2026, 9, 2, 9), 30, { winId: 'big' }),
      session(new Date(2026, 9, 2, 15), 30, { winId: 'big' }),
    ],
  )
  const days = dailyTotals(d, r)

  it('has a row for every day, including empty ones; a task counts once per day', () => {
    expect(days.map((x) => x.count)).toEqual([1, 1, 0, 1, 2, 1])
    expect(days[5].minutes).toBe(60)
  })

  it('finds the best stretch of consecutive active days', () => {
    expect(bestStretch(days)).toBe(3)
  })

  it('is 0 when nothing was logged', () => {
    expect(bestStretch(dailyTotals(data([]), r))).toBe(0)
  })
})

describe('activityFor', () => {
  const day = dayRange(new Date(2026, 8, 27))
  const at = (h: number) => new Date(2026, 8, 27, h)

  it('folds a finished task and its sessions into one item', () => {
    const d = data([], [doneWin(at(12), { id: 'w1', title: 'Learn song' })], [
      session(at(9), 30, { winId: 'w1' }),
      session(at(10), 20, { winId: 'w1' }),
    ])
    const items = activityFor(d, day)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'win', title: 'Learn song', minutes: 50 })
  })

  it('shows work on an unfinished task as progress, once, and standalone time as its own item', () => {
    const d = data([], [todo({ id: 't1', status: 'doing', title: 'Big task' })], [
      session(at(8), 15, { winId: 't1' }),
      session(at(9), 15, { winId: 't1' }),
      session(at(11), 25, { title: 'Practising' }),
    ])
    const items = activityFor(d, day)
    expect(items.map((i) => [i.kind, i.title, i.minutes])).toEqual([
      ['time', 'Practising', 25],
      ['progress', 'Big task', 30],
    ])
  })

  it('is newest first and empty for a quiet day', () => {
    const d = data([], [doneWin(at(9), { title: 'a' }), doneWin(at(14), { title: 'b' })])
    expect(activityFor(d, day).map((i) => i.title)).toEqual(['b', 'a'])
    expect(activityFor(d, dayRange(new Date(2026, 8, 1)))).toEqual([])
  })
})

describe('soFarLabel', () => {
  it('summarises sessions on a task, or nothing if there are none', () => {
    const entries = [session(new Date(), 90, { winId: 'a' }), session(new Date(), 40, { winId: 'a' })]
    expect(soFarLabel('a', entries)).toBe('2 sessions · 2h 10m so far')
    expect(soFarLabel('a', [entries[0]])).toBe('1 session · 1h 30m so far')
    expect(soFarLabel('b', entries)).toBeNull()
  })
})

describe('goalHistory', () => {
  it('gives one result per week, each with its own partial credit', () => {
    const link = { goalIds: ['guitar'] }
    const d = data([guitar], [], [
      session(new Date(2026, 8, 29), 120, link), // week of Sep 28: met
      session(new Date(2026, 9, 6), 60, link), // week of Oct 5: half
    ])
    const r = customRange(new Date(2026, 8, 28), new Date(2026, 9, 11)) // two full weeks
    const history = goalHistory(guitar, d, r)
    expect(history.map((h) => h.periodStart)).toEqual([new Date(2026, 8, 28), new Date(2026, 9, 5)])
    expect(history.map((h) => h.progress.fraction)).toEqual([1, 0.5])
    expect(history.map((h) => h.progress.met)).toEqual([true, false])
  })
})

describe('logEntries', () => {
  const day = dayRange(new Date(2026, 8, 27))
  const at = (h: number) => new Date(2026, 8, 27, h)

  it('lists each record as its own row, newest first, without merging', () => {
    const d = data(
      [guitar],
      [doneWin(at(12), { id: 'w1', title: 'Learn song', goalIds: ['guitar'] }), todo({ id: 't1', status: 'doing', title: 'Big task' })],
      [
        session(at(9), 30, { winId: 'w1' }),
        session(at(15), 20, { winId: 't1' }),
        session(at(18), 10, { title: 'Stretching' }),
      ],
    )
    const rows = logEntries(d, day)
    expect(rows.map((r) => [r.kind, r.title, r.minutes ?? null])).toEqual([
      ['time', 'Stretching', 10],
      ['time', 'Big task', 20],
      ['win', 'Learn song', null],
      ['time', 'Learn song', 30],
    ])
    expect(rows[1].attachedTo).toBe('Big task')
    expect(rows[0].attachedTo).toBeUndefined()
  })

  it('maps every row back to a record id, and ignores unfinished tasks and other days', () => {
    const d = data([], [doneWin(at(9), { id: 'w1' }), todo({ id: 't1' }), doneWin(new Date(2026, 8, 28, 9), { id: 'w2' })])
    expect(logEntries(d, day).map((r) => r.id)).toEqual(['w1'])
  })
})

describe('goalHistory for other periods', () => {
  it('gives one result per day for a daily goal and per month for a monthly one', () => {
    const daily = { ...guitar, id: 'd', period: 'day' as const, targets: [{ from: new Date(2026, 0, 1), amount: 30 }] }
    const monthly = { ...guitar, id: 'm', period: 'month' as const, targets: [{ from: new Date(2026, 0, 1), amount: 600 }] }
    const d = data([daily, monthly], [], [session(new Date(2026, 8, 28, 9), 30, { goalIds: ['d', 'm'] })])

    const days = goalHistory(daily, d, customRange(new Date(2026, 8, 27), new Date(2026, 8, 29)))
    expect(days.map((x) => x.progress.met)).toEqual([false, true, false])

    const months = goalHistory(monthly, d, customRange(new Date(2026, 7, 15), new Date(2026, 9, 5)))
    expect(months.map((x) => x.periodStart)).toEqual([new Date(2026, 7, 1), new Date(2026, 8, 1), new Date(2026, 9, 1)])
  })

  it('stops at the archive date', () => {
    const archived = { ...guitar, archivedAt: new Date(2026, 8, 30) }
    const history = goalHistory(archived, data([archived]), customRange(new Date(2026, 8, 14), new Date(2026, 9, 18)))
    expect(history.map((h) => h.periodStart)).toEqual([new Date(2026, 8, 14), new Date(2026, 8, 21), new Date(2026, 8, 28)])
  })
})

describe('goalHistory before a goal existed', () => {
  it('leaves out periods that began before the first target, instead of showing empty bars', () => {
    const young = { ...guitar, targets: [{ from: new Date(2026, 8, 28), amount: 120 }] } // starts the week of Sep 28
    const history = goalHistory(young, data([young]), customRange(new Date(2026, 8, 14), new Date(2026, 9, 11)))
    expect(history.map((h) => h.periodStart)).toEqual([new Date(2026, 8, 28), new Date(2026, 9, 5)])
  })
})
