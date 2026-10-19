import { describe, expect, it } from 'vitest'
import { parseDateInput, parseDateTimeInput, toDateInput, toDateTimeInput } from './dates'

describe('date input helpers', () => {
  it('round-trips a date as local time, not UTC', () => {
    const d = new Date(2026, 0, 5, 23, 30)
    expect(toDateInput(d)).toBe('2026-01-05')
    expect(parseDateInput('2026-01-05')).toEqual(new Date(2026, 0, 5))
  })

  it('round-trips a date and time', () => {
    const d = new Date(2026, 9, 18, 7, 5)
    expect(toDateTimeInput(d)).toBe('2026-10-18T07:05')
    expect(parseDateTimeInput('2026-10-18T07:05')).toEqual(d)
  })

  it('returns null for empty or malformed values', () => {
    expect(parseDateTimeInput('')).toBeNull()
    expect(parseDateTimeInput('yesterday')).toBeNull()
    expect(parseDateTimeInput('2026-10-18')).toBeNull()
  })
})
