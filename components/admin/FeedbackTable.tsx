import Link from 'next/link'
import { MessageSquare, PhoneCall } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { FeedbackListItem, Paged } from '@/lib/queries/types'
import type { RatingFace } from '@/lib/config.types'
import { cn } from '@/lib/cn'

/**
 * The feedback list (§29).
 *
 * Per-category ratings are coloured dots so a row can be scanned without
 * reading five numbers — but each dot carries the value in its title and its
 * accessible label, because colour alone is not information.
 *
 * The phone column shows what the query layer returned, which is already masked
 * (§11). There is no unmasked value in this component to leak.
 */
export function FeedbackTable({
  page,
  scale,
  searchParams,
}: {
  page: Paged<FeedbackListItem>
  scale: RatingFace[]
  searchParams: string
}) {
  const colourFor = (rating: number) =>
    scale.find((face) => face.value === rating)?.colour ?? 'var(--color-line-strong)'

  if (page.items.length === 0) {
    return (
      <div className="border-line text-ink-muted rounded-xl border border-dashed p-8 text-center text-sm">
        No feedback matches these filters.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="border-line bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-line text-ink-muted border-b text-left text-xs uppercase">
              <th scope="col" className="px-3 py-2.5 font-medium">
                Code
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                When
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Guest
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Overall
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Categories
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Issues
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Comment
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {page.items.map((item) => (
              <tr key={item.feedbackId} className="hover:bg-ground-sunk/60 align-top">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Link
                    href={`/admin/feedback/${item.feedbackId}`}
                    className="text-accent font-medium hover:underline"
                  >
                    {item.feedbackCode}
                  </Link>
                </td>
                <td className="text-ink-soft px-3 py-2.5 whitespace-nowrap">
                  {item.localDate}
                  <span className="text-ink-muted"> {item.localTime.slice(0, 5)}</span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {item.guestName || item.guestPhoneMasked ? (
                    <span className="text-ink">
                      {item.guestName ?? '—'}
                      {item.guestPhoneMasked ? (
                        <span className="text-ink-muted block text-xs">
                          {item.guestPhoneMasked}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Anonymous</span>
                  )}
                </td>
                <td className="text-ink px-3 py-2.5 text-right tabular-nums">
                  {item.overallScore === null ? '—' : item.overallScore.toFixed(2)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    {item.ratings.map((rating) => (
                      <span
                        key={rating.categoryId}
                        title={`${rating.name}: ${rating.rating} of 5`}
                        aria-label={`${rating.name}: ${rating.rating} of 5`}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: colourFor(rating.rating) }}
                      >
                        {rating.rating}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {item.issues.length === 0 ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {item.issues.map((issue) => (
                        <span
                          key={issue}
                          className="bg-ground-sunk text-ink-soft rounded-full px-2 py-0.5 text-[11px]"
                        >
                          {issue}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="text-ink-soft max-w-[280px] px-3 py-2.5">
                  {item.commentExcerpt ? (
                    <span className="flex items-start gap-1.5">
                      <MessageSquare
                        size={13}
                        strokeWidth={1.8}
                        aria-hidden="true"
                        className="text-ink-muted mt-0.5 shrink-0"
                      />
                      <span className="line-clamp-2">{item.commentExcerpt}</span>
                    </span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={item.status} />
                    {item.followUpRequested ? (
                      <PhoneCall
                        size={13}
                        strokeWidth={2}
                        aria-label="Follow-up requested"
                        className="text-accent"
                      />
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} searchParams={searchParams} />
    </div>
  )
}

function Pagination({
  page,
  searchParams,
}: {
  page: Paged<FeedbackListItem>
  searchParams: string
}) {
  if (page.pageCount <= 1) {
    return (
      <p className="text-ink-muted text-xs">
        {page.total} feedback{page.total === 1 ? '' : 's'}
      </p>
    )
  }

  const href = (target: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(target))
    return `/admin/feedback?${params.toString()}`
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-ink-muted text-xs">
        {page.total} feedbacks · page {page.page} of {page.pageCount}
      </p>
      <div className="flex gap-2">
        <PageLink href={href(page.page - 1)} disabled={page.page <= 1} label="Previous" />
        <PageLink href={href(page.page + 1)} disabled={page.page >= page.pageCount} label="Next" />
      </div>
    </div>
  )
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  const className = cn(
    'rounded-lg border px-3 py-1.5 text-xs font-medium',
    disabled
      ? 'border-line text-ink-muted pointer-events-none'
      : 'border-line-strong text-ink-soft hover:bg-ground-sunk',
  )
  return disabled ? (
    <span className={className}>{label}</span>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  )
}
