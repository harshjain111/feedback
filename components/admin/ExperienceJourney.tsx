import { TrendingDown, TrendingUp, Minus, HelpCircle } from 'lucide-react'
import { analyseJourney, VERDICT_LABEL } from '@/lib/analytics/guest-journey'
import { cn } from '@/lib/cn'

/**
 * The Experience Journey (§31).
 *
 * A compact sparkline of this guest's overall scores in order, plus a verdict.
 * The verdict is the point: a repeat guest whose experience is sliding is
 * someone who kept coming back and is losing patience, and that is the most
 * valuable warning this system produces.
 *
 * When there are not enough visits it says so rather than guessing. Two points
 * is a line, not a trend.
 */
export function ExperienceJourney({ scoresOldestFirst }: { scoresOldestFirst: (number | null)[] }) {
  const { verdict, slope, points, visitsConsidered } = analyseJourney(scoresOldestFirst)

  const TONE = {
    improving: {
      icon: TrendingUp,
      chip: 'bg-[color:var(--color-good)]/10 text-[color:var(--color-good)]',
      stroke: 'var(--color-good)',
    },
    declining: {
      icon: TrendingDown,
      chip: 'bg-[color:var(--color-bad)]/10 text-[color:var(--color-bad)]',
      stroke: 'var(--color-bad)',
    },
    stable: {
      icon: Minus,
      chip: 'bg-ground-sunk text-ink-soft',
      stroke: 'var(--color-ink-muted)',
    },
    insufficient: {
      icon: HelpCircle,
      chip: 'bg-ground-sunk text-ink-muted',
      stroke: 'var(--color-line-strong)',
    },
  }[verdict]

  const Icon = TONE.icon

  // Sparkline over the rating scale, not the data's own range: auto-scaling
  // would turn a 4.6 → 4.5 wobble into a cliff.
  const width = 160
  const height = 40
  const path =
    points.length < 2
      ? null
      : points
          .map((score, index) => {
            const x = (index / (points.length - 1)) * width
            const y = height - ((score - 1) / 4) * height
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')

  return (
    <section className="border-line bg-surface rounded-xl border p-4">
      <h2 className="text-ink-muted mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
        Experience journey
      </h2>

      <div className="flex flex-wrap items-center gap-4">
        {path ? (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Overall scores across ${points.length} visits: ${points.join(', ')}`}
            className="shrink-0"
          >
            <path
              d={path}
              fill="none"
              stroke={TONE.stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((score, index) => (
              <circle
                key={index}
                cx={(index / (points.length - 1)) * width}
                cy={height - ((score - 1) / 4) * height}
                r="2.5"
                fill={TONE.stroke}
              />
            ))}
          </svg>
        ) : (
          <p className="text-ink-muted text-sm">Not enough scored visits to draw a trend.</p>
        )}

        <div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              TONE.chip,
            )}
          >
            <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
            {VERDICT_LABEL[verdict]}
          </span>

          <p className="text-ink-muted mt-1.5 text-xs">
            {verdict === 'insufficient'
              ? 'Three scored visits are needed before a direction can be called.'
              : `${points.map((score) => score.toFixed(1)).join(' → ')} across the last ${visitsConsidered} visits` +
                (slope === null ? '' : ` · ${slope > 0 ? '+' : ''}${slope} per visit`)}
          </p>
        </div>
      </div>
    </section>
  )
}
