/**
 * The Experience Journey verdict (§31).
 *
 * A guest whose scores went 3.2 → 3.8 → 4.4 → 4.7 is a different management
 * signal from one who went 4.7 → 4.4 → 3.8 → 3.2, and a declining repeat guest
 * is the most valuable warning this system produces: someone who kept coming
 * back and is losing patience.
 *
 * The rule has to be defensible, because it gets shown as a badge with no
 * caveat next to it:
 *
 *   - at least MIN_VISITS visits, otherwise there is no trend, only points
 *   - least-squares slope over the last WINDOW visits, in chronological order
 *   - a stable band around zero, so ordinary variation is not called a decline
 */

export const MIN_VISITS = 3
export const WINDOW = 6
/** Rating points per visit. Below this in either direction reads as stable. */
export const STABLE_BAND = 0.15

export type JourneyVerdict = 'improving' | 'declining' | 'stable' | 'insufficient'

export type JourneyAnalysis = {
  verdict: JourneyVerdict
  /** Least-squares slope in rating points per visit, or null when unknown. */
  slope: number | null
  /** The scores actually used, oldest first. */
  points: number[]
  visitsConsidered: number
}

/**
 * @param scoresOldestFirst every visit's overall score, chronological.
 *   Visits with no score (nothing rated) are ignored rather than treated as 0.
 */
export function analyseJourney(scoresOldestFirst: (number | null)[]): JourneyAnalysis {
  const scored = scoresOldestFirst.filter((score): score is number => score !== null)
  const points = scored.slice(-WINDOW)

  if (points.length < MIN_VISITS) {
    return { verdict: 'insufficient', slope: null, points, visitsConsidered: points.length }
  }

  // Least squares against visit index. Index rather than date on purpose: the
  // question is "is each visit better than the last", not "is it improving per
  // week" — a guest who comes twice a year and one who comes weekly should be
  // judged the same way.
  const n = points.length
  const meanX = (n - 1) / 2
  const meanY = points.reduce((sum, value) => sum + value, 0) / n

  let numerator = 0
  let denominator = 0
  for (const [index, value] of points.entries()) {
    numerator += (index - meanX) * (value - meanY)
    denominator += (index - meanX) ** 2
  }

  const slope = denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 1000

  const verdict: JourneyVerdict =
    slope > STABLE_BAND ? 'improving' : slope < -STABLE_BAND ? 'declining' : 'stable'

  return { verdict, slope, points, visitsConsidered: n }
}

export const VERDICT_LABEL: Record<JourneyVerdict, string> = {
  improving: 'CUSTOMER EXPERIENCE IMPROVING',
  declining: 'CUSTOMER EXPERIENCE DECLINING',
  stable: 'CUSTOMER EXPERIENCE STEADY',
  insufficient: 'NOT ENOUGH VISITS YET',
}
