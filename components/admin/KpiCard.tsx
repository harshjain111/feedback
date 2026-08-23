import { AlertTriangle } from 'lucide-react'
import { DeltaBadge } from './DeltaBadge'
import type { Comparison, Polarity } from '@/lib/analytics/comparison'
import { cn } from '@/lib/cn'

/**
 * One headline number, and never only a number (§9, §20).
 *
 * `Service 4.1` is a failure. `Service 4.1 ↓ 11% vs previous 7 days` is the
 * product. The card takes a Comparison rather than a value precisely so the
 * failing version is not expressible.
 */
export function KpiCard({
  label,
  comparison,
  polarity = 'higher-is-better',
  format = 'number',
  attentionBelow,
  footnote,
  className,
}: {
  label: string
  comparison: Comparison
  polarity?: Polarity
  format?: 'number' | 'percent' | 'rating'
  /** Configurable threshold (§24). Below it, the card flags itself. */
  attentionBelow?: number
  footnote?: string
  className?: string
}) {
  const { value } = comparison

  const display =
    value === null
      ? '—'
      : format === 'percent'
        ? `${value}%`
        : format === 'rating'
          ? value.toFixed(2)
          : String(value)

  const needsAttention = attentionBelow !== undefined && value !== null && value < attentionBelow

  return (
    <div
      className={cn(
        'bg-surface rounded-xl border p-4',
        needsAttention ? 'border-[color:var(--color-bad)]/40' : 'border-line',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">{label}</p>
        {needsAttention ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-bad)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-bad)]"
            title={`Below the configured threshold of ${attentionBelow}`}
          >
            <AlertTriangle size={11} strokeWidth={2.4} aria-hidden="true" />
            Needs attention
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          'font-display text-ink mt-2 text-3xl tabular-nums',
          value === null && 'text-ink-muted',
        )}
      >
        {display}
      </p>

      <div className="mt-1.5">
        <DeltaBadge comparison={comparison} polarity={polarity} />
      </div>

      {/* No feedback at all is a fact worth stating, not an empty card. */}
      {value === null ? (
        <p className="text-ink-muted mt-2 text-xs">No feedback in this period.</p>
      ) : null}

      {footnote ? <p className="text-ink-muted mt-2 text-xs">{footnote}</p> : null}
    </div>
  )
}
