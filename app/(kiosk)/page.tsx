import { StartJourneyButton } from '@/components/kiosk/StartJourneyButton'
import { getConfig } from '@/lib/config'

/**
 * Screen 01 — Welcome (§4, §5).
 *
 * This screen is about agency, not data collection: it never asks for personal
 * information and never says "please rate us". One obvious CTA, and a line that
 * tells the guest how little this will cost them.
 *
 * Every string is read from config — nothing here is typed.
 */
export default async function KioskWelcomePage() {
  const config = await getConfig()
  const { welcome } = config

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-16 text-center">
      <h1 className="font-display text-k-h1 text-ink max-w-[900px] text-balance">{welcome.h1}</h1>

      <p className="font-display text-k-h2 text-ink-soft mt-10">{welcome.h2}</p>

      <p className="text-k-lead text-ink-muted mt-8 max-w-[760px] text-pretty">{welcome.support}</p>

      <div className="mt-20">
        <StartJourneyButton label={welcome.cta} />
      </div>

      <p className="text-k-small text-ink-muted mt-10">{welcome.micro}</p>
    </section>
  )
}
