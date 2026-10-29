import { describe, expect, it } from 'vitest'
import { todo } from './testHelpers'
import { matchesSearch } from './todoSearch'

describe('searching to-dos', () => {
  const task = todo({ title: 'Call the café about tax' })

  it('matches part of a word, ignoring case', () => {
    expect(matchesSearch(task, 'CALL')).toBe(true)
    expect(matchesSearch(task, 'ab')).toBe(true)
  })

  it('needs every word, in any order', () => {
    expect(matchesSearch(task, 'tax call')).toBe(true)
    expect(matchesSearch(task, 'tax dentist')).toBe(false)
  })

  it('ignores accents and extra spaces', () => {
    expect(matchesSearch(task, '  cafe  ')).toBe(true)
  })

  it('matches everything when empty', () => {
    expect(matchesSearch(task, '')).toBe(true)
    expect(matchesSearch(task, '   ')).toBe(true)
  })
})
