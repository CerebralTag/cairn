import { describe, expect, it } from 'vitest'
import { addLoggedWin, addTask, applyEntryEdit, applyWinEdit, deleteEntry } from './edits'
import { progressFor } from './goals'
import { amountWin, data, doneWin, guitar, session, squats, todo } from './testHelpers'

const NOW = new Date(2026, 9, 18, 10)
const YESTERDAY = new Date(2026, 9, 17, 20, 15)
const MON = new Date(2026, 9, 12)

describe('addLoggedWin', () => {
  it('stamps now by default', () => {
    const d = addLoggedWin(data([]), { title: 'Scales', areas: [], goalIds: [] }, NOW)
    expect(d.wins[0]).toMatchObject({ status: 'done', createdAt: NOW, completedAt: NOW })
  })

  it('can be back-dated, and its minutes land at the same time', () => {
    const d = addLoggedWin(data([guitar]), { title: 'Scales', areas: [], goalIds: ['guitar'], minutes: 40, at: YESTERDAY }, NOW)
    expect(d.wins[0].completedAt).toEqual(YESTERDAY)
    expect(d.timeEntries[0]).toMatchObject({ at: YESTERDAY, minutes: 40, winId: d.wins[0].id })
    // A back-dated win counts in the period it happened in.
    expect(progressFor(guitar, d, MON).done).toBe(40)
  })

  it('stores an amount exactly as given, and none when none is given', () => {
    expect(addLoggedWin(data([]), { title: 'Pushups', areas: [], goalIds: [], amount: 10 }, NOW).wins[0].amount).toBe(10)
    expect(addLoggedWin(data([]), { title: 'Pushups', areas: [], goalIds: [] }, NOW).wins[0].amount).toBeUndefined()
  })

  it('feeds amount goals straight away', () => {
    const d = addLoggedWin(data([squats]), { title: 'Squats', areas: [], goalIds: ['squats'], amount: 12, at: YESTERDAY }, NOW)
    expect(progressFor(squats, d, MON).done).toBe(12)
  })
})

describe('addTask keeps what was typed', () => {
  it('stores the amount, so a finished task counts it toward an amount goal', () => {
    const d = addTask(data([squats]), { title: 'Mow lawn', areas: [], goalIds: ['squats'], amount: 3 }, NOW)
    expect(d.wins[0].amount).toBe(3)
    const finished = { ...d, wins: [{ ...d.wins[0], status: 'done' as const, completedAt: NOW }] }
    expect(progressFor(squats, finished, new Date(2026, 9, 12)).done).toBe(3)
  })
})

describe('addTask', () => {
  it('adds an unfinished task with no completion time', () => {
    const task = addTask(data([]), { title: 'Fix shelf', areas: ['home'], goalIds: [] }, NOW).wins[0]
    expect(task.status).toBe('todo')
    expect(task.completedAt).toBeUndefined()
  })
})

describe('applyWinEdit', () => {
  it('moves a finished win to another time, which moves it between days', () => {
    const d = applyWinEdit(data([], [doneWin(NOW, { id: 'w1', title: 'Old' })]), 'w1', { title: 'New', areas: ['music'], goalIds: [], at: YESTERDAY })
    expect(d.wins[0]).toMatchObject({ title: 'New', areas: ['music'], completedAt: YESTERDAY })
    expect(d.wins[0].createdAt).toEqual(YESTERDAY) // never later than its completion
  })

  it('ignores a time on an unfinished task', () => {
    const d = applyWinEdit(data([], [todo({ id: 't1' })]), 't1', { title: 'Renamed', areas: [], goalIds: [], at: YESTERDAY })
    expect(d.wins[0]).toMatchObject({ title: 'Renamed', status: 'todo' })
    expect(d.wins[0].completedAt).toBeUndefined()
  })

  it('changes or clears the amount, which moves the goals it counts toward', () => {
    const base = data([squats], [amountWin(MON, 10, ['squats'], 'w1')])
    const changed = applyWinEdit(base, 'w1', { title: 'x', areas: [], goalIds: ['squats'], amount: 25 })
    expect(progressFor(squats, changed, MON).done).toBe(25)
    // With no amount a linked win counts as 1.
    const cleared = applyWinEdit(base, 'w1', { title: 'x', areas: [], goalIds: ['squats'] })
    expect(cleared.wins[0].amount).toBeUndefined()
    expect(progressFor(squats, cleared, MON).done).toBe(1)
    // Unlinked, it no longer counts at all.
    const unlinked = applyWinEdit(base, 'w1', { title: 'x', areas: [], goalIds: [], amount: 25 })
    expect(progressFor(squats, unlinked, MON).done).toBe(0)
  })

  it('leaves other wins alone', () => {
    const d = applyWinEdit(data([], [doneWin(NOW, { id: 'a' }), doneWin(NOW, { id: 'b', title: 'keep' })]), 'a', { title: 'x', areas: [], goalIds: [] })
    expect(d.wins[1].title).toBe('keep')
  })
})

describe('applyEntryEdit and deleteEntry', () => {
  const entry = session(NOW, 30, { title: 'Practice', goalIds: ['guitar'] })

  it('changes the minutes, the time and the links, so it can move to another period', () => {
    const base = data([guitar], [], [entry])
    const edited = applyEntryEdit(base, entry.id, { minutes: 90, at: YESTERDAY, title: 'Practice', areas: ['music'], goalIds: ['guitar'] })
    expect(edited.timeEntries[0]).toMatchObject({ minutes: 90, at: YESTERDAY, areas: ['music'] })
    expect(progressFor(guitar, edited, MON).done).toBe(90)
  })

  it('removes only the chosen entry', () => {
    const other = session(NOW, 5)
    const d = deleteEntry(data([], [], [entry, other]), entry.id)
    expect(d.timeEntries).toEqual([other])
  })
})

describe('where a task came from is remembered', () => {
  it('a to-do is made as a to-do, and keeps that when it is finished', () => {
    const added = addTask(data([]), { title: 'Fix shelf', areas: [], goalIds: [] }, NOW)
    expect(added.wins[0].origin).toBe('todo')
    const finished = { ...added, wins: [{ ...added.wins[0], status: 'done' as const, completedAt: NOW }] }
    expect(applyWinEdit(finished, finished.wins[0].id, { title: 'Fixed shelf', areas: [], goalIds: [] }).wins[0].origin).toBe('todo')
  })

  it('a win logged after the fact is marked as logged', () => {
    expect(addLoggedWin(data([]), { title: 'Scales', areas: [], goalIds: [] }, NOW).wins[0].origin).toBe('logged')
  })
})
