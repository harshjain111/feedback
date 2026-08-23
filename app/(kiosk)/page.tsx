import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { StartJourneyButton } from '@/components/kiosk/StartJourneyButton'
import { getConfig } from '@/lib/config'

/**
 * Screen 01 — Welcome (§4, §5).
 *
 * About agency, not data collection: it never asks for personal information and
 * never says "please rate us". One obvious CTA, and a line telling the guest
 * how little this will cost them.
 */
export default async function KioskWelcomePage() {
  const config = await getConfig()
  const { welcome } = config
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config}>
      <section
        className="flex flex-1 flex-col items-center justify-center text-center"
        style={{ paddingInline: px(64) }}
      >
        <h1 className="font-display text-k-display text-ink text-balance">{welcome.h1}</h1>

        <p className="font-display text-k-h2 text-ink-soft" style={{ marginTop: px(28) }}>
          {welcome.h2}
        </p>

        <p
          className="text-k-lead text-ink-muted text-pretty"
          style={{ marginTop: px(24), maxWidth: px(760) }}
        >
          {welcome.support}
        </p>

        <div style={{ marginTop: px(56) }}>
          <StartJourneyButton label={welcome.cta} />
        </div>

        <p className="text-k-small text-ink-muted" style={{ marginTop: px(24) }}>
          {welcome.micro}
        </p>
      </section>
    </KioskScreen>
  )
}
