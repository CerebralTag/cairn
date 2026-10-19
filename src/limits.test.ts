import { describe, expect, it } from 'vitest'
import { MAX_NUMBER, positiveNumber } from './limits'

describe('positiveNumber', () => {
  it('accepts ordinary positive amounts, including decimals', () => {
    expect(positiveNumber('45')).toBe(45)
    expect(positiveNumber('0.25')).toBe(0.25)
    expect(positiveNumber(String(MAX_NUMBER))).toBe(MAX_NUMBER)
  })

  it('rejects empty, zero, negative and non-numeric input', () => {
    for (const bad of ['', '   ', '0', '-3', 'abc', '1,5']) expect(positiveNumber(bad)).toBeUndefined()
  })

  it('rejects values that would break saving: huge, infinite, not-a-number', () => {
    for (const bad of ['1e307', '1e400', 'Infinity', 'NaN', String(MAX_NUMBER + 1)]) expect(positiveNumber(bad)).toBeUndefined()
  })
})
