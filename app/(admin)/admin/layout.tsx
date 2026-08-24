import { Suspense } from 'react'
import { DateRangeFilter } from '@/components/admin/DateRangeFilter'
import { OutletSelector } from '@/components/admin/OutletSelector'
import { DeviceHealth } from '@/components/admin/DeviceHealth'
import { Sidebar } from '@/components/admin/Sidebar'
import { requireUser } from '@/lib/auth'
import { getConfig, getOutlet } from '@/lib/config'
import { can } from '@/lib/permissions'
import { memorySwitch, BLOCKED_LABELS } from '@/lib/memory-switch'
import { createClient } from '@/lib/supabase/server'

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
  const [outlet, config] = await Promise.all([getOutlet(), getConfig()])

  /*
   * Device health, read straight from the kiosk's own heartbeat (§6). Cheap —
   * one row — and it belongs in the layout rather than on the dashboard because
   * a printer that jammed while a manager is reading the feedback list is still
   * a printer that jammed.
   */
  const supabase = await createClient()
  const { data: kiosk } = await supabase
    .from('kiosks')
    .select('printer_status, camera_status')
    .eq('outlet_id', user.outletId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  const state = memorySwitch(config.memory)
  const blockedReason =
    state.blockedBy === null || state.blockedBy === 'master'
      ? null
      : BLOCKED_LABELS[state.blockedBy]

  return (
    <div className="flex min-h-dvh" style={{ background: 'var(--color-admin-bg)' }}>
      <Sidebar role={user.role} name={user.name} email={user.email} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface flex flex-wrap items-center justify-between gap-4 border-b px-6 py-3">
          <OutletSelector name={outlet.name} code={outlet.code} />

          <DeviceHealth
            printerStatus={kiosk?.printer_status ?? 'unknown'}
            cameraStatus={kiosk?.camera_status ?? 'unknown'}
            memoryEnabled={config.memory.enabled}
            canToggle={can(user, 'manage:cms')}
            blockedReason={blockedReason}
          />
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
