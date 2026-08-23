import { Phone } from 'lucide-react'
import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { SubmitAndReset } from '@/components/kiosk/SubmitAndReset'
import { getConfig } from '@/lib/config'

/**
 * Screen 05 — Thank you (§4, §5).
 *
 * Emotional closure, then a way out. "You spoke. We listened." is the whole
 * promise of the product in four words, so it gets its own line rather than
 * being folded into the body copy.
 *
 * The grievance block is deliberately present and deliberately last: a guest
 * whose problem is bigger than a feedback form needs a person, and the number
 * is a real tel: link so one tap dials it.
 */
export default async function KioskThanksPage() {
  const config = await getConfig()
  const { thanks, grievance } = config
  const px = (n: number) => `calc(${n} * var(--kpx))`
  const dialable = grievance.phone.replace(/\s+/g, '')

  return (
    <KioskScreen config={config} density="airy">
      <section className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex flex-1 flex-col items-center justify-center text-center"
          style={{ paddingInline: px(64) }}
        >
          <h1 className="font-display text-k-h1 text-ink text-balance">{thanks.h1}</h1>

          <p
            className="text-k-lead text-ink-soft text-pretty"
            style={{ marginTop: px(28), maxWidth: px(840) }}
          >
            {thanks.body}
          </p>

          <p className="font-display text-k-h2 text-accent" style={{ marginTop: px(36) }}>
            {thanks.line}
          </p>

          <p className="text-k-body text-ink-muted" style={{ marginTop: px(20) }}>
            {thanks.support}
          </p>

          <div className="flex justify-center" style={{ marginTop: px(44) }}>
            <SubmitAndReset seconds={config.kiosk.thanks_seconds} />
          </div>
        </div>

        <aside
          className="bg-accent text-accent-ink shrink-0 text-center"
          style={{
            marginInline: px(40),
            marginBottom: px(24),
            padding: px(24),
            borderRadius: 'var(--radius-card)',
          }}
        >
          <h2 className="font-display text-k-h3">{grievance.h1}</h2>
          <p className="text-k-small" style={{ marginTop: px(6), opacity: 0.85 }}>
            {grievance.support}
          </p>
          {grievance.phone ? (
            <a
              href={`tel:${dialable}`}
              className="text-k-h3 inline-flex items-center font-semibold"
              style={{ gap: px(10), marginTop: px(12) }}
            >
              <Phone style={{ width: px(26), height: px(26) }} strokeWidth={2} aria-hidden="true" />
              {grievance.phone}
            </a>
          ) : null}
        </aside>
      </section>
    </KioskScreen>
  )
}
