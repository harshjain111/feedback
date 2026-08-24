import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { StartJourneyButton } from '@/components/kiosk/StartJourneyButton'
import { getConfig } from '@/lib/config'

/**
 * Screen 01 — Welcome (§4, §5).
 *
 * About agency, not data collection: it never asks for personal information and
 * never says "please rate us". One obvious CTA, and a line telling the guest
 * how little this will cost them.
 *
 * THE COMPOSITION. Three bands rather than one centred stack, because a stack
 * centred in a 1920px column leaves a quarter of the screen empty above it and
 * the mark stranded at the top. Here the headline sits directly under the logo,
 * the CTA takes the middle where a standing guest's eye and hand both land, and
 * the supporting lines close the bottom. Each band grows to fill its share, so
 * the screen is distributed rather than pooled.
 *
 * The copy is §5's, verbatim and unchanged. Only the ORDER moved: the support
 * line now sits below the button rather than above it, so nothing separates the
 * headline from the action. §5 fixes the words, not their arrangement.
 */
export default async function KioskWelcomePage() {
  const config = await getConfig()
  const { welcome } = config
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config}>
      <section
        className="flex flex-1 flex-col items-center text-center"
        /*
         * The bottom pad is large on purpose. The scrim holds to about 80% of
         * the height and then clears so the rickshaw and the teacup stay vivid
         * — which means anything sitting in the last fifth is text on a
         * watercolour. The closing lines stop above that line rather than the
         * artwork being muted to accommodate them.
         */
        style={{ paddingInline: px(64), paddingTop: px(16), paddingBottom: px(300) }}
      >
        {/* Band 1 — the promise, tight under the mark. */}
        <div className="flex flex-col items-center">
          <h1 className="font-display text-k-display text-ink text-balance">{welcome.h1}</h1>

          <p className="font-display text-k-h2 text-ink-soft" style={{ marginTop: px(16) }}>
            {welcome.h2}
          </p>
        </div>

        {/*
          Band 2 — the action, dead centre. flex-1 on both spacers is what keeps
          it there whatever the headline wraps to, rather than a fixed margin
          that drifts the moment the copy is edited in the CMS.
        */}
        <div className="flex flex-1 flex-col items-center justify-center">
          {/*
            5% larger than the standard CTA. This is the only button on the
            screen and the only thing a guest has to find from across a room, so
            it is allowed to be bigger than the ones that appear beside others.
          */}
          <StartJourneyButton label={welcome.cta} scale={1.05} />
        </div>

        {/* Band 3 — the reassurance, closing the foot. */}
        <div className="flex flex-col items-center">
          <p className="text-k-lead text-ink-muted text-pretty" style={{ maxWidth: px(780) }}>
            {welcome.support}
          </p>

          <p className="text-k-small text-ink-muted" style={{ marginTop: px(18) }}>
            {welcome.micro}
          </p>
        </div>
      </section>
    </KioskScreen>
  )
}
