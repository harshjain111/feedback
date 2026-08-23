import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { LovedForm } from '@/components/kiosk/LovedForm'
import { getConfig, getIssues } from '@/lib/config'

/**
 * The positive pathway (§4, §5).
 *
 * Not a victory lap. Knowing WHAT created the delight is the management signal:
 * "4.8 overall" tells you nothing you can repeat, "Our Team — 62 mentions" does.
 */
export default async function KioskLovedPage() {
  const [config, issues] = await Promise.all([getConfig(), getIssues('positive')])
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config} tone="positive">
      <section className="flex min-h-0 flex-1 flex-col">
        <header
          className="shrink-0 text-center"
          style={{ paddingInline: px(48), paddingTop: px(8), paddingBottom: px(8) }}
        >
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.positive.h1}</h1>
          <p
            className="text-k-lead text-ink-muted mx-auto text-pretty"
            style={{ marginTop: px(12), maxWidth: px(820) }}
          >
            {config.positive.sub}
          </p>
        </header>

        <LovedForm issues={issues} heading={config.positive.h2} continueLabel={config.rate.cta} />
      </section>
    </KioskScreen>
  )
}
