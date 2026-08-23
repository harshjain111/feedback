import { IssuesForm } from '@/components/kiosk/IssuesForm'
import { getConfig, getIssues } from '@/lib/config'

/**
 * The negative pathway (§4, §5).
 *
 * The first thing the guest sees is "THANK YOU FOR TELLING US." — not an
 * apology, not a defence. The job of this screen is to move them from anger to
 * expression, which means thanking them for the thing they were worried would
 * annoy us.
 */
export default async function KioskIssuesPage() {
  const [config, issues] = await Promise.all([getConfig(), getIssues('negative')])

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-12 pt-12 pb-4 text-center">
        <h1 className="font-display text-k-h1 text-ink text-balance">{config.negative.h1}</h1>
        <p className="text-k-lead text-ink-muted mx-auto mt-5 max-w-[820px] text-pretty">
          {config.negative.sub}
        </p>
      </header>

      <IssuesForm issues={issues} copy={config.negative} continueLabel={config.rate.cta} />
    </section>
  )
}
