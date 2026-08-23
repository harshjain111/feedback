import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { RateForm } from '@/components/kiosk/RateForm'
import { getCategories, getConfig, getRatingScale } from '@/lib/config'

/**
 * Screen 02 — Main Feedback (§4, §5).
 *
 * The subheading is load-bearing: "Good, bad or somewhere in between — tell us
 * honestly." grants explicit permission to criticise, which is what makes the
 * scores worth anything. Never softened here; only the CMS may change it.
 *
 * No artwork band: four category cards need the height.
 */
export default async function KioskRatePage() {
  const [config, categories, scale] = await Promise.all([
    getConfig(),
    getCategories(),
    getRatingScale(),
  ])
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config} density="dense">
      <section className="flex min-h-0 flex-1 flex-col">
        <header
          className="shrink-0 text-center"
          style={{ paddingInline: px(48), paddingTop: px(8), paddingBottom: px(16) }}
        >
          <h1 className="font-display text-k-h1 text-ink">{config.rate.h1}</h1>
          <p
            className="text-k-lead text-ink-muted mx-auto text-pretty"
            style={{ marginTop: px(10), maxWidth: px(820) }}
          >
            {config.rate.sub}
          </p>
        </header>

        <RateForm categories={categories} scale={scale} continueLabel={config.rate.cta} />
      </section>
    </KioskScreen>
  )
}
