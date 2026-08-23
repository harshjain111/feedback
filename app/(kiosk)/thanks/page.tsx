import { SubmitAndReset } from '@/components/kiosk/SubmitAndReset'
import { getConfig } from '@/lib/config'

/**
 * Screen 05 — Thank you (§4, §5).
 *
 * Emotional closure, then a way out. "You spoke. We listened." is the whole
 * promise of the product in four words, so it is given its own line rather than
 * being folded into the body copy.
 *
 * The grievance block is deliberately at the bottom and deliberately present: a
 * guest whose problem is bigger than a feedback form needs a person, and the
 * number is a real tel: link so one tap dials it.
 */
export default async function KioskThanksPage() {
  const config = await getConfig()
  const { thanks, grievance } = config

  const dialable = grievance.phone.replace(/\s+/g, '')

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-16 text-center">
        <h1 className="font-display text-k-h1 text-ink text-balance">{thanks.h1}</h1>

        <p className="text-k-lead text-ink-soft mt-10 max-w-[840px] text-pretty">{thanks.body}</p>

        <p className="font-display text-k-h2 text-accent mt-12">{thanks.line}</p>

        <p className="text-k-body text-ink-muted mt-8">{thanks.support}</p>

        <div className="mt-16 flex justify-center">
          <SubmitAndReset seconds={config.kiosk.thanks_seconds} />
        </div>
      </div>

      <aside className="border-line bg-ground-sunk shrink-0 border-t px-16 py-8 text-center">
        <h2 className="font-display text-k-h3 text-ink">{grievance.h1}</h2>
        <p className="text-k-small text-ink-muted mt-3">{grievance.support}</p>
        {grievance.phone ? (
          <a
            href={`tel:${dialable}`}
            className="text-k-h3 text-accent mt-4 inline-block font-semibold"
          >
            📞 {grievance.phone}
          </a>
        ) : null}
      </aside>
    </section>
  )
}
