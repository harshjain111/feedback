'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'

/**
 * The §32 guest segments.
 *
 * Each label carries its definition in the title attribute, because "High
 * engagement" means nothing on its own and a manager filtering by it deserves
 * to know what they are asking for.
 */
const FILTERS: { key: string; label: string; definition: string }[] = [
  { key: 'all', label: 'All', definition: 'Every guest who has left a phone number.' },
  { key: 'new', label: 'New', definition: 'Exactly one visit so far.' },
  { key: 'repeat', label: 'Repeat', definition: 'More than one visit.' },
  { key: 'negative', label: 'Negative', definition: 'Average experience of 2.5 or below.' },
  {
    key: 'follow_up',
    label: 'Follow-up required',
    definition: 'Has a follow-up that is not yet closed.',
  },
  { key: 'high_engagement', label: 'High engagement', definition: 'Three visits or more.' },
]

export function GuestFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const current = searchParams.get('filter') ?? 'all'

  const apply = (key: string, search?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'all') params.delete('filter')
    else params.set('filter', key)
    if (search !== undefined) {
      if (search === '') params.delete('q')
      else params.set('q', search)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            title={filter.definition}
            onClick={() => apply(filter.key)}
            aria-pressed={current === filter.key}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              current === filter.key
                ? 'bg-accent text-accent-ink'
                : 'text-ink-soft hover:bg-ground-sunk',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        defaultValue={searchParams.get('q') ?? ''}
        // Name and guest code only. Searching by phone would have to run
        // against the raw column, which would leak whether a number exists.
        placeholder="Search name or guest code"
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply(current, event.currentTarget.value.trim())
        }}
        className="border-line-strong focus:border-accent ml-auto rounded-lg border px-2.5 py-1.5 text-sm outline-none"
      />
    </div>
  )
}
