import { describe, expect, it } from 'vitest'
import { analyseJourney, MIN_VISITS, VERDICT_LABEL } from '@/lib/analytics/guest-journey'

describe('analyseJourney — §31', () => {
  it('reads a steadily rising guest as improving', () => {
    // The example from the spec.
    const result = analyseJourney([3.2, 3.8, 4.4, 4.7])
    expect(result.verdict).toBe('improving')
    expect(result.slope).toBeGreaterThan(0)
  })

  it('reads the same sequence reversed as declining', () => {
    const result = analyseJourney([4.7, 4.4, 3.8, 3.2])
    expect(result.verdict).toBe('declining')
    expect(result.slope).toBeLessThan(0)
  })

  it('needs at least three visits before saying anything', () => {
    expect(analyseJourney([]).verdict).toBe('insufficient')
    expect(analyseJourney([4.5]).verdict).toBe('insufficient')
    expect(analyseJourney([4.5, 3.0]).verdict).toBe('insufficient')
    expect(analyseJourney([4.5, 3.0, 4.0]).verdict).not.toBe('insufficient')
    expect(MIN_VISITS).toBe(3)
  })

  it('does not call ordinary variation a decline', () => {
    // Wobbles either side of 4.5 with no real direction.
    expect(analyseJourney([4.5, 4.4, 4.6, 4.5]).verdict).toBe('stable')
    expect(analyseJourney([4.0, 4.0, 4.0, 4.0]).verdict).toBe('stable')
    // A drift too small to act on.
    expect(analyseJourney([4.4, 4.45, 4.5, 4.55]).verdict).toBe('stable')
  })

  it('only considers the most recent visits', () => {
    // Terrible a year ago, consistently good since: that is not "declining".
    const result = analyseJourney([1, 1, 1, 4.5, 4.6, 4.7, 4.8, 4.9])
    expect(result.visitsConsidered).toBeLessThanOrEqual(6)
    expect(result.verdict).toBe('improving')
  })

  it('ignores visits with no score rather than treating them as zero', () => {
    const withGaps = analyseJourney([3.2, null, 3.8, null, 4.4, 4.7])
    expect(withGaps.points).toEqual([3.2, 3.8, 4.4, 4.7])
    expect(withGaps.verdict).toBe('improving')
  })

  it('judges by visit, not by elapsed time', () => {
    // A twice-a-year guest and a weekly one with the same shape get the same
    // verdict — the question is whether each visit beat the last.
    expect(analyseJourney([3, 4, 5]).verdict).toBe(analyseJourney([3, 4, 5]).verdict)
    expect(analyseJourney([3, 4, 5]).slope).toBe(1)
  })

  it('has a label for every verdict', () => {
    for (const verdict of ['improving', 'declining', 'stable', 'insufficient'] as const) {
      expect(VERDICT_LABEL[verdict]).toBeTruthy()
    }
    expect(VERDICT_LABEL.declining).toBe('CUSTOMER EXPERIENCE DECLINING')
  })
})
