import { describe, expect, it } from 'vitest'
import { linkByArea, progressFor } from './goals'
import { applyQuickWin, applyTemplateToWins, contributionsFor, revertTemplateApplication, templateHasDetails, topQuickWins, undoQuickWin, winsNamed } from './quickWins'
import { DEFAULT_AREAS } from './areas'
import { amountWin, data, doneWin, guitar, session, squats, todo } from './testHelpers'
import type { QuickWin } from './types'

const MON = new Date(2026, 9, 12)
const WED = new Date(2026, 9, 14, 8, 15)

const tenSquats: QuickWin = { id: 'q1', title: '10 squats', areas: ['health'], goalIds: ['squats'], amount: 10, uses: 0 }
const stretch: QuickWin = { id: 'q2', title: 'Stretch', areas: [], goalIds: ['guitar'], minutes: 20, uses: 3 }

describe('amount goals', () => {
  it('add up the amounts of the finished wins linked to them', () => {
    const d = data([squats], [amountWin(MON, 10, ['squats']), amountWin(WED, 15, ['squats'])])
    expect(progressFor(squats, d, MON)).toEqual({ done: 25, target: 100, fraction: 0.25, met: false })
  })

  it('count a linked win with no amount as 1', () => {
    expect(progressFor(squats, data([squats], [amountWin(MON, undefined, ['squats'])]), MON).done).toBe(1)
  })

  it('ignore unlinked wins, unfinished wins and other weeks', () => {
    const d = data([squats], [
      amountWin(MON, 50, []), // not linked to the goal
      { ...amountWin(MON, 40, ['squats']), status: 'todo' as const, completedAt: undefined },
      amountWin(new Date(2026, 9, 11, 23, 59), 30, ['squats']), // Sunday before
      amountWin(new Date(2026, 9, 19), 30, ['squats']), // next Monday
      doneWin(MON), // no amount, no link
    ])
    expect(progressFor(squats, d, MON).done).toBe(0)
  })

  it('are met when the total reaches the target, across many small wins', () => {
    const wins = Array.from({ length: 10 }, (_, i) => amountWin(new Date(2026, 9, 12 + (i % 5)), 10, ['squats']))
    expect(progressFor(squats, data([squats], wins), MON)).toMatchObject({ done: 100, met: true })
  })

  it('pick up earlier wins in the same area when the goal is created later, via the backfill', () => {
    const earlier = { ...doneWin(MON, { areas: ['health'] }), amount: 40 }
    const d = data([squats], [earlier])
    expect(progressFor(squats, d, MON).done).toBe(0) // not linked yet
    const linked = { ...d, ...linkByArea(squats, d) }
    expect(progressFor(squats, linked, MON).done).toBe(40)
  })
})

describe('applyQuickWin', () => {
  const base = data([guitar, squats], [], [], [], [tenSquats, stretch])

  it('logs an ordinary finished win stamped now, with the amount, areas and goal links', () => {
    const result = applyQuickWin(base, 'q1', WED)!
    expect(result.data.wins[0]).toMatchObject({
      id: result.winId,
      title: '10 squats',
      status: 'done',
      completedAt: WED,
      amount: 10,
      areas: ['health'],
      goalIds: ['squats'],
    })
    expect(result.data.quickWins.find((q) => q.id === 'q1')?.uses).toBe(1)
  })

  it('adds a time entry attached to the win when the template has minutes', () => {
    const result = applyQuickWin(base, 'q2', WED)!
    expect(result.data.wins[0].goalIds).toEqual(['guitar'])
    expect(result.data.timeEntries).toEqual([expect.objectContaining({ minutes: 20, at: WED, winId: result.winId })])
    expect(result.data.wins[0].amount).toBeUndefined()
  })

  it('returns null for an unknown template', () => {
    expect(applyQuickWin(base, 'nope', WED)).toBeNull()
  })

  it('adds to the linked goal, and is just a win when it is linked to none', () => {
    const withGoal = applyQuickWin(base, 'q1', WED)!
    expect(progressFor(squats, withGoal.data, MON).done).toBe(10)

    const unlinked: QuickWin = { ...tenSquats, goalIds: [] }
    const noGoal = applyQuickWin(data([guitar, squats], [], [], [], [unlinked]), 'q1', WED)!
    expect(noGoal.data.wins).toHaveLength(1)
    expect(contributionsFor(noGoal.data, noGoal.winId, WED)).toEqual([])
  })
})

describe('undoQuickWin', () => {
  it('removes the win and its time, and gives the use back', () => {
    const base = data([guitar], [], [], [], [stretch])
    const { data: logged, winId } = applyQuickWin(base, 'q2', WED)!
    const undone = undoQuickWin(logged, winId, 'q2')
    expect(undone.wins).toEqual([])
    expect(undone.timeEntries).toEqual([])
    expect(undone.quickWins[0].uses).toBe(3)
  })

  it('never lets uses go below zero', () => {
    const d = data([], [doneWin(WED, { id: 'w' })], [], [], [tenSquats])
    expect(undoQuickWin(d, 'w', 'q1').quickWins[0].uses).toBe(0)
  })
})

describe('contributionsFor', () => {
  it('lists each goal the win counts toward with its progress this period', () => {
    const base = data([guitar, squats], [amountWin(MON, 30, ['squats'])], [], [], [tenSquats, stretch])
    const a = applyQuickWin(base, 'q1', WED)!
    expect(contributionsFor(a.data, a.winId, WED)).toEqual(['Squats: 40 of 100'])
    const b = applyQuickWin(base, 'q2', WED)!
    expect(contributionsFor(b.data, b.winId, WED)).toEqual(['Guitar: 20m of 2h'])
  })
})

describe('topQuickWins', () => {
  it('puts the most-used templates first and limits the count', () => {
    const many = [tenSquats, stretch, { ...tenSquats, id: 'q3', uses: 9 }]
    expect(topQuickWins(many, 2).map((q) => q.id)).toEqual(['q3', 'q2'])
  })
})

describe('sessions are unaffected', () => {
  it('still sums time for time goals', () => {
    expect(progressFor(guitar, data([guitar], [], [session(MON, 30, { goalIds: ['guitar'] })]), MON).done).toBe(30)
  })
})

describe('applying a changed template to earlier wins', () => {
  const mow: QuickWin = { id: 'q', title: 'Mow the lawn', areas: ['home'], goalIds: ['squats'], amount: 1, uses: 3 }
  const lastWeek = new Date(2026, 9, 7, 10)
  const mk = (title: string, at: Date, extra: object = {}) => ({ ...doneWin(at, { title }), ...extra })
  const base = () => ({
    ...data(
      [squats],
      [
        mk('Mow the lawn', WED),
        mk('mow the lawn!', MON),
        mk('Mow the lawn', lastWeek),
        mk('Water the plants', WED),
        { ...todo({ title: 'Mow the lawn' }) }, // not finished: never touched
      ],
    ),
    areas: DEFAULT_AREAS,
  })

  it('finds finished wins by name, ignoring case and punctuation, newest first', () => {
    expect(winsNamed(base().wins, 'MOW THE LAWN').map((w) => w.completedAt)).toEqual([WED, MON, lastWeek])
  })

  it('can be limited to wins finished since a date', () => {
    expect(winsNamed(base().wins, 'Mow the lawn', MON)).toHaveLength(2)
  })

  it('adds the template areas, goals and amount to every matching win, and only those', () => {
    const { data: d, changedIds } = applyTemplateToWins(base(), mow, 'Mow the lawn')
    expect(changedIds).toHaveLength(3)
    for (const w of d.wins.filter((x) => x.title.toLowerCase().startsWith('mow') && x.status === 'done')) {
      expect(w).toMatchObject({ areas: ['home'], goalIds: ['squats'], amount: 1 })
    }
    expect(d.wins.find((w) => w.title === 'Water the plants')).toMatchObject({ areas: [], goalIds: [] })
    expect(d.wins.find((w) => w.status === 'todo')?.areas).toEqual([])
  })

  it('only touches wins since the date when one is given, so past weeks stay as they were', () => {
    const since = new Date(2026, 9, 12)
    const { data: d, changedIds } = applyTemplateToWins(base(), mow, 'Mow the lawn', since)
    expect(changedIds).toHaveLength(2)
    expect(d.wins.find((w) => w.completedAt?.getTime() === lastWeek.getTime())?.areas).toEqual([])
  })

  it('never removes or overwrites: hand-added links stay, an existing amount is kept', () => {
    const custom = mk('Mow the lawn', WED, { areas: ['music'], goalIds: ['guitar'], amount: 5 })
    const d0 = { ...base(), wins: [custom] }
    const { data: d } = applyTemplateToWins(d0, mow, 'Mow the lawn')
    expect(d.wins[0].areas.sort()).toEqual(['home', 'music'])
    expect(d.wins[0].goalIds).toEqual(expect.arrayContaining(['guitar']))
    expect(d.wins[0].amount).toBe(5)
  })

  it('reports only the wins that actually changed, and leaves the rest untouched', () => {
    const already = mk('Mow the lawn', WED, { areas: ['home'], goalIds: ['squats'], amount: 1 })
    const d0 = { ...base(), wins: [already, mk('Mow the lawn', MON)] }
    const { changedIds } = applyTemplateToWins(d0, mow, 'Mow the lawn')
    expect(changedIds).toEqual([d0.wins[1].id])
  })

  it('finds the wins by the OLD name when the template was renamed', () => {
    const renamed = { ...mow, title: 'Cut the grass' }
    expect(applyTemplateToWins(base(), renamed, 'Mow the lawn').changedIds).toHaveLength(3)
  })

  it('ignores areas that no longer exist and goals that are archived', () => {
    const stale: QuickWin = { ...mow, areas: ['home', 'gone'], goalIds: ['squats', 'old'] }
    const d0 = { ...base(), goals: [squats, { ...squats, id: 'old', archivedAt: new Date(2026, 9, 1) }] }
    const { data: d } = applyTemplateToWins(d0, stale, 'Mow the lawn')
    expect(d.wins[0].areas).toEqual(['home'])
    expect(d.wins[0].goalIds).toEqual(['squats'])
  })

  it('knows whether a template has anything to add', () => {
    expect(templateHasDetails(mow)).toBe(true)
    expect(templateHasDetails({ ...mow, areas: [], goalIds: [], amount: undefined })).toBe(false)
  })
})

describe('undoing an applied template', () => {
  const mow: QuickWin = { id: 'q', title: 'Mow the lawn', areas: ['home'], goalIds: ['squats'], amount: 1, uses: 0 }
  const original = { ...doneWin(WED, { id: 'w1', title: 'Mow the lawn' }), areas: ['music'] }
  const base = { ...data([squats], [original]), areas: DEFAULT_AREAS }

  it('takes back exactly what was added, and nothing else', () => {
    const { data: applied } = applyTemplateToWins(base, mow, 'Mow the lawn')
    expect(applied.wins[0]).toMatchObject({ areas: ['music', 'home'], goalIds: ['squats'], amount: 1 })
    expect(revertTemplateApplication(applied, mow, [original]).wins[0]).toEqual(original)
  })

  it('keeps changes made to those wins since: a rename, another area, an edited amount', () => {
    const { data: applied } = applyTemplateToWins(base, mow, 'Mow the lawn')
    const edited = {
      ...applied,
      wins: [{ ...applied.wins[0], title: 'Mowed it', areas: [...applied.wins[0].areas, 'learning'], amount: 7 }],
    }
    const reverted = revertTemplateApplication(edited, mow, [original]).wins[0]
    expect(reverted.title).toBe('Mowed it')
    expect(reverted.areas).toEqual(['music', 'learning']) // "home" added by the update is gone
    expect(reverted.goalIds).toEqual([])
    expect(reverted.amount).toBe(7) // the amount was changed afterwards, so it is kept
  })

  it('leaves wins that were never changed alone', () => {
    const other = doneWin(WED, { id: 'w2', title: 'Other' })
    const d = { ...base, wins: [original, other] }
    expect(revertTemplateApplication(d, mow, [original]).wins[1]).toBe(other)
  })
})
