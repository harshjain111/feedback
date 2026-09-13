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

  /*
   * getClaims(), not getUser().
   *
   * getUser() is a NETWORK round trip to the Auth server on every single call,
   * and at ~340ms from this deployment that was showing up directly in TTFB —
   * twice per page, because the middleware made the same call again. This
   * project signs with ES256, so getClaims() verifies the token locally with
   * WebCrypto against a JWKS it fetches once and caches.
   *
   * The security difference is real but narrow: a token revoked server-side
   * stays cryptographically valid until it expires. It buys nothing here,
   * because access is decided by the app_users row read below — `active` is
   * checked on every request by requireUser(), and RLS re-checks underneath.
   * Deactivating someone still locks them out immediately.
   */
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (claimsError || !userId) return null

  const { data, error } = await supabase
    .from('app_users')
    .select('user_id, outlet_id, name, email, role, active')
    .eq('user_id', userId)
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
