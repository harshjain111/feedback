// `server-only` makes importing this file from a client component a BUILD error,
// not a runtime one. It is the first line of defence for CLAUDE.md §13.6.
import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { supabaseServiceRoleKey, supabaseUrl } from './env'

/**
 * Service-role client — BYPASSES ROW LEVEL SECURITY.
 *
 * The only legitimate callers are server-side route handlers that must write on
 * behalf of an unauthenticated kiosk (POST /api/feedback) or run maintenance
 * jobs. Never import this into a Server Component that renders admin data —
 * those must go through `server.ts` so the caller's RLS policies apply.
 *
 * CLAUDE.md §13.6: the service role key is server-only, never in a client
 * component, never in a NEXT_PUBLIC_* variable.
 */
export function createAdminClient() {
  // Second line of defence: if bundling ever slips this into the browser, fail
  // loudly at the call site rather than quietly shipping a god-mode key.
  if (typeof window !== 'undefined') {
    throw new Error(
      'lib/supabase/admin.ts was imported into a client bundle. ' +
        'The service role key must never reach the browser (CLAUDE.md §13.6).',
    )
  }

  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
