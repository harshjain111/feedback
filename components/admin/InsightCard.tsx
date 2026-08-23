import Link from 'next/link'
import { ArrowRight, AlertOctagon, AlertTriangle, Info, Sparkles } from 'lucide-react'
import { DeltaBadge } from './DeltaBadge'
import { insightHref, type Insight, type Severity } from '@/lib/analytics/insights'
import type { Polarity } from '@/lib/analytics/comparison'
import { cn } from '@/lib/cn'

/**
 * One auto-generated insight (§9, §21).
 *
 * Every card answers the same five questions in the same order, and the last
 * one is a link, not a sentence: WHAT NEXT is only useful if it puts the
 * manager in front of the actual feedback. The deep link carries a pre-filtered
 * query so the list opens on exactly the evidence behind the claim.
 */

const TONE: Record<Severity, { border: string; chip: string; icon: typeof Info }> = {
  critical: {
    border: 'border-[color:var(--color-bad)]/45',
    chip: 'bg-[color:var(--color-bad)]/10 text-[color:var(--color-bad)]',
    icon: AlertOctagon,
  },
  warning: {
    border: 'border-[color:var(--color-warn)]/45',
    chip: 'bg-[color:var(--color-warn)]/12 text-[color:var(--color-warn)]',
    icon: AlertTriangle,
  },
  info: {
    border: 'border-line',
    chip: 'bg-ground-sunk text-ink-soft',
    icon: Info,
  },
  positive: {
    border: 'border-[color:var(--color-good)]/40',
    chip: 'bg-[color:var(--color-good)]/10 text-[color:var(--color-good)]',
    icon: Sparkles,
  },
}

/** A strong category rising is good news; everything else on this board is not. */
function polarityFor(insight: Insight): Polarity {
  return insight.type === 'CATEGORY_STRONG' ? 'higher-is-better' : 'lower-is-better'
}

export function InsightCard({ insight, className }: { insight: Insight; className?: string }) {
  const tone = TONE[insight.severity]
  const Icon = tone.icon

  return (
    <article className={cn('bg-surface rounded-xl border p-4', tone.border, className)}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 rounded-lg p-1.5', tone.chip)}>
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          {/* What happened */}
          <h3 className="text-ink text-sm leading-snug font-semibold">{insight.title}</h3>

          {/* How significant, and which way it is moving */}
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-ink text-xl tabular-nums">
              {insight.metric.value ?? '—'}
            </span>
            <DeltaBadge comparison={insight.metric} polarity={polarityFor(insight)} />
          </div>

          {/* Why */}
          <p className="text-ink-soft mt-2 text-xs">{insight.evidence}</p>

          {/* What next */}
          <Link
            href={insightHref(insight.filter)}
            className="text-accent hover:text-accent-hover mt-3 inline-flex items-center gap-1 text-xs font-semibold"
          >
            VIEW FEEDBACK
            <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}

/**
 * What the board shows when nothing needs attention.
 *
 * Deliberately not an empty div: "nothing is wrong right now" is a real answer
 * to "what needs attention?", and a blank space reads as a broken page.
 */
export function InsightsEmpty({ message }: { message: string }) {
  return (
    <div className="border-line bg-surface rounded-xl border border-dashed p-6 text-center">
      <p className="text-ink-soft text-sm">{message}</p>
    </div>
  )
}
