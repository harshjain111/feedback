import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { getConfig } from '@/lib/config'

/**
 * What a guest sees if the network is gone at the moment they arrive.
 *
 * Deliberately not an error, and deliberately not apologetic about a fault the
 * guest did not cause and cannot fix. It says the terminal is coming back and
 * gets out of the way.
 *
 * A guest already mid-journey never reaches this: their draft is in
 * sessionStorage and their submission queues in IndexedDB (§43), so an outage
 * costs them nothing and costs the café no feedback.
 *
 * Precached by the service worker, so it can be served with no network at all.
 */
export default async function KioskOfflinePage() {
  const config = await getConfig()
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config} density="airy">
      <section
        className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"
        style={{ paddingInline: px(64) }}
      >
        <h1 className="font-display text-k-h1 text-ink text-balance">One moment.</h1>

        <p
          className="text-k-lead text-ink-soft text-pretty"
          style={{ marginTop: px(26), maxWidth: px(820) }}
        >
          We&rsquo;ll be right back.
        </p>

        <span
          className="bg-line relative overflow-hidden rounded-full"
          style={{ width: px(180), height: px(6), marginTop: px(48) }}
        >
          <span
            className="bg-accent k-sweep absolute inset-y-0 rounded-full"
            style={{ width: '30%' }}
          />
        </span>
      </section>
    </KioskScreen>
  )
}
