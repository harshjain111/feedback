import { Suspense } from 'react'
import { DateRangeFilter } from '@/components/admin/DateRangeFilter'
import { OutletSelector } from '@/components/admin/OutletSelector'
import { Sidebar } from '@/components/admin/Sidebar'
import { requireUser } from '@/lib/auth'
import { getOutlet } from '@/lib/config'

/**
 * The admin shell (§19).
 *
 * The guard lives here so no page under /admin can render without it — there is
 * no "forgot to add the check to the new page" failure mode. Per-action
 * permissions are still checked in the pages, and RLS checks everything again
 * underneath.
 *
 * Visually the opposite of the kiosk on purpose: dark chrome, light canvas,
 * dense and information-first. The kiosk is read once by a stranger; this is
 * read every morning by someone who knows it.
 */

/**
 * Never prerendered, never cached. Every page here is per-user and per-request:
 * the role decides what renders and RLS scopes the rows. Relying on an implicit
 * cookies() call to opt out is too subtle a thing to stand between one
 * manager's dashboard and another's.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const outlet = await getOutlet()

  return (
    <div className="flex min-h-dvh" style={{ background: 'var(--color-admin-bg)' }}>
      <Sidebar role={user.role} name={user.name} email={user.email} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface flex flex-wrap items-center justify-between gap-4 border-b px-6 py-3">
          <OutletSelector name={outlet.name} code={outlet.code} />
          {/* useSearchParams needs a Suspense boundary to keep the rest of the
              shell statically renderable. */}
          <Suspense fallback={null}>
            <DateRangeFilter />
          </Suspense>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
