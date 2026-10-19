import { describe, expect, it } from 'vitest'
import { migrateLegacy, type LegacyData } from './migrate'
import { progressFor } from './goals'

const NOW = new Date(2026, 9, 18, 12)
const MON = new Date(2026, 9, 12)

const legacy: LegacyData = {
  goals: [
    { id: 'guitar', title: 'Guitar', area: 'music', kind: 'time', targets: [{ from: new Date(2026, 0, 1), amount: 120 }] },
    { id: 'week', title: 'Week', kind: 'completion', targets: [], childIds: ['guitar'] },
  ],
  wins: [
    { id: 'w1', title: 'Scales', area: 'music', at: new Date(2026, 9, 13, 9), minutes: 90 },
    { id: 'w2', title: 'Run', area: 'health', at: new Date(2026, 9, 13, 18) },
  ],
  tasks: [
    { id: 't1', title: 'Book dentist', done: false },
    { id: 't2', title: 'Fix shelf', done: true, area: 'home' },
  ],
}

describe('migrateLegacy', () => {
  const migrated = migrateLegacy(legacy, NOW)

  it('turns a goal area into an areas list', () => {
    expect(migrated.goals.find((g) => g.id === 'guitar')?.areas).toEqual(['music'])
    expect(migrated.goals.find((g) => g.id === 'week')?.areas).toEqual([])
  })

  it('turns each old win into a finished win, keeping its area and timestamp', () => {
    const w = migrated.wins.find((x) => x.id === 'w1')
    expect(w).toMatchObject({
      status: 'done',
      areas: ['music'],
      completedAt: new Date(2026, 9, 13, 9),
      goalIds: ['guitar'], // linked to the leaf goal in its area
    })
    expect(migrated.wins.find((x) => x.id === 'w2')?.goalIds).toEqual([])
  })

  it('moves minutes onto a time entry attached to the win', () => {
    expect(migrated.timeEntries).toHaveLength(1)
    expect(migrated.timeEntries[0]).toMatchObject({ minutes: 90, winId: 'w1', at: new Date(2026, 9, 13, 9) })
  })

  it('turns tasks into todo or done wins', () => {
    expect(migrated.wins.find((x) => x.id === 't1')).toMatchObject({ status: 'todo', areas: [] })
    expect(migrated.wins.find((x) => x.id === 't1')?.completedAt).toBeUndefined()
    expect(migrated.wins.find((x) => x.id === 't2')).toMatchObject({ status: 'done', completedAt: NOW, areas: ['home'] })
  })

  it('keeps goal progress identical to the old area-matching result', () => {
    const guitar = migrated.goals.find((g) => g.id === 'guitar')!
    expect(progressFor(guitar, migrated, MON)).toMatchObject({ done: 90, fraction: 0.75 })
  })
})
