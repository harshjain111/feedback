import { IssuesForm } from '@/components/kiosk/IssuesForm'
import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { getConfig, getIssues } from '@/lib/config'

/**
 * The negative pathway (§4, §5).
 *
 * The first thing the guest sees is "THANK YOU FOR TELLING US." — not an
 * apology, not a defence. The job of this screen is to move them from anger to
 * expression, which means thanking them for the thing they expected would
 * annoy us. The warm tint says, without words, that they are somewhere else now.
 */
export default async function KioskIssuesPage() {
  const [config, issues] = await Promise.all([getConfig(), getIssues('negative')])
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config} tone="negative" density="dense">
      <section className="flex min-h-0 flex-1 flex-col">
        {/*
          Padded top and bottom so the headline sits BETWEEN the mark and the
          content rather than under the mark with the gap below it. Tuned once
          the plaque replaced the small drawn stamp, which is about twice its
          height.
        */}
        <header
          className="shrink-0 text-center"
          style={{ paddingInline: px(48), paddingTop: px(34), paddingBottom: px(30) }}
        >
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.negative.h1}</h1>
          <p
            className="text-k-lead text-ink-muted mx-auto text-pretty"
            style={{ marginTop: px(12), maxWidth: px(820) }}
          >
            {config.negative.sub}
          </p>
        </header>

        <IssuesForm
          issues={issues}
          copy={config.negative}
          commentCopy={config.comment}
          continueLabel={config.rate.cta}
        />
      </section>
    </KioskScreen>
  )
}
