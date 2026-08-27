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

describe('the Memory Print Module in the journey (§4, PHOTO_MODULE.md §7)', () => {
  const good = [5, 5, 5, 5]

  it('sits between contact and thank-you when it is on', () => {
    expect(routeAfter('/contact', good, true)).toBe('/memory')
    expect(routeAfter('/memory', good, true)).toBe('/thanks')
  })

  it('vanishes completely when the kill switch is off (§8b layer 1)', () => {
    // Not a skipped step, not a disabled screen — the journey must not route
    // through it at all. A guest on a disabled kiosk should not be able to tell
    // the feature exists.
    expect(routeAfter('/contact', good, false)).toBe('/thanks')
  })

  it('defaults to off, so forgetting the flag cannot open a camera', () => {
    // The safe default. A call site that has not been taught about the module
    // routes past it rather than into it.
    expect(routeAfter('/contact', good)).toBe('/thanks')
  })

  it('never appears before the commit point', () => {
    // Rule 1: the feedback is saved before the camera opens. Nothing earlier in
    // the journey may route to /memory, whatever the ratings.
    for (const ratings of [
      [1, 1, 1, 1],
      [5, 5, 5, 5],
      [3, 3, 3, 3],
    ]) {
      for (const step of ['/', '/rate', '/issues', '/loved', '/comment'] as const) {
        expect(routeAfter(step, ratings, true), step).not.toBe('/memory')
      }
    }
  })

  it('is reachable on every pathway, not only the happy one (§14.3)', () => {
    // The keepsake is unconditional. A 1/5 guest and a 5/5 guest must both be
    // routed to it — the copy differs, the offer does not.
    for (const ratings of [
      [1, 1, 1, 1],
      [5, 5, 5, 5],
      [3, 3, 3, 3],
    ]) {
      let at = routeAfter('/', ratings, true)
      const seen = new Set<string>()
      for (let step = 0; step < 8 && at !== '/'; step += 1) {
        seen.add(at)
        at = routeAfter(at, ratings, true)
      }
      expect([...seen], JSON.stringify(ratings)).toContain('/memory')
    }
  })
})

describe('compulsory contact details (§4, client decision 27 Aug 2026)', () => {
  it('still routes onward from contact — the block is on the screen, not the journey', () => {
    // Requiring a number changes what a guest must do to leave the screen. It
    // does not add a state the journey can get stuck in: whichever way they
    // leave, the next step is the same.
    expect(routeAfter('/contact', [5, 5, 5, 5], false)).toBe('/thanks')
    expect(routeAfter('/contact', [5, 5, 5, 5], true)).toBe('/memory')
  })
})
