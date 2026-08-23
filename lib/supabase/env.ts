/**
 * Environment access for the Supabase clients.
 *
 * Reading `process.env` through named getters (rather than inline) keeps every
 * failure a loud, named error at boot instead of an undefined URL that surfaces
 * as an opaque fetch error three layers deep.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}

export function supabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/** SERVER ONLY. Never call this from a module that a client component imports. */
export function supabaseServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** The outlet this deployment serves — every query is scoped by it (§43). */
export function outletCode(): string {
  return process.env.NEXT_PUBLIC_OUTLET_CODE ?? 'AIC'
}
