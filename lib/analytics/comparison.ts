import { addDays, format, parseISO } from 'date-fns'
import { comparisonLabel, rangeLengthDays, type DateRange } from '@/lib/range'

/**
 * The §36 comparison engine.
 *
 * > Never render a bare number. `Service = 4.1` is a failure.
 * > `Service 4.1 ↓ 11% vs previous 7 days` is the product.
 *
 * So every metric leaves the query layer as a Comparison, not a number. The
 * type makes the bare-number failure mode awkward to write by accident.
 */

export type Direction = 'up' | 'down' | 'flat'

export type Comparison = {
  value: number | null
  previous: number | null
  /** value − previous, or null when either side is missing. */
  delta: number | null
  /** Percentage change against previous, or null when previous is 0 or missing. */
  deltaPct: number | null
  direction: Direction
  /** "vs previous 7 days" — always says what it is comparing against. */
  label: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Compare a value against its previous-period counterpart.
 *
 * `deltaPct` is null when previous is 0: "up from nothing" has no percentage,
 * and rendering ∞% or 100% would both be lies. The card shows the raw delta in
 * that case instead.
 */
export function compare(
  value: number | null,
  previous: number | null,
  label = 'vs previous period',
): Comparison {
  if (value === null || previous === null) {
    return {
      value,
      previous,
      delta: null,
      deltaPct: null,
      direction: 'flat',
      label,
    }
  }

  const delta = round2(value - previous)
  const deltaPct = previous === 0 ? null : round2((delta / Math.abs(previous)) * 100)

  return {
    value,
    previous,
    delta,
    deltaPct,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    label,
  }
}

/** compare(), with the label derived from the range it was measured over. */
export function compareOverRange(
  value: number | null,
  previous: number | null,
  range: DateRange,
): Comparison {
  return compare(value, previous, comparisonLabel(range))
}

function shift(day: string, days: number): string {
  return format(addDays(parseISO(day), days), 'yyyy-MM-dd')
}

/**
 * The window a range should be compared against (§36).
 *
 * Always the immediately preceding window of equal length: today→yesterday,
 * this week→last week, a custom 12 days→the 12 days before it. Equal length
 * matters — comparing a 3-day window against a 7-day one would make every
 * short window look like a collapse.
 */
export function previousPeriod(range: DateRange): DateRange {
  const days = rangeLengthDays(range)
  return {
    preset: range.preset,
    from: shift(range.from, -days),
    to: shift(range.to, -days),
  }
}

/** The current window plus its comparison window, ready for two queries. */
export function resolvePeriods(range: DateRange): { current: DateRange; previous: DateRange } {
  return { current: range, previous: previousPeriod(range) }
}

/**
 * The trailing window for "Today vs 7-day average" (§36).
 *
 * Ends the day before the range starts, so today is never averaged into the
 * baseline it is being judged against.
 */
export function trailingWindow(range: DateRange, days: number): DateRange {
  const to = shift(range.from, -1)
  return { preset: 'custom', from: shift(to, -(days - 1)), to }
}

/** Is this movement good news? Some metrics are better when they fall. */
export type Polarity = 'higher-is-better' | 'lower-is-better'

export function isImprovement(comparison: Comparison, polarity: Polarity): boolean | null {
  if (comparison.delta === null || comparison.direction === 'flat') return null
  return polarity === 'higher-is-better'
    ? comparison.direction === 'up'
    : comparison.direction === 'down'
}
