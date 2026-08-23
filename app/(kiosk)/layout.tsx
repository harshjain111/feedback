import type { Viewport } from 'next'
import { IdleResetProvider } from '@/components/kiosk/IdleResetProvider'
import { KioskFooter } from '@/components/kiosk/KioskFooter'
import { KioskHeartbeat } from '@/components/kiosk/KioskHeartbeat'
import { getConfig } from '@/lib/config'

/**
 * The kiosk shell — CLAUDE.md §4 and §6.
 *
 * Portrait only, designed at 1080×1920. This is a dedicated kiosk app, not a
 * responsive site: the max-width simply keeps it sane in a desktop browser
 * during review. No scrolling anywhere except the comment screen, which opts
 * back in for itself when the on-screen keyboard appears.
 */

/**
 * Never statically prerendered.
 *
 * Every string on every kiosk screen comes from app_config, so a build-time
 * prerender would bake today's copy into the HTML and a CMS edit would need a
 * redeploy to appear — which is exactly what §3 and the Prompt 35 checkpoint
 * forbid. Rendering per request costs nothing here: getConfig() is behind a 60s
 * cache, so the database is hit at most once a minute regardless of traffic.
 */
export const dynamic = 'force-dynamic'

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
        <KioskHeartbeat />
        <IdleResetProvider idleSeconds={config.kiosk.idle_seconds}>
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <KioskFooter config={config} />
        </IdleResetProvider>
      </div>
    </div>
  )
}
