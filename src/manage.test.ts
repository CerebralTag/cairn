import { describe, expect, it } from 'vitest'
import { DEFAULT_AREAS } from './areas'
import { archiveGoal, deleteWin, removeArea, removeGoal, restoreGoal, withStatus } from './manage'
import { data, doneWin, guitar, session, todo, workouts } from './testHelpers'

const NOW = new Date(2026, 9, 18, 10)

describe('withStatus', () => {
  it('stamps a completion time only when finishing', () => {
    expect(withStatus(todo(), 'done', NOW)).toMatchObject({ status: 'done', completedAt: NOW })
    expect(withStatus(todo(), 'doing', NOW).completedAt).toBeUndefined()
  })

  it('clears the completion time when reopening or dropping a finished task', () => {
    const finished = doneWin(NOW)
    expect(withStatus(finished, 'todo', NOW)).toMatchObject({ status: 'todo', completedAt: undefined })
    expect(withStatus(finished, 'dropped', NOW).completedAt).toBeUndefined()
  })
})

describe('deleteWin', () => {
  it('keeps its sessions as standalone entries with the title and links', () => {
    const task = { ...todo({ id: 't1', status: 'doing', title: 'Learn song', goalIds: ['guitar'] }), areas: ['music'] }
    const d = deleteWin(data([guitar], [task], [session(NOW, 30, { winId: 't1' })]), 't1')
    expect(d.wins).toHaveLength(0)
    expect(d.timeEntries[0]).toMatchObject({
      winId: undefined,
      title: 'Learn song',
      goalIds: ['guitar'],
      areas: ['music'],
      minutes: 30,
    })
  })

  it('leaves other entries alone and ignores unknown ids', () => {
    const d0 = data([guitar], [todo({ id: 'a' })], [session(NOW, 10, { winId: 'other' })])
    expect(deleteWin(d0, 'missing')).toBe(d0)
    expect(deleteWin(d0, 'a').timeEntries[0].winId).toBe('other')
  })
})

describe('removeGoal', () => {
  it('unlinks the goal from children lists, wins and entries but keeps them', () => {
    const overall = { ...workouts, id: 'overall', childIds: ['guitar', 'workouts'] }
    const d0 = {
      ...data([guitar, workouts, overall], [doneWin(NOW, { goalIds: ['guitar', 'workouts'] })], [session(NOW, 5, { goalIds: ['guitar'] })]),
      areas: DEFAULT_AREAS,
    }
    const d = removeGoal(d0, 'guitar')
    expect(d.goals.map((g) => g.id)).toEqual(['workouts', 'overall'])
    expect(d.goals[1].childIds).toEqual(['workouts'])
    expect(d.wins[0].goalIds).toEqual(['workouts'])
    expect(d.timeEntries).toHaveLength(1)
    expect(d.timeEntries[0].goalIds).toEqual([])
  })
})

describe('removeArea', () => {
  it('removes the area and every reference to it, keeping the records', () => {
    const d0 = {
      ...data([guitar], [doneWin(NOW, { areas: ['music', 'health'] })], [session(NOW, 5, { areas: ['music'] })]),
      areas: DEFAULT_AREAS,
    }
    const d = removeArea(d0, 'music')
    expect(d.areas.map((a) => a.id)).not.toContain('music')
    expect(d.goals[0].areas).toEqual([])
    expect(d.wins[0].areas).toEqual(['health'])
    expect(d.timeEntries[0].areas).toEqual([])
    expect(d.wins).toHaveLength(1)
  })
})

describe('archiveGoal and restoreGoal', () => {
  it('stamps the archive time and can be undone, leaving everything else alone', () => {
    const d0 = data([guitar, workouts], [doneWin(NOW, { goalIds: ['guitar'] })])
    const archived = archiveGoal(d0, 'guitar', NOW)
    expect(archived.goals.find((g) => g.id === 'guitar')?.archivedAt).toEqual(NOW)
    expect(archived.goals.find((g) => g.id === 'workouts')?.archivedAt).toBeUndefined()
    expect(archived.wins[0].goalIds).toEqual(['guitar']) // links kept so history still works
    expect(restoreGoal(archived, 'guitar').goals[0].archivedAt).toBeUndefined()
  })
})

describe('a running timer when things are removed', () => {
  const running = { startedAt: NOW, title: 'x', winId: 't1', areas: ['music'], goalIds: ['guitar'] }

  it('drops a deleted goal or area from the timer, and detaches a deleted task', () => {
    const d0 = { ...data([guitar], [todo({ id: 't1' })]), areas: DEFAULT_AREAS, timer: running }
    expect(removeGoal(d0, 'guitar').timer?.goalIds).toEqual([])
    expect(removeArea(d0, 'music').timer?.areas).toEqual([])
    expect(deleteWin(d0, 't1').timer).toMatchObject({ winId: undefined, title: 'x' })
  })

  it('keeps counting a running timer toward the deleted task\'s goals and areas', () => {
    const task = { ...todo({ id: 't1', goalIds: ['guitar'] }), areas: ['music'] }
    const d0 = { ...data([guitar], [task]), timer: { startedAt: NOW, title: 'Learn song', winId: 't1', areas: [], goalIds: [] } }
    expect(deleteWin(d0, 't1').timer).toMatchObject({ winId: undefined, goalIds: ['guitar'], areas: ['music'] })
  })
})
