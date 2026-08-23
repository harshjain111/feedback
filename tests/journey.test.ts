import { describe, expect, it } from 'vitest'
import {
  averageRating,
  overallScore,
  pathwayFor,
  ratingValues,
  routeAfter,
  routeAfterRating,
  sentimentFor,
} from '@/lib/journey'

describe('pathwayFor — §4 branch rules', () => {
  it('sends all 5s down the positive path', () => {
    expect(pathwayFor([5, 5, 5, 5])).toBe('positive')
  })

  it('sends all 1s down the negative path', () => {
    expect(pathwayFor([1, 1, 1, 1])).toBe('negative')
  })

  it('sends all 3s down neither — straight to the comment', () => {
    expect(pathwayFor([3, 3, 3, 3])).toBe('neutral')
  })

  it('sends ONE 2 among four 5s down the negative path', () => {
    // The load-bearing case. Average is 4.4, which would otherwise read as a
    // great visit — but one category was genuinely bad and must be asked about.
    expect(averageRating([5, 5, 5, 2])).toBeCloseTo(4.25, 2)
    expect(pathwayFor([5, 5, 5, 2])).toBe('negative')
  })

  it('treats exactly 2 as negative and exactly 3 as not', () => {
    expect(pathwayFor([2, 5, 5, 5])).toBe('negative')
    expect(pathwayFor([3, 5, 5, 5])).toBe('positive') // avg 4.5, nothing <= 2
  })

  it('treats an average of exactly 4 as positive', () => {
    expect(averageRating([3, 3, 5, 5])).toBe(4)
    expect(pathwayFor([3, 3, 5, 5])).toBe('positive')
  })

  it('treats an average just under 4 with no low score as neutral', () => {
    expect(averageRating([3, 3, 4, 5])).toBeCloseTo(3.75, 2)
    expect(pathwayFor([3, 3, 4, 5])).toBe('neutral')
  })

  it('handles a single category outlet', () => {
    expect(pathwayFor([5])).toBe('positive')
    expect(pathwayFor([3])).toBe('neutral')
    expect(pathwayFor([1])).toBe('negative')
  })

  it('is neutral when nothing was rated', () => {
    expect(pathwayFor([])).toBe('neutral')
    expect(averageRating([])).toBeNull()
  })
})

describe('routeAfterRating', () => {
  it('routes each pathway to its screen', () => {
    expect(routeAfterRating([1, 4, 4, 4])).toBe('/issues')
    expect(routeAfterRating([5, 5, 4, 4])).toBe('/loved')
    expect(routeAfterRating([3, 3, 3, 3])).toBe('/comment')
  })
})

describe('routeAfter — the rest of the journey', () => {
  const good = [5, 5, 5, 5]

  it('walks the full positive journey in four steps', () => {
    expect(routeAfter('/', good)).toBe('/rate')
    expect(routeAfter('/rate', good)).toBe('/loved')
    expect(routeAfter('/loved', good)).toBe('/contact')
    expect(routeAfter('/contact', good)).toBe('/thanks')
    expect(routeAfter('/thanks', good)).toBe('/')
  })

  it('walks the full negative journey in four steps', () => {
    const bad = [1, 2, 4, 5]
    expect(routeAfter('/rate', bad)).toBe('/issues')
    expect(routeAfter('/issues', bad)).toBe('/contact')
  })

  it('never sends anyone through a standalone follow-up screen', () => {
    // Removed at the client's request: asking "would you like a callback?" and
    // then asking for a phone number is the same question twice.
    const reachable = new Set<string>()
    for (const ratings of [
      [1, 1, 1, 1],
      [5, 5, 5, 5],
      [3, 3, 3, 3],
    ]) {
      let at = routeAfter('/', ratings)
      for (let step = 0; step < 8 && at !== '/'; step += 1) {
        reachable.add(at)
        at = routeAfter(at, ratings)
      }
    }
    expect([...reachable]).not.toContain('/followup')
  })

  it('gives every branch exactly one screen before contact', () => {
    for (const ratings of [
      [1, 1, 1, 1],
      [5, 5, 5, 5],
      [3, 3, 3, 3],
    ]) {
      const branch = routeAfter('/rate', ratings)
      expect(routeAfter(branch, ratings), branch).toBe('/contact')
    }
  })
})

describe('overallScore', () => {
  it('rounds to two decimals so it fits numeric(3,2)', () => {
    expect(overallScore([5, 4, 4, 4])).toBe(4.25)
    expect(overallScore([1, 2, 2, 2])).toBe(1.75)
    expect(overallScore([5, 5, 5, 4])).toBe(4.75)
    // 14/3 = 4.666...
    expect(overallScore([5, 5, 4])).toBe(4.67)
  })

  it('is null with no ratings', () => {
    expect(overallScore([])).toBeNull()
  })
})

describe('sentimentFor', () => {
  it('never disagrees with the pathway the guest was shown', () => {
    for (const ratings of [
      [5, 5, 5, 5],
      [5, 5, 5, 2],
      [3, 3, 3, 3],
      [1, 1, 1, 1],
      [3, 3, 5, 5],
    ]) {
      expect(sentimentFor(ratings)).toBe(pathwayFor(ratings))
    }
  })
})

describe('ratingValues', () => {
  it('turns the draft map into an array', () => {
    expect(ratingValues({ a: 5, b: 2, c: 4 }).sort()).toEqual([2, 4, 5])
    expect(ratingValues({})).toEqual([])
  })
})
