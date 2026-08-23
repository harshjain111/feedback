import { FollowUpChoice } from '@/components/kiosk/FollowUpChoice'
import { getConfig } from '@/lib/config'

/** Would you like us to follow up? (§4, §5) */
export default async function KioskFollowUpPage() {
  const config = await getConfig()

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-12 text-center">
        <h1 className="font-display text-k-h1 text-ink text-balance">{config.followup.h1}</h1>
        <p className="text-k-lead text-ink-muted mt-8 max-w-[820px] text-pretty">
          {config.followup.support}
        </p>
      </div>

      <FollowUpChoice yesLabel={config.followup.yes} noLabel={config.followup.no} />
    </section>
  )
}
