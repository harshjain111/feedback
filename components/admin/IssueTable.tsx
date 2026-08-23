import Link from 'next/link'
import { DeltaBadge } from './DeltaBadge'
import { insightHref } from '@/lib/analytics/insights'
import type { IssueCount } from '@/lib/queries/types'
import type { DateRange } from '@/lib/range'

/**
 * Ranked issue mentions with period-over-period change (§25).
 *
 * Every row is a link. A ranked list a manager cannot click through to the
 * actual comments is trivia — the point is to get from "Waiting Time ↑ 28%" to
 * the guests who said it in one action.
 */
export function IssueTable({
  issues,
  range,
  kind,
}: {
  issues: IssueCount[]
  range: DateRange
  kind: 'negative' | 'positive'
}) {
  const withMentions = issues.filter((issue) => (issue.mentions.value ?? 0) > 0)

  if (withMentions.length === 0) {
    return (
      <div className="border-line text-ink-muted rounded-2xl border border-dashed p-5 text-sm">
        {kind === 'negative'
          ? 'No issues were raised in this period.'
          : 'No highlights were picked in this period.'}
      </div>
    )
  }

  return (
    <ul className="border-line bg-surface divide-line divide-y rounded-2xl border">
      {withMentions.map((issue) => (
        <li key={issue.issueId}>
          <Link
            href={insightHref({
              from: range.from,
              to: range.to,
              issueId: issue.issueId,
            })}
            className="hover:bg-ground-sunk/60 flex items-center justify-between gap-4 px-4 py-2.5"
          >
            <span className="text-ink text-sm font-medium">{issue.name}</span>
            <span className="flex items-center gap-3">
              <DeltaBadge
                comparison={issue.mentions}
                polarity={kind === 'negative' ? 'lower-is-better' : 'higher-is-better'}
              />
              <span className="text-ink text-sm tabular-nums">{issue.mentions.value ?? 0}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
