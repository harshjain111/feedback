import type { Viewport } from 'next'
import { IdleResetProvider } from '@/components/kiosk/IdleResetProvider'
import { KioskFooter } from '@/components/kiosk/KioskFooter'
import { getConfig } from '@/lib/config'

/**
 * The kiosk shell — CLAUDE.md §4 and §6.
 *
 * Portrait only, designed at 1080×1920. This is a dedicated kiosk app, not a
 * responsive site: the max-width simply keeps it sane in a desktop browser
 * during review. No scrolling anywhere except the comment screen, which opts
 * back in for itself when the on-screen keyboard appears.
 */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FBF8F2',
}

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const config = await getConfig()

  return (
    // h-dvh + overflow-hidden, not min-h: "no scrolling on any screen" (§6) has
    // to be structurally true, not a thing each screen remembers to honour. The
    // comment screen opts its own textarea back in when the keyboard appears.
    <div className="kiosk-root bg-ground flex h-dvh justify-center overflow-hidden">
      <div className="flex h-dvh w-full max-w-[1080px] flex-col overflow-hidden">
        <IdleResetProvider idleSeconds={config.kiosk.idle_seconds}>
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <KioskFooter config={config} />
        </IdleResetProvider>
      </div>
    </div>
  )
}
