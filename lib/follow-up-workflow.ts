/**
 * The follow-up state machine (§30).
 *
 * Kept out of lib/actions/follow-ups.ts because every export of a `'use server'`
 * module must be an async function — and because a state machine should be
 * testable without a request.
 */

export const FOLLOW_UP_STATUSES = ['OPEN', 'CONTACTED', 'RESOLVED', 'CLOSED'] as const
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number]

/**
 * RESOLVED → CONTACTED exists on purpose: a guest who comes back still unhappy
 * needs the case reopened, and starting a new follow-up would lose the thread.
 * CLOSED is terminal — that is exactly what distinguishes it from RESOLVED.
 */
const TRANSITIONS: Record<FollowUpStatus, readonly FollowUpStatus[]> = {
  OPEN: ['CONTACTED', 'RESOLVED', 'CLOSED'],
  CONTACTED: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CONTACTED', 'CLOSED'],
  CLOSED: [],
}

export function isFollowUpStatus(value: string): value is FollowUpStatus {
  return (FOLLOW_UP_STATUSES as readonly string[]).includes(value)
}

export function allowedTransitions(from: string): FollowUpStatus[] {
  return isFollowUpStatus(from) ? [...TRANSITIONS[from]] : []
}

export function canTransition(from: string, to: string): boolean {
  return isFollowUpStatus(to) && allowedTransitions(from).includes(to)
}
