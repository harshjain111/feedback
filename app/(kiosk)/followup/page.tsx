import { FollowUpChoice } from '@/components/kiosk/FollowUpChoice'
import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { getConfig } from '@/lib/config'

/** Would you like us to follow up? (§4, §5) */
export default async function KioskFollowUpPage() {
  const config = await getConfig()
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config}>
      <section className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex flex-1 flex-col items-center justify-center text-center"
          style={{ paddingInline: px(56) }}
        >
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.followup.h1}</h1>
          <p
            className="text-k-lead text-ink-muted text-pretty"
            style={{ marginTop: px(20), maxWidth: px(800) }}
          >
            {config.followup.support}
          </p>
        </div>

        <FollowUpChoice
          yesLabel={config.followup.yes}
          yesSubLabel={config.followup.yes_sub}
          noLabel={config.followup.no}
        />
      </section>
    </KioskScreen>
  )
}
