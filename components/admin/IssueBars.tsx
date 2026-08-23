import Link from 'next/link'
import { DeltaBadge } from './DeltaBadge'
import { PanelEmpty } from './Panel'
import { insightHref } from '@/lib/analytics/insights'
import type { IssueCount } from '@/lib/queries/types'
import type { DateRange } from '@/lib/range'

/**
 * Ranked issues (or wins) as proportional bars.
 *
 * A bare count list makes the reader do the division: "Waiting Time 14" means
 * nothing until you know whether the next one is 13 or 2. The bar answers that
 * before the number is read, which is the whole point of putting it above the
 * raw feedback list (§14.6).
 *
 * Bars are scaled against the top row, not against total feedbacks — the
 * question this block answers is "what is worst", not "what share of guests".
 */
export function IssueBars({
  issues,
  range,
  kind,
  emptyMessage,
  limit = 5,
}: {
  issues: IssueCount[]
  range: DateRange
  kind: 'negative' | 'positive'
  emptyMessage: string
  limit?: number
}) {
  const rows = issues.filter((issue) => (issue.mentions.value ?? 0) > 0).slice(0, limit)

  if (rows.length === 0) return <PanelEmpty message={emptyMessage} />

  const top = Math.max(...rows.map((issue) => issue.mentions.value ?? 0))
  const tint = kind === 'negative' ? 'var(--color-terracotta)' : 'var(--color-accent)'

  return (
    <ul className="space-y-3.5">
      {rows.map((issue) => {
        const count = issue.mentions.value ?? 0

        return (
          <li key={issue.issueId}>
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={insightHref({
                  from: range.from,
                  to: range.to,
                  issueId: issue.issueId,
                  ratingBand: kind,
                })}
                className="text-ink hover:text-accent truncate text-[15px] font-medium"
              >
                {issue.name}
              </Link>
              <span className="text-ink shrink-0 text-[15px] font-semibold tabular-nums">
                {count}
              </span>
            </div>

            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full"
              style={{ background: 'var(--color-ground-sunk)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round((count / top) * 100)}%`, background: tint }}
              />
            </div>

            <div className="mt-1">
              <DeltaBadge
                comparison={issue.mentions}
                polarity={kind === 'negative' ? 'lower-is-better' : 'higher-is-better'}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
