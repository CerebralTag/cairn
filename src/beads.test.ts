import { describe, expect, it } from 'vitest'
import { beadCaption, summariseToday } from './beads'
import { formatMinutes } from './goals'
import { activityFor, dayRange } from './reports'
import { data, doneWin, session, todo } from './testHelpers'

const day = dayRange(new Date(2026, 9, 19))
const at = (h: number, m = 0) => new Date(2026, 9, 19, h, m)

describe('summariseToday', () => {
  it('gives a bead to every finished win, linked to a goal or not, oldest first', () => {
    const d = data(
      [],
      [
        doneWin(at(15), { id: 'late', title: 'Late', goalIds: ['g'] }),
        doneWin(at(9), { id: 'early', title: 'Standalone, no goal, no area' }),
        doneWin(at(12), { id: 'mid', title: 'Mid', areas: ['music'] }),
        todo({ id: 't', title: 'Not finished' }),
      ],
    )
    const { wins } = summariseToday(activityFor(d, day))
    expect(wins.map((w) => w.key)).toEqual(['early', 'mid', 'late'])
  })

  it('leaves out unfinished tasks, and time that did not finish anything, as beads', () => {
    const d = data([], [todo({ id: 't', status: 'doing', title: 'Big' })], [session(at(10), 30, { winId: 't' }), session(at(11), 20, { title: 'Stretch' })])
    const summary = summariseToday(activityFor(d, day))
    expect(summary.wins).toEqual([])
    expect(summary.minutes).toBe(50)
  })

  it("counts a win's own time once", () => {
    const d = data([], [doneWin(at(12), { id: 'w' })], [session(at(11), 25, { winId: 'w' })])
    expect(summariseToday(activityFor(d, day)).minutes).toBe(25)
  })

  it('is empty on a quiet day', () => {
    expect(summariseToday(activityFor(data([]), day))).toEqual({ wins: [], minutes: 0 })
  })
})

describe('beadCaption', () => {
  const caption = (wins: number, minutes: number) =>
    beadCaption({ wins: Array.from({ length: wins }, () => ({}) as never), minutes }, formatMinutes)

  it('reads plainly, with no target or comparison', () => {
    expect(caption(1, 0)).toBe('1 win today')
    expect(caption(4, 80)).toBe('4 wins today · 1h 20m logged')
    expect(caption(0, 45)).toBe('45m logged')
    expect(caption(0, 0)).toBe('')
  })
})
