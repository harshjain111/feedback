import { Suspense } from 'react'
import { DateRangeFilter } from '@/components/admin/DateRangeFilter'
import { OutletSelector } from '@/components/admin/OutletSelector'
import { DeviceHealth } from '@/components/admin/DeviceHealth'
import { Sidebar } from '@/components/admin/Sidebar'
import { HeaderSkeleton } from '@/components/admin/Skeleton'
import { requireUser, type CurrentUser } from '@/lib/auth'
import { getConfig, getOutlet } from '@/lib/config'
import { can } from '@/lib/permissions'
import { memorySwitch, BLOCKED_LABELS } from '@/lib/memory-switch'
import { getKiosks } from '@/lib/queries/kiosks'

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
  /*
   * ONLY the guard is awaited here, and that is the point.
   *
   * This used to also await the outlet, the config and a kiosks row before
   * returning any markup, so nothing at all was painted — no sidebar, no
   * heading, no skeleton — until four round trips had completed. On a slow link
   * that reads as a frozen app, which is exactly the complaint. Everything the
   * chrome needs now streams in behind its own boundary while the shell and the
   * page render immediately.
   */
  const user = await requireUser()

  return (
    <div className="flex min-h-dvh" style={{ background: 'var(--color-admin-bg)' }}>
      <Sidebar role={user.role} name={user.name} email={user.email} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface flex flex-wrap items-center justify-between gap-4 border-b px-6 py-3">
          <Suspense fallback={<HeaderSkeleton />}>
            <ShellChrome user={user} />
          </Suspense>

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

/**
 * The parts of the header that need the database: which outlet this is, and
 * whether the kiosk's printer and camera are alive.
 *
 * Device health belongs in the shell rather than on the dashboard because a
 * printer that jammed while a manager is reading the feedback list is still a
 * printer that jammed (§6).
 */
async function ShellChrome({ user }: { user: CurrentUser }) {
  const [outlet, config, kiosks] = await Promise.all([getOutlet(), getConfig(), getKiosks()])

  const state = memorySwitch(config.memory)
  const blockedReason =
    state.blockedBy === null || state.blockedBy === 'master'
      ? null
      : BLOCKED_LABELS[state.blockedBy]

  const kiosk = kiosks[0]

  return (
    <>
      <OutletSelector name={outlet.name} code={outlet.code} />

      <DeviceHealth
        printerStatus={kiosk?.printerStatus ?? 'unknown'}
        cameraStatus={kiosk?.cameraStatus ?? 'unknown'}
        memoryEnabled={config.memory.enabled}
        canToggle={can(user, 'manage:cms')}
        blockedReason={blockedReason}
      />
    </>
  )
}
