import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { redirect } from 'next/navigation'
import { GuestFilters } from '@/components/admin/GuestFilters'
import { ExportButton } from '@/components/admin/ExportButton'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getGuestList } from '@/lib/queries'
import type { GuestFilterKey } from '@/lib/queries/types'
import { cn } from '@/lib/cn'
import { parseRange } from '@/lib/range'

/** One grid template for the header and every row, so they stay aligned. */
const COLUMNS =
  'grid-cols-[minmax(170px,1.5fr)_140px_70px_90px_120px_minmax(150px,1fr)_24px] gap-x-3'

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
 * Phone numbers are shown in full to OWNER/ADMIN/MANAGER (0021). They were
 * masked here for every role, which made the guest directory a list of people
 * you could not contact. STAFF still get only the masked form — §8 gives them
 * no guest phone numbers, and that is a boundary, not a display preference.
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

  const range = parseRange(params)

  const result = await getGuestList(
    filter,
    { page: Number.isFinite(page) ? page : 1, pageSize: PAGE_SIZE },
    search,
    range,
  )

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Guests"
        note={`${result.total} guest${result.total === 1 ? '' : 's'} who visited between ${range.from} and ${range.to}`}
        level="page"
        action={can(user, 'export:data') ? <ExportButton range={range} /> : null}
      />

      <GuestFilters />

      {result.items.length === 0 ? (
        <div className="border-line text-ink-muted rounded-2xl border border-dashed p-8 text-center text-sm">
          {`No guests visited between ${range.from} and ${range.to}. Widen the date range, or check the filter above — guests are only created when someone leaves a phone number.`}
        </div>
      ) : (
        <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
          {/*
            A list of links rather than a table.

            The name alone used to be the link, so clicking the phone, the visit
            count or anywhere else in the row did nothing — and the row is what
            people aim at. Same reasoning, and the same interaction, as the
            feedback list. The grid keeps the columns lined up; `COLUMNS` is
            shared with the header so they cannot drift apart.
          */}
          <div className="min-w-[860px]">
            <div
              className={cn(
                'border-line text-ink-muted grid border-b px-4 py-2.5 text-xs uppercase',
                COLUMNS,
              )}
            >
              <span>Guest</span>
              <span>Phone</span>
              <span className="text-right">Visits</span>
              <span className="text-right">Average</span>
              <span>Last seen</span>
              <span>Status</span>
              <span className="sr-only">Open</span>
            </div>

            <ul className="divide-line divide-y">
              {result.items.map((guest) => (
                <li key={guest.guestId}>
                  <Link
                    href={`/admin/guests/${guest.guestId}`}
                    className={cn(
                      'hover:bg-ground-sunk/60 focus-visible:bg-ground-sunk/60 group grid items-center px-4 py-2.5 text-sm outline-none',
                      COLUMNS,
                    )}
                  >
                    <span className="min-w-0 pr-3">
                      <span className="text-ink group-hover:text-accent block truncate font-medium">
                        {guest.name ?? guest.guestCode}
                      </span>
                      <span className="text-ink-muted block text-xs">{guest.guestCode}</span>
                    </span>

                    <span className="text-ink-soft tabular-nums">
                      {guest.phone ?? guest.phoneMasked ?? '—'}
                    </span>

                    <span className="text-ink text-right tabular-nums">
                      {guest.totalFeedbacks}
                    </span>

                    <span
                      className={cn(
                        'text-right tabular-nums',
                        guest.isNegative ? 'text-[color:var(--color-bad)]' : 'text-ink',
                      )}
                    >
                      {guest.averageRating === null ? '—' : guest.averageRating.toFixed(2)}
                    </span>

                    <span className="text-ink-soft tabular-nums">
                      {guest.lastFeedbackDate ?? '—'}
                    </span>

                    <span className="flex flex-wrap gap-1">
                      {guest.hasOpenFollowUp ? <Tag tone="bad">Follow-up open</Tag> : null}
                      {guest.isRepeat ? (
                        <Tag tone="neutral">Repeat</Tag>
                      ) : (
                        <Tag tone="neutral">New</Tag>
                      )}
                      {guest.isHighEngagement ? <Tag tone="good">Engaged</Tag> : null}
                    </span>

                    <ChevronRight
                      size={16}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="text-ink-muted group-hover:text-ink-soft justify-self-end transition-colors"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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
