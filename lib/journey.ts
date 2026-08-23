/**
 * Journey routing — CLAUDE.md §4.
 *
 * Pure functions with no React and no storage access, so the branch rules can
 * be unit-tested directly and reused server-side when the submit computes
 * `sentiment`.
 *
 * The rules, verbatim from §4:
 *   - negative when ANY single category rating <= 2
 *   - positive when the average >= 4 AND no rating <= 2
 *   - mixed/neutral otherwise — skip both branches, straight to the comment
 *
 * Note the asymmetry: one bad category sends the whole journey down the
 * negative path even if everything else was perfect. That is deliberate. A
 * guest who had one genuinely bad experience should be asked about it, not
 * averaged into silence.
 */

export const NEGATIVE_AT_OR_BELOW = 2
export const POSITIVE_AVERAGE_AT_LEAST = 4

export type Pathway = 'negative' | 'positive' | 'neutral'

export type KioskRoute = '/' | '/rate' | '/issues' | '/loved' | '/comment' | '/contact' | '/thanks'

/** Mean of the given ratings, or null when there are none. */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null
  const total = ratings.reduce((sum, rating) => sum + rating, 0)
  return total / ratings.length
}

/** Rounded to two decimals for `feedback.overall_score` (numeric(3,2)). */
export function overallScore(ratings: number[]): number | null {
  const average = averageRating(ratings)
  return average === null ? null : Math.round(average * 100) / 100
}

/** Which emotional pathway this set of ratings belongs to (§4). */
export function pathwayFor(ratings: number[]): Pathway {
  if (ratings.length === 0) return 'neutral'
  if (ratings.some((rating) => rating <= NEGATIVE_AT_OR_BELOW)) return 'negative'

  const average = averageRating(ratings)
  if (average !== null && average >= POSITIVE_AVERAGE_AT_LEAST) return 'positive'

  return 'neutral'
}

/**
 * `feedback.sentiment` (§7). Same rule as the pathway, so what the guest was
 * asked and what the dashboard reports can never disagree.
 */
export function sentimentFor(ratings: number[]): Pathway {
  return pathwayFor(ratings)
}

/** Where CONTINUE on the rate screen goes. */
export function routeAfterRating(ratings: number[]): KioskRoute {
  switch (pathwayFor(ratings)) {
    case 'negative':
      return '/issues'
    case 'positive':
      return '/loved'
    case 'neutral':
      return '/comment'
  }
}

/**
 * The rest of the journey after the branch. Kept here so the order lives in one
 * place rather than being spelled out again in every screen's CTA.
 *
 * Four taps from Welcome to done. The standalone comment screen and the
 * "would you like us to follow up?" screen were both removed at the client's
 * request: the comment now lives on the branch screen the guest is already on,
 * and asking about a callback immediately before asking for a phone number was
 * asking the same question twice.
 *
 * /comment survives only as the neutral branch — a guest who rated everything
 * 3 has no chips to pick, so the comment IS their screen rather than an extra
 * one.
 */
export function routeAfter(current: KioskRoute, ratings: number[]): KioskRoute {
  switch (current) {
    case '/':
      return '/rate'
    case '/rate':
      return routeAfterRating(ratings)
    case '/issues':
    case '/loved':
    case '/comment':
      return '/contact'
    case '/contact':
      return '/thanks'
    case '/thanks':
      return '/'
  }
}

/** Ratings map (category_id → value) to a plain array, for the functions above. */
export function ratingValues(ratings: Record<string, number>): number[] {
  return Object.values(ratings)
}
