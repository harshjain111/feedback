import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GuestFilters } from '@/components/admin/GuestFilters'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getGuestList } from '@/lib/queries'
import type { GuestFilterKey } from '@/lib/queries/types'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 30

const FILTERS: GuestFilterKey[] = [
  'all',
  'new',
  'repeat',
  'negative',
  'follow_up',
  'high_engagement',
]

/**
 * The guest database (§29, §32).
 *
 * Phone is masked here for every role, without exception — the list is a
 * browsing surface, and §11 reserves the real number for the profile and the
 * follow-up, where revealing it is a deliberate, audit-logged act.
 */
export default async function AdminGuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser('/admin/guests')
  if (!can(user, 'view:guests')) redirect('/admin/feedback')

  const params = await searchParams
  const single = (key: string) => (typeof params[key] === 'string' ? params[key] : undefined)

  const rawFilter = single('filter') ?? 'all'
  const filter = (FILTERS as string[]).includes(rawFilter) ? (rawFilter as GuestFilterKey) : 'all'
  const page = Number(single('page') ?? '1')
  const search = single('q')

  const result = await getGuestList(
    filter,
    { page: Number.isFinite(page) ? page : 1, pageSize: PAGE_SIZE },
    search,
  )

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Guests"
        note={`${result.total} guest${result.total === 1 ? '' : 's'} · phone numbers are masked everywhere on this page.`}
      />

      <GuestFilters />

      {result.items.length === 0 ? (
        <div className="border-line text-ink-muted rounded-xl border border-dashed p-8 text-center text-sm">
          No guests match this filter. Guests are created when someone leaves a phone number.
        </div>
      ) : (
        <div className="border-line bg-surface overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-line text-ink-muted border-b text-left text-xs uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Guest
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Phone
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Visits
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Average
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Last seen
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {result.items.map((guest) => (
                <tr key={guest.guestId} className="hover:bg-ground-sunk/60">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/guests/${guest.guestId}`}
                      className="text-ink hover:text-accent font-medium"
                    >
                      {guest.name ?? guest.guestCode}
                    </Link>
                    <span className="text-ink-muted block text-xs">{guest.guestCode}</span>
                  </td>
                  <td className="text-ink-soft px-4 py-2.5">{guest.phoneMasked ?? '—'}</td>
                  <td className="text-ink px-4 py-2.5 text-right tabular-nums">
                    {guest.totalFeedbacks}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span
                      className={cn(
                        guest.isNegative ? 'text-[color:var(--color-bad)]' : 'text-ink',
                      )}
                    >
                      {guest.averageRating === null ? '—' : guest.averageRating.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-ink-soft px-4 py-2.5">{guest.lastFeedbackDate ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {guest.hasOpenFollowUp ? <Tag tone="bad">Follow-up open</Tag> : null}
                      {guest.isRepeat ? (
                        <Tag tone="neutral">Repeat</Tag>
                      ) : (
                        <Tag tone="neutral">New</Tag>
                      )}
                      {guest.isHighEngagement ? <Tag tone="good">Engaged</Tag> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Tag({ children, tone }: { children: React.ReactNode; tone: 'good' | 'bad' | 'neutral' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'bad' && 'bg-[color:var(--color-bad)]/10 text-[color:var(--color-bad)]',
        tone === 'good' && 'bg-[color:var(--color-good)]/10 text-[color:var(--color-good)]',
        tone === 'neutral' && 'bg-ground-sunk text-ink-soft',
      )}
    >
      {children}
    </span>
  )
}
