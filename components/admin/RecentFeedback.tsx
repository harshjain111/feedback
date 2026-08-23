import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { PanelEmpty } from './Panel'
import { StatusBadge } from './StatusBadge'
import type { FeedbackListItem } from '@/lib/queries/types'
import type { RatingFace } from '@/lib/config.types'

/**
 * The last few submissions, on the dashboard (§14.6 — Raw Data, last).
 *
 * Not the full §29 table. That one has ten columns and a filter bar because it
 * is a working tool; this is the sanity check at the bottom of the board — "is
 * anything still coming in, and does it look like what the numbers above claim?"
 * Anything more would compete with the insights it sits under.
 */
export function RecentFeedback({
  items,
  scale,
}: {
  items: FeedbackListItem[]
  scale: RatingFace[]
}) {
  if (items.length === 0) return <PanelEmpty message="No feedback in this period yet." />

  const colourFor = (rating: number) =>
    scale.find((face) => face.value === rating)?.colour ?? 'var(--color-line-strong)'

  return (
    <ul className="divide-line divide-y">
      {items.map((item) => (
        <li key={item.feedbackId}>
          <Link
            href={`/admin/feedback/${item.feedbackId}`}
            className="hover:bg-ground-sunk -mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition-colors"
          >
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold text-white tabular-nums"
              style={{
                background:
                  item.overallScore === null
                    ? 'var(--color-line-strong)'
                    : colourFor(Math.round(item.overallScore)),
              }}
            >
              {item.overallScore === null ? '—' : item.overallScore.toFixed(1)}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ink text-[15px] font-medium">
                  {item.guestName ?? 'Anonymous guest'}
                </span>
                <span className="text-ink-muted text-xs tabular-nums">
                  {item.localTime.slice(0, 5)}
                </span>
              </span>

              {/* The verbatim comment, never a summary of it (§14.10). */}
              {item.commentExcerpt ? (
                <span className="text-ink-soft mt-0.5 flex items-start gap-1.5 text-sm">
                  <MessageSquare
                    size={13}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="text-ink-muted mt-1 shrink-0"
                  />
                  <span className="line-clamp-1">{item.commentExcerpt}</span>
                </span>
              ) : item.issues.length > 0 ? (
                <span className="text-ink-muted mt-0.5 block truncate text-sm">
                  {item.issues.join(' · ')}
                </span>
              ) : null}
            </span>

            <StatusBadge status={item.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
