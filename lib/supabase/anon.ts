import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from './env'
import type { Database } from '@/types/database'

/**
 * A Supabase client with no session — literally the `anon` role.
 *
 * Distinct from `client.ts` (browser, may carry a user session) and from
 * `admin.ts` (service role, bypasses RLS entirely). This exists for exactly one
 * caller: the Memory Print Module's uptake PATCH, whose reach is bounded by a
 * column-level GRANT rather than by trust.
 *
 * `server-only` because the anon key is public but the intent is not: this is
 * the deliberate least-privilege path, and importing it into a client bundle
 * would make that harder to reason about, not easier.
 */
export function createAnonClient() {
  return createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
