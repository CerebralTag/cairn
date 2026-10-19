import { describe, expect, it } from 'vitest'
import { LONG_TIMER_MS, discardTimer, elapsedMs, formatElapsed, isLongRunning, startTimer, stopTimer } from './timer'
import { undoQuickWin } from './quickWins'
import type { QuickWin } from './types'
import { data, doneWin, guitar, todo } from './testHelpers'

const T0 = new Date(2026, 9, 18, 9, 0, 0)
const at = (minutes: number, seconds = 0) => new Date(T0.getTime() + minutes * 60_000 + seconds * 1000)
const base = data([guitar], [todo({ id: 't1', status: 'doing', title: 'Learn song' })])

describe('startTimer', () => {
  it('records only the start time and what it is for', () => {
    const d = startTimer(base, { title: 'Practice', areas: ['music'], goalIds: ['guitar'] }, T0)
    expect(d.timer).toEqual({ startedAt: T0, title: 'Practice', areas: ['music'], goalIds: ['guitar'] })
  })

  it('does nothing when a timer is already running: there is only ever one', () => {
    const running = startTimer(base, { title: 'First', areas: [], goalIds: [] }, T0)
    expect(startTimer(running, { title: 'Second', areas: [], goalIds: [] }, at(5))).toBe(running)
  })
})

describe('stopTimer', () => {
  it('saves a time entry that begins at the start time, rounded to the nearest minute', () => {
    const running = startTimer(base, { title: 'Practice', areas: ['music'], goalIds: ['guitar'] }, T0)
    const { data: d, entry } = stopTimer(running, at(44, 40)) // 44m40s
    expect(d.timer).toBeNull()
    expect(entry).toMatchObject({ at: T0, minutes: 45, title: 'Practice', goalIds: ['guitar'], areas: ['music'] })
    expect(d.timeEntries).toEqual([entry])
  })

  it('saves anything under a minute as one minute so a short session still counts', () => {
    const running = startTimer(base, { title: 'Quick', areas: [], goalIds: [] }, T0)
    expect(stopTimer(running, at(0, 10)).entry?.minutes).toBe(1)
  })

  it('attaches to a task instead of carrying its own title', () => {
    const running = startTimer(base, { title: 'Learn song', winId: 't1', areas: [], goalIds: [] }, T0)
    const { entry } = stopTimer(running, at(30))
    expect(entry).toMatchObject({ winId: 't1', minutes: 30 })
    expect(entry?.title).toBeUndefined()
  })

  it('keeps the time as a standalone entry if the task was deleted meanwhile', () => {
    const running = startTimer(base, { title: 'Learn song', winId: 'gone', areas: [], goalIds: [] }, T0)
    const { entry } = stopTimer(running, at(30))
    expect(entry).toMatchObject({ winId: undefined, title: 'Learn song' })
  })

  it('does nothing when no timer is running', () => {
    expect(stopTimer(base, at(5))).toEqual({ data: base, entry: null })
  })

  it('is correct after a long gap, since only the start is stored', () => {
    const running = startTimer(base, { title: 'Left running', areas: [], goalIds: [] }, T0)
    expect(stopTimer(running, at(60 * 3)).entry?.minutes).toBe(180)
  })
})

describe('discardTimer and elapsed time', () => {
  it('discards without saving anything', () => {
    const running = startTimer(base, { title: 'x', areas: [], goalIds: [] }, T0)
    const d = discardTimer(running)
    expect(d.timer).toBeNull()
    expect(d.timeEntries).toEqual([])
  })

  it('never reports negative elapsed time if the clock moved back', () => {
    const running = startTimer(base, { title: 'x', areas: [], goalIds: [] }, T0)
    expect(elapsedMs(running.timer!, new Date(T0.getTime() - 5000))).toBe(0)
  })

  it('formats as m:ss, or h:mm:ss from an hour', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(65_000)).toBe('1:05')
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe('59:59')
    expect(formatElapsed(3_725_000)).toBe('1:02:05')
  })
})

describe('timer data stays tidy', () => {
  it('is not touched by unrelated wins', () => {
    const d = { ...base, wins: [...base.wins, doneWin(T0)] }
    expect(startTimer(d, { title: 'x', areas: [], goalIds: [] }, T0).wins).toHaveLength(2)
  })
})

describe('a forgotten timer', () => {
  const running = startTimer(base, { title: 'Left running', areas: [], goalIds: [] }, T0).timer!

  it('is flagged as long-running after eight hours, not before', () => {
    expect(isLongRunning(running, new Date(T0.getTime() + LONG_TIMER_MS))).toBe(false)
    expect(isLongRunning(running, new Date(T0.getTime() + LONG_TIMER_MS + 1000))).toBe(true)
  })

  it('saves the length you give instead of the whole stretch', () => {
    const d = startTimer(base, { title: 'Left running', areas: [], goalIds: [] }, T0)
    expect(stopTimer(d, at(60 * 72), { minutes: 45 }).entry).toMatchObject({ minutes: 45, at: T0 })
  })

  it('saves it at the time you say it happened, not days ago at the start', () => {
    const d = startTimer(base, { title: 'x', areas: [], goalIds: [] }, T0)
    const thisMorning = at(60 * 70)
    expect(stopTimer(d, at(60 * 72), { minutes: 45, at: thisMorning }).entry).toMatchObject({ at: thisMorning, minutes: 45 })
  })

  it('still saves at least one minute for a tiny given length', () => {
    const d = startTimer(base, { title: 'x', areas: [], goalIds: [] }, T0)
    expect(stopTimer(d, at(5), { minutes: 0.2 }).entry?.minutes).toBe(1)
  })
})

describe('a timer started from a repeatable task', () => {
  const woodshop: QuickWin = { id: 'q', title: 'Woodshop', areas: ['home'], goalIds: ['guitar'], uses: 2 }
  const withTemplate = data([guitar], [], [], [], [woodshop])
  const running = startTimer(withTemplate, { title: 'Woodshop', quickWinId: 'q', areas: ['home'], goalIds: ['guitar'] }, T0)

  it('logs a finished win from the template, with the session attached as its time', () => {
    const result = stopTimer(running, at(45))
    expect(result.data.timer).toBeNull()
    expect(result.data.wins).toHaveLength(1)
    expect(result.data.wins[0]).toMatchObject({ title: 'Woodshop', status: 'done', origin: 'quick', quickWinId: 'q', goalIds: ['guitar'], areas: ['home'] })
    expect(result.entry).toMatchObject({ minutes: 45, at: T0, winId: result.winId, goalIds: [], areas: [] })
    expect(result.data.quickWins[0].uses).toBe(3)
  })

  it('counts the time toward the template\'s goals through the win', () => {
    const result = stopTimer(running, at(45))
    expect(result.data.timeEntries).toHaveLength(1)
    expect(result.data.timeEntries[0].winId).toBe(result.data.wins[0].id)
  })

  it('uses a corrected length for a forgotten timer', () => {
    const result = stopTimer(running, at(60 * 20), { minutes: 30, at: at(10) })
    expect(result.entry).toMatchObject({ minutes: 30, at: at(10) })
  })

  it('can be undone completely: no win, no time, no extra use', () => {
    const result = stopTimer(running, at(45))
    const undone = undoQuickWin(result.data, result.winId!, result.quickWinId!)
    expect(undone.wins).toHaveLength(0)
    expect(undone.timeEntries).toHaveLength(0)
    expect(undone.quickWins[0].uses).toBe(2)
  })

  it('keeps the time as a standalone entry if the repeatable task was removed meanwhile', () => {
    const result = stopTimer({ ...running, quickWins: [] }, at(45))
    expect(result.winId).toBeUndefined()
    expect(result.data.wins).toHaveLength(0)
    expect(result.entry).toMatchObject({ title: 'Woodshop', minutes: 45, goalIds: ['guitar'], areas: ['home'] })
  })
})
