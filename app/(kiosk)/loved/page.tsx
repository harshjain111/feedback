import { LovedForm } from '@/components/kiosk/LovedForm'
import { getConfig, getIssues } from '@/lib/config'

/** The positive pathway (§4, §5). */
export default async function KioskLovedPage() {
  const [config, issues] = await Promise.all([getConfig(), getIssues('positive')])

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-12 pt-12 pb-4 text-center">
        <h1 className="font-display text-k-h1 text-ink text-balance">{config.positive.h1}</h1>
        <p className="text-k-lead text-ink-muted mx-auto mt-5 max-w-[820px] text-pretty">
          {config.positive.sub}
        </p>
      </header>

      <LovedForm issues={issues} heading={config.positive.h2} continueLabel={config.rate.cta} />
    </section>
  )
}
