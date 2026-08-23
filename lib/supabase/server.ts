import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { supabaseAnonKey, supabaseUrl } from './env'

/**
 * Server client — anon key + the caller's session cookie, so RLS applies as that
 * user. This is the client every admin Server Component and Server Action uses.
 *
 * For the kiosk's unauthenticated write path use `lib/supabase/admin.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware; ignoring here is correct.
        }
      },
    },
  })
}
