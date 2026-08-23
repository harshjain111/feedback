import { RateForm } from '@/components/kiosk/RateForm'
import { getCategories, getConfig, getRatingScale } from '@/lib/config'

/**
 * Screen 02 — Main Feedback (§4, §5).
 *
 * The subheading is load-bearing: "Good, bad or somewhere in between — tell us
 * honestly." grants explicit permission to criticise, which is what makes the
 * scores worth anything. It is never softened here; only the CMS may change it.
 */
export default async function KioskRatePage() {
  const [config, categories, scale] = await Promise.all([
    getConfig(),
    getCategories(),
    getRatingScale(),
  ])

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-12 pt-12 pb-6 text-center">
        <h1 className="font-display text-k-h1 text-ink">{config.rate.h1}</h1>
        <p className="text-k-lead text-ink-muted mx-auto mt-5 max-w-[820px] text-pretty">
          {config.rate.sub}
        </p>
      </header>

      <RateForm categories={categories} scale={scale} continueLabel={config.rate.cta} />
    </section>
  )
}
