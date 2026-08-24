import type { Viewport } from 'next'
import { IdleResetProvider } from '@/components/kiosk/IdleResetProvider'
import { KioskFooter } from '@/components/kiosk/KioskFooter'
import { KioskHeartbeat } from '@/components/kiosk/KioskHeartbeat'
import { ServiceWorker } from '@/components/kiosk/ServiceWorker'
import { getConfig } from '@/lib/config'

/**
 * The kiosk shell — CLAUDE.md §4 and §6.
 *
 * Portrait only. Every size inside comes from --kpx (see globals.css), which is
 * derived from the real viewport, so the 1080×1920 design renders identically
 * on a tablet reporting 540×960 and cannot overflow it.
 *
 * h-dvh + overflow-hidden makes "no scrolling on any screen" structural rather
 * than something each screen has to remember; the comment screen opts its own
 * field back in when the keyboard appears.
 */

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FBF6EC',
}

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const config = await getConfig()

  return (
    <div className="kiosk-root bg-ground flex h-dvh justify-center overflow-hidden">
      <div
        className="flex h-dvh w-full flex-col overflow-hidden"
        style={{ maxWidth: 'calc(1080 * var(--kpx))' }}
      >
        <KioskHeartbeat />
      <ServiceWorker />
        <IdleResetProvider idleSeconds={config.kiosk.idle_seconds}>
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <KioskFooter config={config} />
        </IdleResetProvider>
      </div>
    </div>
  )
}
