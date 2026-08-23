/**
 * The §9 metric formulas, as pure functions.
 *
 * Two rules run through all of them:
 *
 * 1. An empty period returns null, never 0. "No feedback yet today" and "every
 *    guest rated us zero" are different facts, and a dashboard that shows 0%
 *    positive for an empty morning is lying to the owner.
 * 2. Percentages are returned 0–100, rounded to one decimal, because that is
 *    what gets rendered. Callers never re-round.
 */

/** Ratings 4–5. */
export const POSITIVE_MIN = 4
/** Ratings 1–2. */
export const NEGATIVE_MAX = 2

function pct(part: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((part / total) * 1000) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Σ ratings / count. */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null
  return round2(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length)
}

/** ratings 4–5 / total. */
export function positivePct(ratings: number[]): number | null {
  return pct(ratings.filter((rating) => rating >= POSITIVE_MIN).length, ratings.length)
}

/** ratings 1–2 / total. */
export function negativePct(ratings: number[]): number | null {
  return pct(ratings.filter((rating) => rating <= NEGATIVE_MAX).length, ratings.length)
}

/** ratings 3 / total. */
export function neutralPct(ratings: number[]): number | null {
  return pct(
    ratings.filter((rating) => rating > NEGATIVE_MAX && rating < POSITIVE_MIN).length,
    ratings.length,
  )
}

/** negative feedbacks / total feedbacks. */
export function complaintRate(negativeFeedbacks: number, totalFeedbacks: number): number | null {
  return pct(negativeFeedbacks, totalFeedbacks)
}

/** follow-up requests / total feedbacks. */
export function followUpRate(followUpRequests: number, totalFeedbacks: number): number | null {
  return pct(followUpRequests, totalFeedbacks)
}

/** resolved / total complaints. */
export function resolutionRate(resolved: number, totalComplaints: number): number | null {
  return pct(resolved, totalComplaints)
}

/**
 * mean(resolved_at - created_at), in hours.
 *
 * Takes only the durations of follow-ups that actually resolved. An unresolved
 * one has no resolution time; counting it as zero would make a backlog look
 * like fast service.
 */
export function avgResolutionHours(resolvedDurationsMs: number[]): number | null {
  if (resolvedDurationsMs.length === 0) return null
  const mean = resolvedDurationsMs.reduce((sum, ms) => sum + ms, 0) / resolvedDurationsMs.length
  return round2(mean / 3_600_000)
}

/**
 * guests with >1 feedback / identified guests.
 *
 * The denominator is identified guests only — anonymous submissions have no
 * guest to be repeat or not, and including them would drag the figure toward
 * zero as a function of how many people declined to give a number.
 */
export function repeatGuestPct(repeatGuests: number, identifiedGuests: number): number | null {
  return pct(repeatGuests, identifiedGuests)
}

/** Convenience for the category tables: every rating metric in one pass. */
export function ratingBreakdown(ratings: number[]): {
  count: number
  average: number | null
  positive: number | null
  neutral: number | null
  negative: number | null
} {
  return {
    count: ratings.length,
    average: averageRating(ratings),
    positive: positivePct(ratings),
    neutral: neutralPct(ratings),
    negative: negativePct(ratings),
  }
}
