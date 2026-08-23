import { Suspense } from 'react'
import { FeedbackFilters } from '@/components/admin/FeedbackFilters'
import { FeedbackTable } from '@/components/admin/FeedbackTable'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { getCategories, getIssues, getRatingScale } from '@/lib/config'
import { getFeedbackList } from '@/lib/queries'
import type { FeedbackFilters as Filters } from '@/lib/queries/types'
import { parseRange } from '@/lib/range'

const PAGE_SIZE = 25

/**
 * Raw feedback (§29) — the bottom of the §14.6 priority order, and the thing
 * every insight and every chart on the other pages links into.
 *
 * All filters come from the URL, which is what makes those deep links work
 * without a second filter implementation.
 */
export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // No permission check beyond being signed in: §8 gives every role, STAFF
  // included, a read-only feedback list. RLS scopes the rows.
  await requireUser('/admin/feedback')

  const params = await searchParams
  const range = parseRange(params)

  const single = (key: string): string | undefined => {
    const value = params[key]
    return typeof value === 'string' && value !== '' ? value : undefined
  }

  const boolean = (key: string): boolean | undefined => {
    const value = single(key)
    return value === undefined ? undefined : value === 'true'
  }

  const band = single('ratingBand')

  const filters: Filters = {
    from: range.from,
    to: range.to,
    ratingBand: band === 'positive' || band === 'neutral' || band === 'negative' ? band : undefined,
    categoryId: single('categoryId'),
    issueId: single('issueId'),
    themeId: single('themeId'),
    status: single('status'),
    followUpRequested: boolean('followUp'),
    hasComment: boolean('hasComment'),
    guestType: single('guestType') as Filters['guestType'],
    search: single('q'),
  }

  const page = Number(single('page') ?? '1')

  const [result, categories, issues, scale] = await Promise.all([
    getFeedbackList(filters, { page: Number.isFinite(page) ? page : 1, pageSize: PAGE_SIZE }),
    getCategories(),
    getIssues('negative'),
    getRatingScale(),
  ])

  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value] as [string, string]] : [],
    ),
  ).toString()

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Feedback"
        note={`${range.from} to ${range.to} · every filter is in the URL, so this view is shareable.`}
        level="page"
      />

      <Suspense fallback={null}>
        <FeedbackFilters categories={categories} issues={issues} />
      </Suspense>

      <FeedbackTable page={result} scale={scale} searchParams={query} />
    </div>
  )
}
