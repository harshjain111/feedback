import { CommentForm } from '@/components/kiosk/CommentForm'
import { getConfig } from '@/lib/config'

/**
 * The general comment screen (§5).
 *
 * The "Optional" badge is visible, never hidden — a guest should be able to see
 * they can leave without typing before they decide whether to type.
 */
export default async function KioskCommentPage() {
  const config = await getConfig()

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-12 pt-12 pb-2 text-center">
        <h1 className="font-display text-k-h2 text-ink text-balance">{config.comment.h1}</h1>
        <p className="text-k-lead text-ink-muted mx-auto mt-5 max-w-[840px] text-pretty">
          {config.comment.support}
        </p>
      </header>

      <CommentForm
        placeholder={config.comment.placeholder}
        badge={config.comment.badge}
        continueLabel={config.rate.cta}
      />
    </section>
  )
}
