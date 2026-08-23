import { MessageSquare, PhoneCall, Star, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react'
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
  icon: LucideIcon
  tint: string
}[] = [
  {
    key: 'feedbackCount',
    label: 'Feedbacks',
    polarity: 'higher-is-better',
    format: 'number',
    icon: MessageSquare,
    tint: 'var(--color-accent)',
  },
  {
    key: 'avgExperience',
    label: 'Avg experience',
    polarity: 'higher-is-better',
    format: 'rating',
    icon: Star,
    tint: 'var(--color-warn)',
  },
  {
    key: 'positivePct',
    label: 'Positive',
    polarity: 'higher-is-better',
    format: 'percent',
    icon: ThumbsUp,
    tint: 'var(--color-good)',
  },
  {
    key: 'negativeCount',
    label: 'Negative',
    polarity: 'lower-is-better',
    format: 'number',
    icon: ThumbsDown,
    tint: 'var(--color-bad)',
  },
  {
    key: 'followUpsRequired',
    label: 'Follow-ups required',
    polarity: 'lower-is-better',
    format: 'number',
    icon: PhoneCall,
    tint: 'var(--color-terracotta)',
  },
]

export function SnapshotStrip({ snapshot }: { snapshot: TodaySnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <div key={cell.key} className="border-line bg-surface rounded-2xl border p-4">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: `color-mix(in srgb, ${cell.tint} 12%, transparent)` }}
            >
              <cell.icon
                size={17}
                strokeWidth={2}
                aria-hidden="true"
                style={{ color: cell.tint }}
              />
            </span>
            <p className="text-ink-soft mt-3 text-[13px] font-medium">{cell.label}</p>
            <p className="font-display text-ink mt-1 text-3xl tabular-nums">{display}</p>
            <div className="mt-1.5">
              <DeltaBadge comparison={comparison} polarity={cell.polarity} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
