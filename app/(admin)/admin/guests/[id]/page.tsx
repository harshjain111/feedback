import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ExperienceJourney } from '@/components/admin/ExperienceJourney'
import { RevealPhone } from '@/components/admin/RevealPhone'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getGuestProfile } from '@/lib/queries'

/**
 * The guest profile (§30, §31).
 *
 * The full visit history is here because a guest is a relationship, not a row:
 * what matters is whether their last three visits were better or worse than the
 * three before, not what they scored once.
 */
export default async function AdminGuestProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/admin/guests/${id}`)
  if (!can(user, 'view:guests')) redirect('/admin/feedback')

  const guest = await getGuestProfile(id)
  if (!guest) notFound()

  // History comes back newest-first; the journey needs chronological order.
  const chronological = [...guest.history].reverse()

  return (
    <div className="max-w-4xl space-y-5">
      <Link
        href="/admin/guests"
        className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-xs"
      >
        <ArrowLeft size={13} strokeWidth={2} aria-hidden="true" />
        Back to guests
      </Link>

      <header className="border-line bg-surface rounded-xl border p-4">
        <h1 className="font-display text-ink text-2xl">{guest.name ?? guest.guestCode}</h1>
        <p className="text-ink-muted mt-1 text-sm">{guest.guestCode}</p>

        <dl className="border-line mt-4 grid gap-4 border-t pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted text-[11px] uppercase">Phone</dt>
            <dd className="mt-0.5 text-sm">
              {can(user, 'view:guest_phone') ? (
                <RevealPhone guestId={guest.guestId} masked={guest.phoneMasked} />
              ) : (
                <span className="text-ink">{guest.phoneMasked ?? 'Not given'}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted text-[11px] uppercase">Visits</dt>
            <dd className="text-ink mt-0.5 text-sm tabular-nums">{guest.totalFeedbacks}</dd>
          </div>
          <div>
            <dt className="text-ink-muted text-[11px] uppercase">Average experience</dt>
            <dd className="text-ink mt-0.5 text-sm tabular-nums">
              {guest.averageRating === null ? '—' : guest.averageRating.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted text-[11px] uppercase">First seen</dt>
            <dd className="text-ink mt-0.5 text-sm">{guest.firstFeedbackDate ?? '—'}</dd>
          </div>
        </dl>
      </header>

      <ExperienceJourney scoresOldestFirst={chronological.map((visit) => visit.overallScore)} />

      <section className="border-line bg-surface rounded-xl border p-4">
        <h2 className="text-ink-muted mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
          By category
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {guest.categoryAverages.map((category) => (
            <li key={category.categoryId} className="flex items-center justify-between">
              <span className="text-ink text-sm">{category.name}</span>
              <span className="text-ink-soft text-sm tabular-nums">
                {category.average === null ? '—' : category.average.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading title="Visit history" />
        <div className="border-line bg-surface overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-line text-ink-muted border-b text-left text-xs uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Code
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Overall
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Ratings
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Comment
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {guest.history.map((visit) => (
                <tr key={visit.feedbackId} className="hover:bg-ground-sunk/60 align-top">
                  <td className="text-ink-soft px-4 py-2.5 whitespace-nowrap">{visit.localDate}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/admin/feedback/${visit.feedbackId}`}
                      className="text-accent hover:underline"
                    >
                      {visit.feedbackCode}
                    </Link>
                  </td>
                  <td className="text-ink px-4 py-2.5 text-right tabular-nums">
                    {visit.overallScore === null ? '—' : visit.overallScore.toFixed(2)}
                  </td>
                  <td className="text-ink-soft px-4 py-2.5 text-xs">
                    {visit.ratings.map((r) => `${r.name} ${r.rating}`).join(' · ')}
                  </td>
                  {/* The guest's own words, never an interpretation of them. */}
                  <td className="text-ink-soft max-w-[280px] px-4 py-2.5">
                    {visit.comment ? (
                      <span className="line-clamp-2">{visit.comment}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
