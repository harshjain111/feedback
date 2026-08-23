import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'
import { isSupabaseConfigured } from './supabase/env'
import { isRole, type Role } from './permissions'

/**
 * Who is asking — CLAUDE.md §8.
 *
 * Reads the Supabase session, then the caller's `app_users` row, which is where
 * the outlet and role actually live. Both are needed: a valid Supabase session
 * with no app_users row is someone who has an account but no access, and must
 * be treated as signed out rather than as a default role.
 */

export type CurrentUser = {
  userId: string
  outletId: string
  name: string
  email: string
  role: Role
  active: boolean
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // No Supabase configured means nobody can be signed in. Returning null rather
  // than throwing keeps the guard's behaviour correct — redirect to login —
  // instead of turning a misconfiguration into a 500 on every admin route.
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, outlet_id, name, email, role, active')
    .eq('user_id', user.id)
    .maybeSingle()

  // Checked separately, not as `error || !data`: the Postgrest result is a
  // discriminated union on `error`, and testing both at once collapses `data`
  // to never.
  if (error) return null
  if (!data) return null

  if (!isRole(data.role)) {
    console.error(`[auth] app_users.${data.user_id} has unknown role "${data.role}"`)
    return null
  }

  return {
    userId: data.user_id,
    outletId: data.outlet_id,
    name: data.name,
    email: data.email,
    role: data.role,
    active: data.active,
  }
})

/**
 * Guard for every admin route. Redirects to login rather than rendering a
 * half-empty page, and carries the attempted path so the user lands where they
 * were going.
 */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser()

  if (!user || !user.active) {
    const target = returnTo ? `/admin/login?next=${encodeURIComponent(returnTo)}` : '/admin/login'
    redirect(target)
  }

  return user
}
