import { significantGaps } from '@/lib/analytics/time-patterns'
import type { BucketBreakdown, DayBreakdown } from '@/lib/queries/time'
import type { DateRange } from '@/lib/range'
import { cn } from '@/lib/cn'

/**
 * Time-of-day (§33) and day-of-week (§34).
 *
 * Two rules make this trustworthy rather than decorative:
 *
 * 1. A row below the minimum sample size shows its count and no average. Two
 *    ratings on a Tuesday is not a Tuesday problem.
 * 2. The plain-language finding underneath only appears when the gap between
 *    the best and worst eligible slot is large enough to act on. Reporting a
 *    0.05 difference as a pattern teaches people to ignore the section.
 */
function Row({
  label,
  average,
  ratingCount,
  negativeCount,
  minSample,
  max,
}: {
  label: string
  average: number | null
  ratingCount: number
  negativeCount: number
  minSample: number
  max: number
}) {
  const thin = ratingCount < minSample
  const width = average === null || max === 0 ? 0 : (average / 5) * 100

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-ink text-sm">{label}</span>
        <span className="flex items-baseline gap-3">
          {thin ? (
            <span className="text-ink-muted text-xs">
              {ratingCount === 0 ? 'no ratings' : `only ${ratingCount} ratings`}
            </span>
          ) : (
            <>
              <span className="text-ink-muted text-xs tabular-nums">
                {ratingCount} ratings · {negativeCount} negative
              </span>
              <span className="text-ink text-sm tabular-nums">{average?.toFixed(2)}</span>
            </>
          )}
        </span>
      </div>
      <div className="bg-ground-sunk mt-1.5 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full', thin ? 'bg-line-strong' : 'bg-accent')}
          style={{ width: `${thin ? 0 : width}%` }}
        />
      </div>
    </li>
  )
}

function Panel({
  title,
  rows,
  minSample,
  finding,
}: {
  title: string
  rows: { label: string; average: number | null; ratingCount: number; negativeCount: number }[]
  minSample: number
  finding: string | null
}) {
  const max = Math.max(0, ...rows.map((row) => row.average ?? 0))

  return (
    <div>
      <h3 className="text-ink-muted mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
        {title}
      </h3>
      <ul className="border-line bg-surface divide-line divide-y rounded-2xl border">
        {rows.map((row) => (
          <Row key={row.label} {...row} minSample={minSample} max={max} />
        ))}
      </ul>
      {finding ? (
        <p className="text-ink-soft mt-2 text-xs">{finding}</p>
      ) : (
        <p className="text-ink-muted mt-2 text-xs">
          Not enough data yet to call a pattern in this period.
        </p>
      )}
    </div>
  )
}

export function TimeAndDay({
  byHour,
  byDay,
  minSample,
  range: _range,
}: {
  byHour: BucketBreakdown[]
  byDay: DayBreakdown[]
  minSample: number
  range: DateRange
}) {
  const hourGap = significantGaps(byHour, minSample)
  const dayGap = significantGaps(byDay, minSample)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title="By time of day"
        rows={byHour}
        minSample={minSample}
        finding={
          hourGap
            ? `Satisfaction is lowest at ${hourGap.worst} and highest at ${hourGap.best} — a gap of ${hourGap.gap}.`
            : null
        }
      />
      <Panel
        title="By day of week"
        rows={byDay}
        minSample={minSample}
        finding={
          dayGap
            ? `${dayGap.worst} is your weakest day and ${dayGap.best} your strongest — a gap of ${dayGap.gap}.`
            : null
        }
      />
    </div>
  )
}
