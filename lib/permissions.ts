/**
 * The §8 role matrix, in one place.
 *
 * | OWNER   | Everything                                                     |
 * | ADMIN   | Everything except user deletion — system configuration owner    |
 * | MANAGER | Dashboard, feedback, guests, follow-ups, reports, export.       |
 * |         | No CMS, no users.                                              |
 * | STAFF   | Only follow-ups assigned to them + feedback list (read).        |
 * |         | No guest phone numbers, no export.                              |
 *
 * This is the UI and route-guard half. The other half lives in RLS policies
 * (0003_rls.sql), and §8 is explicit that UI hiding alone is never enough —
 * every rule here has a policy behind it that would stop the request anyway.
 */

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

export type Action =
  // Reading
  | 'view:dashboard'
  | 'view:feedback'
  | 'view:analytics'
  | 'view:reports'
  | 'view:guests'
  | 'view:guest_phone'
  | 'view:audit_log'
  | 'view:alerts'
  // Doing
  | 'manage:followups'
  | 'acknowledge:alerts'
  | 'export:data'
  | 'export:full_phone'
  // Configuring
  | 'manage:cms'
  | 'manage:users'
  | 'delete:users'

const MATRIX: Record<Action, readonly Role[]> = {
  'view:dashboard': ['OWNER', 'ADMIN', 'MANAGER'],
  // STAFF gets a read-only feedback list — they need context for the follow-up
  // they were assigned.
  'view:feedback': ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'],
  'view:analytics': ['OWNER', 'ADMIN', 'MANAGER'],
  'view:reports': ['OWNER', 'ADMIN', 'MANAGER'],
  'view:guests': ['OWNER', 'ADMIN', 'MANAGER'],
  // Even for MANAGER+ this only unlocks the reveal action, which is
  // audit-logged. Lists always show the masked number (§11).
  'view:guest_phone': ['OWNER', 'ADMIN', 'MANAGER'],
  'view:audit_log': ['OWNER', 'ADMIN'],
  'view:alerts': ['OWNER', 'ADMIN', 'MANAGER'],

  // STAFF may work their own assignments; scoping to "their own" is enforced by
  // RLS and by the detail route, not by this flag.
  'manage:followups': ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'],
  'acknowledge:alerts': ['OWNER', 'ADMIN', 'MANAGER'],
  'export:data': ['OWNER', 'ADMIN', 'MANAGER'],
  'export:full_phone': ['OWNER', 'ADMIN'],

  'manage:cms': ['OWNER', 'ADMIN'],
  'manage:users': ['OWNER', 'ADMIN'],
  // §8: ADMIN is "everything except billing/user deletion".
  'delete:users': ['OWNER'],
}

export type Actor = { role: Role; active: boolean } | null

/** The single question every guard and every conditional UI branch asks. */
export function can(actor: Actor, action: Action): boolean {
  if (!actor || !actor.active) return false
  return MATRIX[action].includes(actor.role)
}

/** Convenience for route guards that need to fail closed on several actions. */
export function canAll(actor: Actor, actions: Action[]): boolean {
  return actions.every((action) => can(actor, action))
}

/** Every action a role holds — used by the settings UI and the §8 tests. */
export function actionsFor(role: Role): Action[] {
  return (Object.keys(MATRIX) as Action[]).filter((action) => MATRIX[action].includes(role))
}
