import { Suspense } from 'react'
import { DateRangeFilter } from '@/components/admin/DateRangeFilter'
import { OutletSelector } from '@/components/admin/OutletSelector'
import { Sidebar } from '@/components/admin/Sidebar'
import { UserMenu } from '@/components/admin/UserMenu'
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
 * Visually this is the opposite of the kiosk on purpose: dense, desktop-first,
 * information before atmosphere.
 */
/**
 * Never prerendered, never cached.
 *
 * Every page under here is per-user and per-request: the role decides what
 * renders, and the rows come back scoped by RLS to whoever is asking. Next
 * would otherwise be free to statically render these — it does exactly that
 * when the build runs without Supabase configured, because the guard
 * short-circuits before `cookies()` is ever touched and no dynamic API is
 * observed. Relying on an implicit `cookies()` call to opt out is too subtle a
 * thing to have standing between one manager's dashboard and another's.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const outlet = await getOutlet()

  return (
    <div className="bg-ground flex min-h-dvh">
      <Sidebar role={user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface flex flex-wrap items-center justify-between gap-4 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <OutletSelector name={outlet.name} code={outlet.code} />
            {/* useSearchParams needs a Suspense boundary to keep the rest of
                the shell statically renderable. */}
            <Suspense fallback={null}>
              <DateRangeFilter />
            </Suspense>
          </div>

          <UserMenu name={user.name} email={user.email} role={user.role} />
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
