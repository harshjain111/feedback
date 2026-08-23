'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { getCurrentUser } from '@/lib/auth'
import { can, isRole, type Role } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * User management (§42, Prompt 39).
 *
 * Creating the auth account needs the service role, which is why this lives in
 * a server action rather than being attempted from the client. Everything else
 * — the app_users row, the role, deactivation — goes through the RLS-bound
 * client so §8 is enforced by policy: ADMIN may do all of it except delete,
 * MANAGER and STAFF may do none of it, and the database says so even if this
 * file forgets to.
 */

export type UserActionResult = { ok: true; password?: string } | { ok: false; error: string }

const DENIED = 'You do not have permission to manage users.'

function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return [...randomBytes(16)].map((byte) => alphabet[byte % alphabet.length]).join('')
}

async function audit(action: string, entityId: string, before: unknown, after: unknown) {
  const user = await getCurrentUser()
  if (!user) return
  await createAdminClient()
    .from('audit_log')
    .insert({
      outlet_id: user.outletId,
      user_id: user.userId,
      action,
      entity: 'app_users',
      entity_id: entityId,
      before: before as never,
      after: after as never,
    })
}

export async function inviteUser(
  email: string,
  name: string,
  role: string,
): Promise<UserActionResult> {
  const actor = await getCurrentUser()
  if (!can(actor, 'manage:users')) return { ok: false, error: DENIED }
  if (!isRole(role)) return { ok: false, error: `Unknown role "${role}".` }

  // An ADMIN must not be able to mint an OWNER and escalate sideways.
  if (role === 'OWNER' && actor!.role !== 'OWNER') {
    return { ok: false, error: 'Only an owner can create another owner.' }
  }

  const trimmedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { ok: false, error: 'That does not look like an email address.' }
  }

  const admin = createAdminClient()
  const password = temporaryPassword()

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: true,
  })

  if (authError || !created?.user) {
    return {
      ok: false,
      error: /already/i.test(authError?.message ?? '')
        ? 'Someone already has an account with that email.'
        : (authError?.message ?? 'Could not create the account.'),
    }
  }

  // The app_users row is written through the RLS client on purpose: if the
  // caller is not allowed to create users, this fails even though the auth
  // account was made by the service role.
  const client = await createClient()
  const { data: written, error } = await client
    .from('app_users')
    .insert({
      user_id: created.user.id,
      outlet_id: actor!.outletId,
      name: name.trim() || trimmedEmail.split('@')[0]!,
      email: trimmedEmail,
      role: role as Role,
    })
    .select('user_id')

  if (error || !written || written.length === 0) {
    // Do not leave an auth account behind that the app cannot see.
    await admin.auth.admin.deleteUser(created.user.id)
    return { ok: false, error: error?.message ?? DENIED }
  }

  await audit('USER_INVITE', created.user.id, null, { email: trimmedEmail, role })
  revalidatePath('/admin/users')

  // Shown once. There is no mail transport configured, so handing the password
  // back is the only way the invitee ever gets in.
  return { ok: true, password }
}

export async function setUserRole(userId: string, role: string): Promise<UserActionResult> {
  const actor = await getCurrentUser()
  if (!can(actor, 'manage:users')) return { ok: false, error: DENIED }
  if (!isRole(role)) return { ok: false, error: `Unknown role "${role}".` }

  if (role === 'OWNER' && actor!.role !== 'OWNER') {
    return { ok: false, error: 'Only an owner can grant the owner role.' }
  }
  if (userId === actor!.userId) {
    // Losing your own admin rights by accident is a support call nobody enjoys.
    return { ok: false, error: 'You cannot change your own role.' }
  }

  const client = await createClient()
  const { data: before } = await client
    .from('app_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: written, error } = await client
    .from('app_users')
    .update({ role: role as Role })
    .eq('user_id', userId)
    .select('user_id')

  if (error) return { ok: false, error: error.message }
  if (!written || written.length === 0) return { ok: false, error: DENIED }

  await audit('USER_ROLE_CHANGE', userId, before, { role })
  revalidatePath('/admin/users')
  return { ok: true }
}

export async function setUserActive(userId: string, active: boolean): Promise<UserActionResult> {
  const actor = await getCurrentUser()
  if (!can(actor, 'manage:users')) return { ok: false, error: DENIED }
  if (userId === actor!.userId) {
    return { ok: false, error: 'You cannot deactivate your own account.' }
  }

  const client = await createClient()
  const { data: written, error } = await client
    .from('app_users')
    .update({ active })
    .eq('user_id', userId)
    .select('user_id')

  if (error) return { ok: false, error: error.message }
  if (!written || written.length === 0) return { ok: false, error: DENIED }

  await audit('USER_ACTIVE_CHANGE', userId, null, { active })
  revalidatePath('/admin/users')
  return { ok: true }
}

/**
 * Deletion is OWNER-only (§8: ADMIN is "everything except user deletion").
 * The RLS policy enforces it too; this check just fails faster and clearer.
 */
export async function deleteUser(userId: string): Promise<UserActionResult> {
  const actor = await getCurrentUser()
  if (!can(actor, 'delete:users')) {
    return { ok: false, error: 'Only an owner can delete a user. Deactivate them instead.' }
  }
  if (userId === actor!.userId) {
    return { ok: false, error: 'You cannot delete your own account.' }
  }

  const client = await createClient()
  const { data: deleted, error } = await client
    .from('app_users')
    .delete()
    .eq('user_id', userId)
    .select('user_id')

  if (error) return { ok: false, error: error.message }
  if (!deleted || deleted.length === 0) return { ok: false, error: DENIED }

  await createAdminClient().auth.admin.deleteUser(userId)
  await audit('USER_DELETE', userId, { user_id: userId }, null)
  revalidatePath('/admin/users')
  return { ok: true }
}
