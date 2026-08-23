import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { toLocalDate } from './time'

/**
 * The date range every admin view is scoped by.
 *
 * It lives in the URL (§19: views must be shareable and bookmarkable), and it
 * is always expressed as Kolkata calendar dates — the same `local_date` the
 * feedback rows carry — never as instants. "Today" means the café's today.
 */

export const RANGE_PRESETS = ['today', 'yesterday', '7d', '30d', 'custom'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export type DateRange = {
  preset: RangePreset
  /** Inclusive, yyyy-MM-dd, Asia/Kolkata. */
  from: string
  /** Inclusive, yyyy-MM-dd, Asia/Kolkata. */
  to: string
}

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': '7 Days',
  '30d': '30 Days',
  custom: 'Custom',
}

function isPreset(value: string): value is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(value)
}

function shift(day: string, days: number): string {
  return format(addDays(parseISO(day), days), 'yyyy-MM-dd')
}

/** Resolve a preset against the café's today. */
export function rangeForPreset(preset: RangePreset, today = toLocalDate()): DateRange {
  switch (preset) {
    case 'today':
      return { preset, from: today, to: today }
    case 'yesterday': {
      const day = shift(today, -1)
      return { preset, from: day, to: day }
    }
    case '7d':
      // Inclusive of today: 7 calendar days, not 8.
      return { preset, from: shift(today, -6), to: today }
    case '30d':
      return { preset, from: shift(today, -29), to: today }
    case 'custom':
      return { preset, from: today, to: today }
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Read the range out of searchParams, falling back to Today.
 *
 * Never throws on a hand-edited URL: a nonsense preset or a reversed date pair
 * degrades to something sensible rather than 500ing a dashboard.
 */
export function parseRange(
  params: Record<string, string | string[] | undefined>,
  today = toLocalDate(),
): DateRange {
  const raw = typeof params.range === 'string' ? params.range : 'today'
  const preset: RangePreset = isPreset(raw) ? raw : 'today'

  if (preset !== 'custom') return rangeForPreset(preset, today)

  const from = typeof params.from === 'string' && DAY.test(params.from) ? params.from : today
  const to = typeof params.to === 'string' && DAY.test(params.to) ? params.to : today

  // Tolerate a reversed pair rather than returning an empty window.
  return from <= to ? { preset, from, to } : { preset, from: to, to: from }
}

/** Serialise back into a query string, omitting what the preset implies. */
export function rangeToParams(range: DateRange): URLSearchParams {
  const params = new URLSearchParams({ range: range.preset })
  if (range.preset === 'custom') {
    params.set('from', range.from)
    params.set('to', range.to)
  }
  return params
}

/** Inclusive length in days — 1 for a single day. */
export function rangeLengthDays(range: DateRange): number {
  return differenceInCalendarDays(parseISO(range.to), parseISO(range.from)) + 1
}

/** Human label for a comparison line: "vs previous 7 days". */
export function comparisonLabel(range: DateRange): string {
  switch (range.preset) {
    case 'today':
      return 'vs yesterday'
    case 'yesterday':
      return 'vs the day before'
    default: {
      const days = rangeLengthDays(range)
      return days === 1 ? 'vs the previous day' : `vs previous ${days} days`
    }
  }
}
