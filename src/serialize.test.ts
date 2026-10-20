/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest'
import { backupFilename, backupText, describeAgo, summarise } from './backup'
import { DEFAULT_AREAS } from './areas'
import { targetFor } from './goals'
import { deserialize, serialize, serializeChecked } from './serialize'
import { data, doneWin, guitar, session, todo, workouts } from './testHelpers'

const NOW = new Date(2026, 9, 18, 10, 30)

const sample = {
  ...data(
    [guitar],
    [doneWin(new Date(2026, 9, 13, 9), { id: 'w1', goalIds: ['guitar'], areas: ['music'] }), todo({ id: 't1' })],
    [session(new Date(2026, 9, 13, 9), 45, { winId: 'w1' })],
  ),
  areas: DEFAULT_AREAS,
}

describe('serialize / deserialize', () => {
  it('round-trips everything, turning date strings back into real Dates', () => {
    const back = deserialize(serialize(sample))
    expect(back).toEqual(sample)
    expect(back.wins[0].completedAt).toBeInstanceOf(Date)
    expect(back.goals[0].targets[0].from).toBeInstanceOf(Date)
    expect(back.timeEntries[0].at).toBeInstanceOf(Date)
  })

  it('accepts a backup file, ignoring the extra header fields', () => {
    expect(deserialize(backupText(sample, NOW))).toEqual(sample)
  })

  it('seeds the starter areas when an older save has none', () => {
    const old = JSON.parse(serialize(sample)) as Record<string, unknown>
    delete old.areas
    expect(deserialize(JSON.stringify(old)).areas).toEqual(DEFAULT_AREAS)
  })

  it('rejects things that are not a Cairn backup, with a readable message', () => {
    expect(() => deserialize('not json')).toThrow(/valid JSON/)
    expect(() => deserialize('{"hello":1}')).toThrow(/Cairn backup/)
    expect(() => deserialize('[]')).toThrow(/Cairn backup/)
    expect(() => deserialize('{"version":1,"goals":[],"wins":[],"timeEntries":[]}')).toThrow(/different version/)
  })

  it('rejects missing or damaged data instead of half-loading it', () => {
    expect(() => deserialize('{"version":2,"goals":[],"wins":[]}')).toThrow(/missing/)
    const bad = JSON.parse(serialize(sample)) as { wins: { createdAt: string }[] }
    bad.wins[0].createdAt = 'yesterday-ish'
    expect(() => deserialize(JSON.stringify(bad))).toThrow(/damaged/)
  })
})

describe('backup helpers', () => {
  it('names the file by date', () => {
    expect(backupFilename(NOW)).toBe('cairn-backup-2026-10-18.json')
    expect(backupFilename(new Date(2026, 0, 5))).toBe('cairn-backup-2026-01-05.json')
  })

  it('summarises counts for the import preview', () => {
    expect(summarise(sample)).toBe('1 win, 1 open task, 1 time entry, 1 goal, 5 areas')
  })

  it('describes the last backup plainly', () => {
    expect(describeAgo(new Date(2026, 9, 18, 8), NOW)).toBe('today')
    expect(describeAgo(new Date(2026, 9, 17, 8), NOW)).toBe('yesterday')
    expect(describeAgo(new Date(2026, 9, 11, 8), NOW)).toBe('7 days ago')
  })
})

describe('newer fields', () => {
  it('round-trips the timer, goal periods and archive dates', () => {
    const withExtras = {
      ...sample,
      timer: { startedAt: new Date(2026, 9, 18, 9), title: 'Practice', areas: ['music'], goalIds: ['guitar'] },
      goals: [{ ...guitar, period: 'month' as const, archivedAt: new Date(2026, 9, 1) }],
    }
    const back = deserialize(serialize(withExtras))
    expect(back.timer?.startedAt).toBeInstanceOf(Date)
    expect(back).toEqual(withExtras)
  })

  it('treats a save with no period as weekly, and no timer as none', () => {
    const old = JSON.parse(serialize(sample)) as { goals: Record<string, unknown>[]; timer?: unknown }
    delete old.goals[0].period
    delete old.timer
    const back = deserialize(JSON.stringify(old))
    expect(back.goals[0].period).toBe('week')
    expect(back.timer).toBeNull()
  })

  it('rejects a damaged timer instead of loading it', () => {
    const bad = JSON.parse(serialize(sample)) as Record<string, unknown>
    bad.timer = { startedAt: 'someday', title: 'x', areas: [], goalIds: [] }
    expect(() => deserialize(JSON.stringify(bad))).toThrow(/damaged/)
  })
})

// A well-formed envelope with something wrong INSIDE is the dangerous case: it used
// to be accepted, saved, and then crashed the app on every launch.
describe('records that look right from outside but are damaged inside', () => {
  const good = () => JSON.parse(serialize(sample)) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const rejects = (mutate: (d: Record<string, any>) => void, why: RegExp = /damaged|missing/) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const d = good()
    mutate(d)
    expect(() => deserialize(JSON.stringify(d))).toThrow(why)
  }

  it('rejects a win with no areas or goalIds (the crash that blanked the app)', () => {
    rejects((d) => {
      delete d.wins[0].areas
    })
    rejects((d) => {
      delete d.wins[0].goalIds
    })
  })

  it('rejects unknown statuses, kinds and periods', () => {
    rejects((d) => (d.wins[0].status = 'maybe'))
    rejects((d) => (d.goals[0].kind = 'mystery'))
    rejects((d) => (d.goals[0].period = 'fortnight'))
  })

  it('rejects wrong types and non-finite numbers', () => {
    rejects((d) => (d.timeEntries[0].minutes = 'ten'))
    rejects((d) => (d.timeEntries[0].minutes = -5))
    rejects((d) => (d.wins[0].amount = 'lots'))
    rejects((d) => (d.goals[0].targets[0].amount = null))
    rejects((d) => (d.wins[0].areas = 'music'))
  })

  it('rejects a finished win with no completion time, which would vanish from reports', () => {
    rejects((d) => {
      d.wins[0].status = 'done'
      delete d.wins[0].completedAt
    })
  })

  it('rejects bad dates anywhere, including goal targets and the archive date', () => {
    rejects((d) => (d.goals[0].targets[0].from = 'nope'))
    rejects((d) => (d.goals[0].archivedAt = 'soon'))
    rejects((d) => (d.timeEntries[0].at = 12345))
  })

  it('rejects bad areas, quick wins and timers', () => {
    rejects((d) => (d.areas[0].colour = 99), /damaged/)
    rejects((d) => (d.areas = 'nope'), /missing/)
    rejects((d) => (d.quickWins = [null]), /damaged/)
    rejects((d) => (d.timer = { startedAt: new Date().toISOString(), title: 'x' }), /damaged/)
  })

  it('rejects duplicate ids, which would break lists and lookups', () => {
    rejects((d) => d.wins.push({ ...d.wins[0] }))
    rejects((d) => d.goals.push({ ...d.goals[0] }))
  })

  it('rejects overarching goals that include each other, or themselves', () => {
    rejects((d) => {
      d.goals = [
        { ...d.goals[0], id: 'a', childIds: ['b'] },
        { ...d.goals[0], id: 'b', childIds: ['a'] },
      ]
    })
    rejects((d) => (d.goals[0].childIds = [d.goals[0].id]))
  })

  it('still accepts a valid overarching goal, and ids it refers to that no longer exist', () => {
    const d = good()
    d.goals.push({ ...d.goals[0], id: 'all', kind: 'completion', childIds: ['guitar', 'deleted-long-ago'], targets: [] })
    expect(deserialize(JSON.stringify(d)).goals).toHaveLength(2)
  })
})

describe('goal targets across time zones', () => {
  const original = process.env.TZ
  afterEach(() => {
    // Assigning undefined to process.env stores the text "undefined": delete it instead.
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it('stores a target start as a calendar day, so it still applies after the time zone changes', () => {
    process.env.TZ = 'Europe/London'
    const goal = { ...guitar, targets: [{ from: new Date(2026, 9, 12), amount: 120 }] } // Monday 12 Oct, local midnight
    const text = serialize({ ...sample, goals: [goal] })
    expect(JSON.parse(text).goals[0].targets[0].from).toBe('2026-10-12')

    for (const zone of ['Europe/Berlin', 'America/New_York', 'Pacific/Auckland']) {
      process.env.TZ = zone
      const back = deserialize(text)
      expect(back.goals[0].targets[0].from).toEqual(new Date(2026, 9, 12))
      // The week starting Monday 12 Oct, in THIS zone, still finds its target.
      expect(targetFor(back.goals[0], new Date(2026, 9, 12))).toBe(120)
    }
  })

  it('still reads older saves that stored the target start as a full timestamp', () => {
    const d = good()
    d.goals[0].targets[0].from = '2026-01-01T00:00:00.000Z'
    expect(deserialize(JSON.stringify(d)).goals[0].targets[0].from).toEqual(new Date('2026-01-01T00:00:00.000Z'))
  })

  function good() {
    return JSON.parse(serialize(sample)) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  }
})

describe('serializeChecked (never write what could not be loaded again)', () => {
  it('returns the text for ordinary data, and it reads back unchanged', () => {
    expect(deserialize(serializeChecked(sample))).toEqual(sample)
  })

  it('refuses a target that became Infinity, which JSON turns into null', () => {
    const bad = { ...sample, goals: [{ ...guitar, targets: [{ from: new Date(2026, 0, 1), amount: Infinity }] }] }
    expect(() => serializeChecked(bad)).toThrow(/can't store/)
  })

  it('refuses NaN minutes, an invalid date, or an unusable colour', () => {
    expect(() => serializeChecked({ ...sample, timeEntries: [{ ...sample.timeEntries[0], minutes: NaN }] })).toThrow(/can't store/)
    expect(() => serializeChecked({ ...sample, timeEntries: [{ ...sample.timeEntries[0], at: new Date('nope') }] })).toThrow(/can't store/)
    expect(() => serializeChecked({ ...sample, areas: [{ id: 'x', name: 'X', colour: 99 }] })).toThrow(/can't store/)
  })

  it('refuses a goal target with an invalid start date (the "NaN-NaN-NaN" case)', () => {
    const bad = { ...sample, goals: [{ ...guitar, targets: [{ from: new Date('nope'), amount: 60 }] }] }
    expect(() => serializeChecked(bad)).toThrow(/can't store/)
  })
})

describe('repeatable-task timers and prompts survive saving', () => {
  it('round-trips askMinutes and a timer started from a repeatable task', () => {
    const withExtras = {
      ...sample,
      quickWins: [{ id: 'q', title: 'Woodshop', areas: [], goalIds: [], askMinutes: true, uses: 0 }],
      timer: { startedAt: new Date(2026, 9, 18, 9), title: 'Woodshop', quickWinId: 'q', areas: [], goalIds: [] },
    }
    expect(deserialize(serialize(withExtras))).toEqual(withExtras)
  })

  it('rejects a non-boolean askMinutes or a non-text quickWinId', () => {
    const raw = JSON.parse(serialize({ ...sample, quickWins: [{ id: 'q', title: 'W', areas: [], goalIds: [], uses: 0 }] }))
    raw.quickWins[0].askMinutes = 'yes'
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/damaged/)
    const raw2 = JSON.parse(serialize({ ...sample, timer: { startedAt: new Date(2026, 9, 18, 9), title: 'W', areas: [], goalIds: [] } }))
    raw2.timer.quickWinId = 5
    expect(() => deserialize(JSON.stringify(raw2))).toThrow(/damaged/)
  })
})

describe('task origin and goal rules survive saving and are validated', () => {
  const good = () => JSON.parse(serialize(sample)) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  it('round-trips origin, quickWinId and a goal rule', () => {
    const withExtras = {
      ...sample,
      goals: [{ ...workouts, source: 'each' as const }],
      wins: [{ ...sample.wins[0], origin: 'quick' as const, quickWinId: 'q1' }, { ...sample.wins[1], origin: 'todo' as const }],
    }
    expect(deserialize(serialize(withExtras))).toEqual(withExtras)
  })

  it('rejects an unknown rule or origin instead of loading it', () => {
    const a = good()
    a.goals[0].source = 'sometimes'
    expect(() => deserialize(JSON.stringify(a))).toThrow(/damaged/)
    const b = good()
    b.wins[0].origin = 'imported'
    expect(() => deserialize(JSON.stringify(b))).toThrow(/damaged/)
  })
})

describe('areas on Today', () => {
  it('round-trips an area switched off, and rejects a non-boolean switch', () => {
    const off = { ...sample, areas: [{ id: 'a', name: 'A', colour: 1, onToday: false }] }
    expect(deserialize(serialize(off)).areas).toEqual(off.areas)
    const raw = JSON.parse(serialize(off))
    raw.areas[0].onToday = 'no'
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/damaged/)
  })
})

describe('goal rules must fit the goal kind', () => {
  it('rejects a rule the app never makes, such as a time goal that counts to-dos', () => {
    const raw = JSON.parse(serialize({ ...sample, goals: [guitar] }))
    raw.goals[0].source = 'todo'
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/damaged/)
    raw.goals[0].source = 'any'
    expect(() => deserialize(JSON.stringify(raw))).not.toThrow()
  })
})

describe('the Other ring switch', () => {
  it('round-trips Other switched off, and rejects a non-boolean', () => {
    const off = { ...sample, otherOnToday: false }
    expect(deserialize(serialize(off)).otherOnToday).toBe(false)
    expect(deserialize(serialize(sample)).otherOnToday).toBeUndefined()
    const raw = JSON.parse(serialize(off))
    raw.otherOnToday = 'no'
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/damaged/)
  })
})
