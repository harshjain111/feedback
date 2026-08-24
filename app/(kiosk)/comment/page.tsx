import { CommentForm } from '@/components/kiosk/CommentForm'
import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { getConfig } from '@/lib/config'

/**
 * The general comment screen (§5).
 *
 * The "Optional" badge is visible, never hidden — a guest should be able to see
 * they can leave without typing before they decide whether to type.
 *
 * No artwork: the on-screen keyboard takes the bottom half of a tablet, and
 * competing with it for space is how a field ends up under the keys.
 */
export default async function KioskCommentPage() {
  const config = await getConfig()
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <KioskScreen config={config} density="dense">
      <section className="flex min-h-0 flex-1 flex-col">
        <header
          className="shrink-0 text-center"
          style={{ paddingInline: px(48), paddingTop: px(34), paddingBottom: px(24) }}
        >
          <h1 className="font-display text-k-h2 text-ink text-balance">{config.comment.h1}</h1>
          <p
            className="text-k-lead text-ink-muted mx-auto text-pretty"
            style={{ marginTop: px(12), maxWidth: px(840) }}
          >
            {config.comment.support}
          </p>
        </header>

        <CommentForm
          placeholder={config.comment.placeholder}
          badge={config.comment.badge}
          continueLabel={config.rate.cta}
        />
      </section>
    </KioskScreen>
  )
}
