import { describe, expect, it } from 'vitest'
import {
  allowedTransitions,
  canTransition,
  FOLLOW_UP_STATUSES,
  isFollowUpStatus,
} from '@/lib/follow-up-workflow'

describe('follow-up state machine (§30)', () => {
  it('walks OPEN → CONTACTED → RESOLVED → CLOSED', () => {
    expect(canTransition('OPEN', 'CONTACTED')).toBe(true)
    expect(canTransition('CONTACTED', 'RESOLVED')).toBe(true)
    expect(canTransition('RESOLVED', 'CLOSED')).toBe(true)
  })

  it('lets a resolved case be reopened when the guest comes back', () => {
    expect(canTransition('RESOLVED', 'CONTACTED')).toBe(true)
  })

  it('treats CLOSED as terminal — that is what makes it different from RESOLVED', () => {
    expect(allowedTransitions('CLOSED')).toEqual([])
    for (const status of FOLLOW_UP_STATUSES) {
      expect(canTransition('CLOSED', status), `CLOSED -> ${status}`).toBe(false)
    }
  })

  it('refuses to go backwards to OPEN', () => {
    // OPEN means "nobody has touched this". Once someone has, that is no longer
    // true, and pretending otherwise would hide work that was actually done.
    for (const status of ['CONTACTED', 'RESOLVED', 'CLOSED']) {
      expect(canTransition(status, 'OPEN'), `${status} -> OPEN`).toBe(false)
    }
  })

  it('refuses a no-op transition to the same status', () => {
    for (const status of FOLLOW_UP_STATUSES) {
      expect(canTransition(status, status), status).toBe(false)
    }
  })

  it('rejects unknown statuses on both sides', () => {
    expect(canTransition('OPEN', 'ARCHIVED')).toBe(false)
    expect(canTransition('PENDING', 'CLOSED')).toBe(false)
    expect(allowedTransitions('NEW')).toEqual([])
    expect(isFollowUpStatus('NEW')).toBe(false)
  })

  it('can always reach CLOSED from any live state', () => {
    for (const status of ['OPEN', 'CONTACTED', 'RESOLVED']) {
      expect(canTransition(status, 'CLOSED'), status).toBe(true)
    }
  })
})
