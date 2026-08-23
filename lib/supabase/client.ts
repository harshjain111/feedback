'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { supabaseAnonKey, supabaseUrl } from './env'

/**
 * Browser client — anon key, RLS enforced.
 *
 * Used by the ADMIN app only (login, client-side auth state). The kiosk never
 * talks to Supabase from the browser: it reads config through Server Components
 * and writes through POST /api/feedback (CLAUDE.md §7 RLS).
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
}
