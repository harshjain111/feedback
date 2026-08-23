import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { FollowUpPanel } from '@/components/admin/FollowUpPanel'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { requireUser } from '@/lib/auth'
import { getRatingScale } from '@/lib/config'
import { can } from '@/lib/permissions'
import { getFeedbackDetail } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'

/**
 * One feedback in full (§28).
 *
 * The guest's own words are shown verbatim and given the most space on the
 * page — themes, chips and scores are all around it, not instead of it
 * (§14.10). The phone number arrives already masked from the query layer;
 * unmasking is a separate, audit-logged action (§11).
 */
export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/admin/feedback/${id}`)

  const [detail, scale] = await Promise.all([getFeedbackDetail(id), getRatingScale()])
  if (!detail) notFound()

  const colourFor = (rating: number) =>
    scale.find((face) => face.value === rating)?.colour ?? 'var(--color-line-strong)'

  // Only fetched when the panel can actually use it.
  let assignees: { userId: string; name: string }[] = []
  if (can(user, 'view:guests')) {
    const client = await createClient()
    const { data } = await client
      .from('app_users')
      .select('user_id, name')
      .eq('outlet_id', user.outletId)
      .eq('active', true)
      .order('name')
    assignees = (data ?? []).map((row) => ({ userId: row.user_id, name: row.name }))
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Link
        href="/admin/feedback"
        className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-xs"
      >
        <ArrowLeft size={13} strokeWidth={2} aria-hidden="true" />
        Back to feedback
      </Link>

      <header className="border-line bg-surface rounded-2xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-ink text-3xl">{detail.feedbackCode}</h1>
            <p className="text-ink-muted mt-1 text-sm">
              {detail.localDate} at {detail.localTime.slice(0, 5)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={detail.status} />
            {detail.followUpRequested ? (
              <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[11px] font-semibold">
                Follow-up requested
              </span>
            ) : null}
          </div>
        </div>

        <dl className="border-line mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted text-[11px] uppercase">Guest</dt>
            <dd className="text-ink mt-0.5 text-sm">
              {detail.guestId ? (
                <Link href={`/admin/guests/${detail.guestId}`} className="hover:text-accent">
                  {detail.guestName ?? detail.guestCode ?? 'Identified guest'}
                </Link>
              ) : (
                <span className="text-ink-muted">Anonymous</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted text-[11px] uppercase">Phone</dt>
            <dd className="text-ink mt-0.5 text-sm">
              {detail.guestPhoneMasked ?? <span className="text-ink-muted">Not given</span>}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted text-[11px] uppercase">Overall</dt>
            <dd className="text-ink mt-0.5 text-sm tabular-nums">
              {detail.overallScore === null ? '—' : detail.overallScore.toFixed(2)}
              {detail.sentiment ? (
                <span className="text-ink-muted"> · {detail.sentiment}</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </header>

      <section className="border-line bg-surface rounded-2xl border p-4">
        <h2 className="text-ink-muted mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
          Ratings
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {detail.ratings.map((rating) => (
            <li key={rating.categoryId} className="flex items-center gap-2.5">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: colourFor(rating.rating) }}
                aria-hidden="true"
              >
                {rating.rating}
              </span>
              <span className="text-ink text-sm">{rating.name}</span>
              <span className="sr-only">{rating.rating} out of 5</span>
            </li>
          ))}
        </ul>

        {detail.issues.length > 0 ? (
          <div className="border-line mt-4 border-t pt-4">
            <h3 className="text-ink-muted mb-2 text-[11px] uppercase">Areas raised</h3>
            <div className="flex flex-wrap gap-1.5">
              {detail.issues.map((issue) => (
                <span
                  key={issue}
                  className="bg-ground-sunk text-ink-soft rounded-full px-2.5 py-1 text-xs"
                >
                  {issue}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* The guest's own words, in full and unedited. */}
      <section className="border-line bg-surface rounded-2xl border p-4">
        <h2 className="text-ink-muted mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
          What the guest wrote
        </h2>
        {detail.comment ? (
          <blockquote className="border-accent text-ink border-l-2 pl-4 text-base leading-relaxed whitespace-pre-wrap">
            {detail.comment}
          </blockquote>
        ) : (
          <p className="text-ink-muted text-sm">No comment was left.</p>
        )}
      </section>

      {detail.followUp ? (
        <FollowUpPanel
          followUp={detail.followUp}
          assignees={assignees}
          canAssign={can(user, 'view:guests')}
        />
      ) : (
        <section className="border-line rounded-2xl border border-dashed p-4">
          <p className="text-ink-muted text-sm">
            No follow-up was opened for this feedback — the guest did not ask to be contacted.
          </p>
        </section>
      )}
    </div>
  )
}
