import { describe, expect, it } from 'vitest'
import { compareBuilds, isDirty } from './buildInfo'

const running = { version: '2026.10.21', builtAt: '2026-10-21T22:47:00Z' }

describe('build info', () => {
  it('knows a dirty build by the -dirty suffix git describe adds', () => {
    expect(isDirty(running)).toBe(false)
    expect(isDirty({ ...running, version: '2026.10.21-3-gabc1234-dirty' })).toBe(true)
    expect(isDirty({ ...running, version: 'abc1234-dirty' })).toBe(true)
  })

  it('says current when the live version matches, newer when it differs', () => {
    expect(compareBuilds(running, { version: '2026.10.21' })).toEqual({ state: 'current' })
    expect(compareBuilds(running, { version: '2026.10.21b' })).toEqual({ state: 'newer', version: '2026.10.21b' })
    expect(compareBuilds({ ...running, version: '2026.10.21-2-gabc1234' }, { version: '2026.10.22' })).toEqual({ state: 'newer', version: '2026.10.22' })
  })

  it('does not guess when it cannot compare', () => {
    expect(compareBuilds(running, null).state).toBe('unknown')
    expect(compareBuilds(running, { commit: 'abc' }).state).toBe('unknown')
    expect(compareBuilds({ ...running, version: '2026.10.21-dirty' }, { version: '2026.10.21' }).state).toBe('unknown')
  })
})
