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

/** True when both halves of the Supabase configuration are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Allow the loaders to serve seeded reference data instead of hitting Supabase.
 *
 * Only outside production, and only when Supabase is not configured at all. It
 * exists so the kiosk can be rendered and clicked through locally before a
 * project is provisioned; in production a missing key must still fail loudly
 * rather than quietly serving stale copy.
 */
export function allowOfflineSeedFallback(): boolean {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== 'production'
}
