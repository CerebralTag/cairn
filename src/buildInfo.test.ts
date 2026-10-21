import { describe, expect, it } from 'vitest'
import { compareBuilds, versionLabel } from './buildInfo'

const running = { commit: 'abc1234', dirty: false, builtAt: '2026-10-21T22:47:00Z' }

describe('build info', () => {
  it('labels a clean build by its commit and a dirty one with + changes', () => {
    expect(versionLabel(running)).toBe('abc1234')
    expect(versionLabel({ ...running, dirty: true })).toBe('abc1234 + changes')
  })

  it('says current when the live commit matches, newer when it differs', () => {
    expect(compareBuilds(running, { commit: 'abc1234' })).toEqual({ state: 'current' })
    expect(compareBuilds(running, { commit: 'def5678' })).toEqual({ state: 'newer', commit: 'def5678' })
  })

  it('does not guess when it cannot compare', () => {
    expect(compareBuilds(running, null).state).toBe('unknown')
    expect(compareBuilds(running, { nope: 1 }).state).toBe('unknown')
    expect(compareBuilds({ ...running, dirty: true }, { commit: 'abc1234' }).state).toBe('unknown')
  })
})
