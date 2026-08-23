import { describe, expect, it } from 'vitest'
import { actionsFor, can, canAll, ROLES, type Action, type Role } from '@/lib/permissions'

const actor = (role: Role, active = true) => ({ role, active })

describe('§8 role matrix', () => {
  it('gives OWNER everything', () => {
    const everything = ROLES.flatMap((role) => actionsFor(role))
    for (const action of new Set(everything)) {
      expect(can(actor('OWNER'), action), action).toBe(true)
    }
  })

  it('gives ADMIN everything except user deletion', () => {
    expect(can(actor('ADMIN'), 'manage:users')).toBe(true)
    expect(can(actor('ADMIN'), 'manage:cms')).toBe(true)
    expect(can(actor('ADMIN'), 'export:full_phone')).toBe(true)
    expect(can(actor('ADMIN'), 'delete:users')).toBe(false)
  })

  it('gives MANAGER operations but no CMS and no users', () => {
    for (const allowed of [
      'view:dashboard',
      'view:feedback',
      'view:guests',
      'view:reports',
      'manage:followups',
      'export:data',
    ] as Action[]) {
      expect(can(actor('MANAGER'), allowed), allowed).toBe(true)
    }

    for (const denied of [
      'manage:cms',
      'manage:users',
      'delete:users',
      'view:audit_log',
    ] as Action[]) {
      expect(can(actor('MANAGER'), denied), denied).toBe(false)
    }
  })

  it('exports for MANAGER never carry full phone numbers (§10)', () => {
    expect(can(actor('MANAGER'), 'export:data')).toBe(true)
    expect(can(actor('MANAGER'), 'export:full_phone')).toBe(false)
  })

  it('gives STAFF only their follow-ups and a read-only feedback list', () => {
    expect(can(actor('STAFF'), 'view:feedback')).toBe(true)
    expect(can(actor('STAFF'), 'manage:followups')).toBe(true)

    for (const denied of [
      'view:dashboard',
      'view:guests',
      'view:guest_phone',
      'view:analytics',
      'view:reports',
      'export:data',
      'export:full_phone',
      'manage:cms',
      'manage:users',
      'delete:users',
      'view:audit_log',
    ] as Action[]) {
      expect(can(actor('STAFF'), denied), denied).toBe(false)
    }
  })

  it('denies everything to a deactivated user, whatever their role', () => {
    for (const role of ROLES) {
      for (const action of actionsFor(role)) {
        expect(can(actor(role, false), action), `${role}/${action}`).toBe(false)
      }
    }
  })

  it('denies everything to nobody at all', () => {
    for (const action of actionsFor('OWNER')) {
      expect(can(null, action), action).toBe(false)
    }
  })

  it('canAll fails closed when any action is denied', () => {
    expect(canAll(actor('MANAGER'), ['view:feedback', 'view:guests'])).toBe(true)
    expect(canAll(actor('MANAGER'), ['view:feedback', 'manage:cms'])).toBe(false)
  })
})
