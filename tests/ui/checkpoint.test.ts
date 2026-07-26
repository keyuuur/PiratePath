import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_PUBLIC_MANIFEST } from '../../src/app/demoContent'
import type { CheckpointState } from '../../src/app/types'
import {
  clearExpiredCheckpoints,
  loadCheckpoint,
  saveCheckpoint,
} from '../../src/persistence/checkpoint'

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

function checkpoint(): CheckpointState {
  return {
    version: 2,
    screen: 'assessment',
    practiceIndex: 3,
    assessmentIndex: 1,
    practiceResponses: {},
    assessmentResponses: {},
    probeResponses: {},
    savedRoutes: {},
    reducedMotion: false,
    muted: true,
    startedAt: new Date().toISOString(),
    attemptId: 'attempt-one',
    attemptToken: 'opaque-token',
    practiceSeed: 'practice-seed',
    contentVersion: 'test-content',
    mode: 'demo',
    publicManifest: DEMO_PUBLIC_MANIFEST,
    submissionLocked: false,
  }
}

describe('local checkpoint retention', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T12:00:00Z'))
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('removes a saved checkpoint when its four-hour timer expires', () => {
    const key = 'pirate-path-v2:student-one'
    saveCheckpoint(key, checkpoint())
    expect(loadCheckpoint(key)).not.toBeNull()

    vi.advanceTimersByTime(FOUR_HOURS_MS + 2)
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('does not extend the four-hour limit when progress is saved again', () => {
    const key = 'pirate-path-v2:student-one'
    const state = checkpoint()
    saveCheckpoint(key, state)
    vi.advanceTimersByTime(3 * 60 * 60 * 1000)
    saveCheckpoint(key, state)

    vi.advanceTimersByTime(60 * 60 * 1000 + 2)
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('sweeps expired and malformed checkpoints for other shared-profile users', () => {
    const now = Date.now()
    localStorage.setItem('pirate-path-v2:expired-student', JSON.stringify({
      expiresAt: now - 1,
      state: checkpoint(),
    }))
    localStorage.setItem('pirate-path-v2:malformed-student', '{not-json')
    localStorage.setItem('pirate-path-v2:active-student', JSON.stringify({
      expiresAt: now + 1_000,
      state: checkpoint(),
    }))
    localStorage.setItem('unrelated-app', 'keep-me')

    expect(clearExpiredCheckpoints(now)).toBe(2)
    expect(localStorage.getItem('pirate-path-v2:expired-student')).toBeNull()
    expect(localStorage.getItem('pirate-path-v2:malformed-student')).toBeNull()
    expect(localStorage.getItem('pirate-path-v2:active-student')).not.toBeNull()
    expect(localStorage.getItem('unrelated-app')).toBe('keep-me')
  })
})
