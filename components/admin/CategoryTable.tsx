import Link from 'next/link'
import { DeltaBadge } from './DeltaBadge'
import { insightHref } from '@/lib/analytics/insights'
import type { CategoryPerformance, CategoryStatus } from '@/lib/queries/types'
import type { DateRange } from '@/lib/range'
import { cn } from '@/lib/cn'

/**
 * Category performance (§24): score, trend, status.
 *
 * The status dot is a colour AND a word. Colour alone fails for anyone who
 * cannot distinguish the two, and this is the row a manager acts on.
 */

const STATUS: Record<CategoryStatus, { label: string; dot: string; text: string }> = {
  strong: {
    label: 'Strong',
    dot: 'bg-[color:var(--color-good)]',
    text: 'text-[color:var(--color-good)]',
  },
  watch: {
    label: 'Watch',
    dot: 'bg-[color:var(--color-warn)]',
    text: 'text-[color:var(--color-warn)]',
  },
  attention: {
    label: 'Needs attention',
    dot: 'bg-[color:var(--color-bad)]',
    text: 'text-[color:var(--color-bad)]',
  },
}

export function CategoryTable({
  categories,
  range,
}: {
  categories: CategoryPerformance[]
  range: DateRange
}) {
  return (
    <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-line text-ink-muted border-b text-left text-xs uppercase">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Category
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Score
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Trend
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Ratings
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Negative
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {categories.map((category) => {
            const status = STATUS[category.status]
            const href = insightHref({
              from: range.from,
              to: range.to,
              categoryId: category.categoryId,
            })

            return (
              <tr key={category.categoryId} className="hover:bg-ground-sunk/60">
                <td className="px-4 py-2.5">
                  <Link href={href} className="text-ink hover:text-accent font-medium">
                    {category.name}
                  </Link>
                </td>
                <td className="text-ink px-4 py-2.5 text-right tabular-nums">
                  {category.score.value === null ? '—' : category.score.value.toFixed(2)}
                </td>
                <td className="px-4 py-2.5">
                  <DeltaBadge comparison={category.score} polarity="higher-is-better" />
                </td>
                <td className="text-ink-soft px-4 py-2.5 text-right tabular-nums">
                  {category.ratingCount}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {category.negativeCount > 0 ? (
                    <Link
                      href={insightHref({
                        from: range.from,
                        to: range.to,
                        categoryId: category.categoryId,
                        ratingBand: 'negative',
                      })}
                      className="text-[color:var(--color-bad)] hover:underline"
                    >
                      {category.negativeCount}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">0</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn('inline-flex items-center gap-1.5 text-xs', status.text)}>
                    <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden="true" />
                    {status.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
