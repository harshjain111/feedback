import { DeltaBadge } from './DeltaBadge'
import type { Polarity } from '@/lib/analytics/comparison'
import type { TodaySnapshot } from '@/lib/queries/types'

/**
 * The snapshot strip (§32, block 4).
 *
 * Deliberately below the insights: raw counts are the least actionable thing on
 * the page (§14.6 — Problems → Trends → Insights → Actions → Raw Data). Still
 * comparison-enriched, because a bare "12 feedbacks" says nothing about whether
 * that is a quiet day or a collapse in footfall.
 */
const CELLS: {
  key: keyof TodaySnapshot
  label: string
  polarity: Polarity
  format: 'number' | 'percent' | 'rating'
}[] = [
  { key: 'feedbackCount', label: 'Feedbacks', polarity: 'higher-is-better', format: 'number' },
  { key: 'avgExperience', label: 'Avg experience', polarity: 'higher-is-better', format: 'rating' },
  { key: 'positivePct', label: 'Positive', polarity: 'higher-is-better', format: 'percent' },
  { key: 'negativeCount', label: 'Negative', polarity: 'lower-is-better', format: 'number' },
  {
    key: 'followUpsRequired',
    label: 'Follow-ups required',
    polarity: 'lower-is-better',
    format: 'number',
  },
]

export function SnapshotStrip({ snapshot }: { snapshot: TodaySnapshot }) {
  return (
    <div className="border-line bg-surface grid grid-cols-2 divide-y divide-[color:var(--color-line)] rounded-xl border sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
      {CELLS.map((cell) => {
        const comparison = snapshot[cell.key]
        const value = comparison.value

        const display =
          value === null
            ? '—'
            : cell.format === 'percent'
              ? `${value}%`
              : cell.format === 'rating'
                ? value.toFixed(2)
                : String(value)

        return (
          <div key={cell.key} className="px-4 py-3">
            <p className="text-ink-muted text-[11px] font-medium tracking-wide uppercase">
              {cell.label}
            </p>
            <p className="font-display text-ink mt-1 text-2xl tabular-nums">{display}</p>
            <div className="mt-1">
              <DeltaBadge comparison={comparison} polarity={cell.polarity} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
