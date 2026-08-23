'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { parseRange, PRESET_LABELS, RANGE_PRESETS, type RangePreset } from '@/lib/range'
import { cn } from '@/lib/cn'

/**
 * Today | Yesterday | 7 Days | 30 Days | Custom.
 *
 * The range lives in the URL, not in component state: a manager who finds
 * something worth showing someone can send the link and it opens on the same
 * window. It also means the insight-card deep links (§21) can land pre-filtered.
 */
export function DateRangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Derived from the URL rather than passed in, so this can live in the layout
  // header — layouts do not receive searchParams in the App Router.
  const range = parseRange(Object.fromEntries(searchParams.entries()))

  const apply = (next: Partial<{ range: RangePreset; from: string; to: string }>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
    }
    if (next.range && next.range !== 'custom') {
      params.delete('from')
      params.delete('to')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="border-line bg-surface inline-flex rounded-full border p-1">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => apply({ range: preset })}
            aria-pressed={range.preset === preset}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              range.preset === preset
                ? 'bg-accent text-accent-ink'
                : 'text-ink-soft hover:bg-ground-sunk',
            )}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      {range.preset === 'custom' ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(event) => apply({ range: 'custom', from: event.target.value })}
            aria-label="From date"
            className="border-line-strong bg-surface rounded-full border px-3.5 py-2 text-sm"
          />
          <span className="text-ink-muted text-sm">to</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(event) => apply({ range: 'custom', to: event.target.value })}
            aria-label="To date"
            className="border-line-strong bg-surface rounded-full border px-3.5 py-2 text-sm"
          />
        </div>
      ) : null}
    </div>
  )
}
