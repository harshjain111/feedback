import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/admin/LoginForm'
import { getCurrentUser } from '@/lib/auth'

/**
 * Admin sign-in (§1: email + password, admin/staff only — the kiosk is public
 * and never sees this).
 *
 * Its own page outside the guarded layout, otherwise the guard would redirect
 * the login page to itself.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  const { next } = await searchParams

  if (user?.active) redirect(next ?? '/admin')

  return (
    <main className="bg-ground flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-accent text-xs font-semibold tracking-[0.18em] uppercase">
          All India Café
        </p>
        <h1 className="font-display text-ink mt-3 text-3xl">Customer Experience Intelligence</h1>
        <p className="text-ink-muted mt-2 text-sm">Sign in to continue.</p>

        <div className="border-line bg-surface mt-8 rounded-2xl border p-8">
          <LoginForm next={next ?? '/admin'} />
        </div>
      </div>
    </main>
  )
}
