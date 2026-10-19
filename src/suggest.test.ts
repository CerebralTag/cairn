import { describe, expect, it } from 'vitest'
import { DEFAULT_AREAS } from './areas'
import { buildSuggestionPool, makeSuggest, matchSuggestions, nameKey } from './suggest'
import { winsNamed } from './quickWins'
import { amountWin, data, doneWin, guitar, session, squats, todo, workouts } from './testHelpers'
import type { QuickWin } from './types'

const at = (day: number, h = 9) => new Date(2026, 9, day, h)
const withAreas = (d: ReturnType<typeof data>) => ({ ...d, areas: DEFAULT_AREAS })

describe('buildSuggestionPool', () => {
  it('has one entry per name, ignoring case and spacing, spelled as most recently used', () => {
    const d = withAreas(data([], [doneWin(at(10), { title: 'pushups' }), doneWin(at(12), { title: ' Pushups ' }), doneWin(at(11), { title: 'Walk' })]))
    const pool = buildSuggestionPool(d)
    expect(pool.map((p) => p.title).sort()).toEqual(['Pushups', 'Walk'])
    expect(pool.find((p) => p.title === 'Pushups')?.uses).toBe(2)
  })

  it('carries the details from the most recent use: areas, goals and amount', () => {
    const older = { ...amountWin(at(10), 5, ['squats']), title: 'Squats', areas: ['home'] }
    const newer = { ...amountWin(at(12), 20, ['squats']), title: 'Squats', areas: ['health'] }
    const [entry] = buildSuggestionPool(withAreas(data([squats], [older, newer])))
    expect(entry).toMatchObject({ areas: ['health'], goalIds: ['squats'], amount: 20 })
  })

  it('includes unfinished tasks, standalone timer titles and quick wins', () => {
    const quick: QuickWin = { id: 'q', title: '10 squats', areas: ['health'], goalIds: [], amount: 10, uses: 0 }
    const d = withAreas(data([], [todo({ title: 'Book dentist' })], [session(at(10), 20, { title: 'Stretching' })], [], [quick]))
    expect(buildSuggestionPool(d).map((p) => p.title).sort()).toEqual(['10 squats', 'Book dentist', 'Stretching'])
  })

  it('ticks a goal when the name matches the goal name, and offers goal names that were never used', () => {
    const d = withAreas(data([squats, guitar], [{ ...doneWin(at(10), { title: 'guitar' }), areas: [] }]))
    const pool = buildSuggestionPool(d)
    const guitarEntry = pool.find((p) => p.title === 'guitar')
    expect(guitarEntry?.goalIds).toEqual(['guitar'])
    expect(guitarEntry?.areas).toEqual(['music']) // filled from the goal when the win had none
    expect(pool.find((p) => p.title === 'Squats')).toMatchObject({ goalIds: ['squats'], areas: ['health'] })
  })

  it('never suggests archived goals, overarching goals, or areas that no longer exist', () => {
    const archived = { ...workouts, archivedAt: new Date(2026, 9, 1) }
    const overall = { ...guitar, id: 'all', title: 'Everything', kind: 'completion' as const, childIds: ['guitar'] }
    const win = { ...doneWin(at(10), { title: 'Run', goalIds: ['workouts'] }), areas: ['health', 'deleted-area'] }
    const pool = buildSuggestionPool(withAreas(data([archived, overall], [win])))
    expect(pool.map((p) => p.title)).toEqual(['Run'])
    expect(pool[0]).toMatchObject({ goalIds: [], areas: ['health'] })
  })
})

describe('matchSuggestions', () => {
  const d = withAreas(
    data(
      [],
      [
        doneWin(at(10), { title: 'Pushups' }),
        doneWin(at(11), { title: 'Pushups' }),
        doneWin(at(12), { title: 'Push the car' }),
        doneWin(at(9), { title: 'Wall pushups' }),
        doneWin(at(8), { title: 'Sunday supper prep' }),
      ],
    ),
  )
  const pool = buildSuggestionPool(d)
  const titles = (q: string, limit?: number) => matchSuggestions(pool, q, limit).map((s) => s.title)

  it('shows nothing until something is typed', () => {
    expect(titles('')).toEqual([])
    expect(titles('   ')).toEqual([])
  })

  it('ranks names that start with the text, then a word that starts with it, then containing it', () => {
    expect(titles('push')).toEqual(['Pushups', 'Push the car', 'Wall pushups'])
    // "up" only appears inside words here, so all three tie on match quality: the most used
    // name first, then the most recently used.
    expect(titles('up')).toEqual(['Pushups', 'Wall pushups', 'Sunday supper prep'])
    // A word that starts with the text outranks one that merely contains it.
    expect(titles('car')).toEqual(['Push the car'])
    expect(titles('pre')).toEqual(['Sunday supper prep'])
  })

  it('ignores case, and breaks ties by how often a name has been used', () => {
    expect(titles('PUSHUPS')[0]).toBe('Pushups') // used twice, so ahead of "Wall pushups"
  })

  it('limits the number of suggestions', () => {
    expect(titles('p', 2)).toHaveLength(2)
  })

  it('returns nothing when nothing matches', () => {
    expect(titles('zzz')).toEqual([])
  })

  it('works through the data-aware helper too', () => {
    expect(makeSuggest(d)('wall').map((s) => s.title)).toEqual(['Wall pushups'])
  })
})

describe('nameKey (what counts as the same name)', () => {
  it('ignores case, spacing, punctuation and accents', () => {
    const same = ['Pushups', 'pushups', 'PUSHUPS', ' Push-ups ', 'push ups', 'Push_ups!', 'Pushúps']
    expect(new Set(same.map(nameKey)).size).toBe(1)
  })

  it('keeps genuinely different names apart', () => {
    expect(nameKey('Pushups')).not.toBe(nameKey('Wall pushups'))
    expect(nameKey('Squats')).not.toBe(nameKey('Squat jumps'))
  })

  it('keeps digits, other alphabets, and falls back to the text for titles with no letters or digits', () => {
    expect(nameKey('10 squats')).toBe('10squats')
    expect(nameKey('Café')).toBe('cafe')
    expect(nameKey('ピアノ')).toBe('ピアノ')
    expect(nameKey('ピアノ')).not.toBe(nameKey('ヒアノ')) // not an accent, a different letter
    expect(nameKey('🎸')).toBe('🎸')
    expect(nameKey('🎸')).not.toBe(nameKey('🏃'))
  })
})

describe('one suggestion for different spellings of a name', () => {
  const spellings = ['pushups', 'Push-ups', 'Pushups!', 'push ups']
  const d = withAreas(data([], spellings.map((title, i) => ({ ...doneWin(at(10 + i), { title }), amount: 5 + i }))))

  it('merges them into one name, shown as it was most recently typed', () => {
    const pool = buildSuggestionPool(d)
    expect(pool).toHaveLength(1)
    expect(pool[0]).toMatchObject({ title: 'push ups', uses: 4, amount: 8 }) // latest spelling and its details
  })

  it('finds it whatever way you start typing it', () => {
    const suggest = makeSuggest(d)
    for (const typed of ['push', 'pushup', 'push-u', 'PUSH UPS', 'ushup']) {
      expect(suggest(typed).map((s) => s.title)).toEqual(['push ups'])
    }
  })

  it('treats a goal name the same way', () => {
    const goal = { ...squats, title: 'Squats!' }
    const win = doneWin(at(10), { title: 'squats' })
    const [entry] = buildSuggestionPool(withAreas(data([goal], [win])))
    expect(entry.goalIds).toEqual(['squats'])
  })
})

describe('names that differ only by a symbol are different names', () => {
  it('keeps C++, C# and C apart, and a symbol or emoji prefix', () => {
    const keys = ['C++', 'C#', 'C', 'c++', 'C ++'].map(nameKey)
    expect(new Set(keys).size).toBe(3) // C++ (x3) , C#, C
    expect(nameKey('🎸 practice')).not.toBe(nameKey('practice'))
    expect(nameKey('Q&A')).not.toBe(nameKey('QA'))
    expect(nameKey('Run')).toBe(nameKey('Run!'))
  })

  it("does not carry one name's details over to the other", () => {
    const cpp = { ...doneWin(at(10), { title: 'C++' }), areas: ['work'] }
    const sharp = { ...doneWin(at(11), { title: 'C#' }), areas: ['home'] }
    const suggest = makeSuggest(withAreas(data([], [cpp, sharp])))
    expect(suggest('C#')).toEqual([expect.objectContaining({ title: 'C#', areas: ['home'] })])
    expect(suggest('C+')).toEqual([expect.objectContaining({ title: 'C++', areas: ['work'] })])
  })

  it('does not bulk-apply a template to a differently-named win', () => {
    const cpp = doneWin(at(10), { title: 'C++' })
    expect(winsNamed([cpp, doneWin(at(11), { title: 'C#' }), doneWin(at(12), { title: 'C' })], 'C#').map((w) => w.title)).toEqual(['C#'])
  })
})
