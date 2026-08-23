import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import type { Comparison, Polarity } from '@/lib/analytics/comparison'
import { isImprovement } from '@/lib/analytics/comparison'
import { cn } from '@/lib/cn'

/**
 * The delta half of every metric — §9's "never render a bare number".
 *
 * Colour tracks whether the movement is GOOD, not which way it points. A rising
 * complaint rate and a rising satisfaction score both point up and mean
 * opposite things, so polarity is a required prop rather than a default.
 */
export function DeltaBadge({
  comparison,
  polarity,
  className,
}: {
  comparison: Comparison
  polarity: Polarity
  className?: string
}) {
  const { delta, deltaPct, direction, label } = comparison

  if (delta === null) {
    return (
      <span className={cn('text-ink-muted text-xs', className)}>
        no comparison — {comparison.previous === null ? 'no earlier data' : label}
      </span>
    )
  }

  const good = isImprovement(comparison, polarity)
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : ArrowRight

  const tone =
    good === null
      ? 'text-ink-muted'
      : good
        ? 'text-[color:var(--color-good)]'
        : 'text-[color:var(--color-bad)]'

  // With a zero baseline a percentage would be a lie, so the raw delta is shown.
  const magnitude =
    deltaPct === null ? `${delta > 0 ? '+' : ''}${delta}` : `${deltaPct > 0 ? '+' : ''}${deltaPct}%`

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', tone, className)}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      <span>{magnitude}</span>
      <span className="text-ink-muted font-normal">{label}</span>
    </span>
  )
}
