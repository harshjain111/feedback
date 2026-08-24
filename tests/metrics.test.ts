import { describe, expect, it } from 'vitest'
import {
  averageRating,
  avgResolutionHours,
  complaintRate,
  contactableComplaintRate,
  negativePct,
  neutralPct,
  positivePct,
  ratingBreakdown,
  repeatGuestPct,
  resolutionRate,
} from '@/lib/analytics/metrics'
import {
  compare,
  compareOverRange,
  isImprovement,
  previousPeriod,
  resolvePeriods,
  trailingWindow,
} from '@/lib/analytics/comparison'
import { parseRange, rangeForPreset, rangeLengthDays } from '@/lib/range'

const TODAY = '2026-08-23'

describe('metrics — §9 formulas', () => {
  it('averages ratings to two decimals', () => {
    expect(averageRating([5, 4, 4, 4])).toBe(4.25)
    expect(averageRating([5, 5, 4])).toBe(4.67)
    expect(averageRating([1])).toBe(1)
  })

  it('splits positive / neutral / negative by the §9 bands', () => {
    const ratings = [5, 5, 4, 3, 2, 1]
    expect(positivePct(ratings)).toBe(50) // 3 of 6
    expect(neutralPct(ratings)).toBeCloseTo(16.7, 1) // 1 of 6
    expect(negativePct(ratings)).toBeCloseTo(33.3, 1) // 2 of 6
  })

  it('splits sum to 100% for any set of ratings', () => {
    for (const ratings of [
      [5, 4, 3, 2, 1],
      [1, 1, 1],
      [4, 4, 5, 5],
      [3, 3, 3, 3, 3],
    ]) {
      const total =
        (positivePct(ratings) ?? 0) + (neutralPct(ratings) ?? 0) + (negativePct(ratings) ?? 0)
      expect(total, ratings.join(',')).toBeCloseTo(100, 0)
    }
  })
})

describe('metrics — empty periods return null, never zero', () => {
  it('does not claim 0% positive for a period with no feedback', () => {
    expect(averageRating([])).toBeNull()
    expect(positivePct([])).toBeNull()
    expect(neutralPct([])).toBeNull()
    expect(negativePct([])).toBeNull()
  })

  it('never divides by zero', () => {
    expect(complaintRate(0, 0)).toBeNull()
    expect(contactableComplaintRate(0, 0)).toBeNull()
    expect(resolutionRate(0, 0)).toBeNull()
    expect(repeatGuestPct(0, 0)).toBeNull()
    expect(avgResolutionHours([])).toBeNull()
  })

  it('still reports 0% when there genuinely were none of something', () => {
    expect(complaintRate(0, 20)).toBe(0)
    expect(negativePct([5, 5, 4, 4])).toBe(0)
  })
})

describe('metrics — rates', () => {
  it('computes complaint, contactable and resolution rates', () => {
    expect(complaintRate(3, 20)).toBe(15)
    expect(resolutionRate(7, 10)).toBe(70)
    // 3 of 5 unhappy guests left a number.
    expect(contactableComplaintRate(3, 5)).toBe(60)
  })

  it('keeps the contactable rate independent of the complaint rate', () => {
    // The point of the redefinition. The old ratio divided by total feedbacks,
    // which made it a strict fraction of complaintRate and therefore unable to
    // say anything complaintRate did not already say. Over complaints it can
    // reach 100% on a terrible day and 0% on a mildly bad one.
    expect(contactableComplaintRate(4, 4)).toBe(100)
    expect(contactableComplaintRate(0, 4)).toBe(0)
    expect(complaintRate(4, 100)).toBe(4)
  })

  it('is null with no complaints, not 0%', () => {
    // 0% would read as "we cannot reach any of our unhappy guests" on a day
    // when nobody was unhappy.
    expect(contactableComplaintRate(0, 0)).toBeNull()
  })

  it('averages only follow-ups that actually resolved', () => {
    const twoHours = 2 * 3_600_000
    const fourHours = 4 * 3_600_000
    expect(avgResolutionHours([twoHours, fourHours])).toBe(3)
  })

  it('measures repeat guests against identified guests, not all feedback', () => {
    // 40 submissions, 10 identified guests, 4 of them returning.
    expect(repeatGuestPct(4, 10)).toBe(40)
  })

  it('summarises a category in one pass', () => {
    expect(ratingBreakdown([5, 4, 2])).toEqual({
      count: 3,
      average: 3.67,
      positive: 66.7,
      neutral: 0,
      negative: 33.3,
    })
  })
})

describe('compare — §36', () => {
  it('returns the full comparison shape', () => {
    expect(compare(4.1, 4.6, 'vs previous 7 days')).toEqual({
      value: 4.1,
      previous: 4.6,
      delta: -0.5,
      deltaPct: -10.87,
      direction: 'down',
      label: 'vs previous 7 days',
    })
  })

  it('reports flat when nothing moved', () => {
    expect(compare(4, 4).direction).toBe('flat')
    expect(compare(4, 4).delta).toBe(0)
  })

  it('gives no percentage when the previous period was zero', () => {
    // "Up from nothing" has no percentage; ∞% and 100% would both be lies.
    const up = compare(3, 0)
    expect(up.delta).toBe(3)
    expect(up.deltaPct).toBeNull()
    expect(up.direction).toBe('up')
  })

  it('gives no comparison at all when either side is missing', () => {
    expect(compare(null, 4).delta).toBeNull()
    expect(compare(4, null).delta).toBeNull()
    expect(compare(4, null).direction).toBe('flat')
  })

  it('carries a label saying what it compared against', () => {
    const range = rangeForPreset('7d', TODAY)
    expect(compareOverRange(4.1, 4.6, range).label).toBe('vs previous 7 days')
    expect(compareOverRange(4.1, 4.6, rangeForPreset('today', TODAY)).label).toBe('vs yesterday')
  })
})

describe('isImprovement — direction is not the same as good', () => {
  it('reads a rising rating as good and a rising complaint rate as bad', () => {
    const rising = compare(4.5, 4.0)
    expect(isImprovement(rising, 'higher-is-better')).toBe(true)
    expect(isImprovement(rising, 'lower-is-better')).toBe(false)
  })

  it('has no opinion when nothing moved or nothing is known', () => {
    expect(isImprovement(compare(4, 4), 'higher-is-better')).toBeNull()
    expect(isImprovement(compare(null, 4), 'higher-is-better')).toBeNull()
  })
})

describe('resolvePeriods — §36 comparison windows', () => {
  it('compares today against yesterday', () => {
    const { previous } = resolvePeriods(rangeForPreset('today', TODAY))
    expect(previous.from).toBe('2026-08-22')
    expect(previous.to).toBe('2026-08-22')
  })

  it('compares 7 days against the 7 days immediately before, with no overlap', () => {
    const current = rangeForPreset('7d', TODAY)
    const previous = previousPeriod(current)

    expect(current.from).toBe('2026-08-17')
    expect(previous).toMatchObject({ from: '2026-08-10', to: '2026-08-16' })
    expect(previous.to < current.from).toBe(true)
  })

  it('compares 30 days against the preceding 30', () => {
    const previous = previousPeriod(rangeForPreset('30d', TODAY))
    expect(previous.from).toBe('2026-06-25')
    expect(previous.to).toBe('2026-07-24')
  })

  it('compares a custom window against an EQUAL-length preceding window', () => {
    const current = parseRange({ range: 'custom', from: '2026-08-01', to: '2026-08-12' }, TODAY)
    const previous = previousPeriod(current)

    expect(rangeLengthDays(previous)).toBe(rangeLengthDays(current))
    expect(previous).toMatchObject({ from: '2026-07-20', to: '2026-07-31' })
  })

  it('keeps equal length for every preset — a short window must not look like a collapse', () => {
    for (const preset of ['today', 'yesterday', '7d', '30d'] as const) {
      const current = rangeForPreset(preset, TODAY)
      expect(rangeLengthDays(previousPeriod(current)), preset).toBe(rangeLengthDays(current))
    }
  })
})

describe('trailingWindow — today vs the 7-day average', () => {
  it('ends the day before the range starts, so today is not in its own baseline', () => {
    const today = rangeForPreset('today', TODAY)
    const trailing = trailingWindow(today, 7)

    expect(trailing.to).toBe('2026-08-22')
    expect(trailing.from).toBe('2026-08-16')
    expect(rangeLengthDays(trailing)).toBe(7)
    expect(trailing.to < today.from).toBe(true)
  })
})
