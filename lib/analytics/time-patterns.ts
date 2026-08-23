/**
 * Pattern detection for the time-of-day (§33) and day-of-week (§34) cuts.
 *
 * Pure, and deliberately not in lib/queries: that layer is `server-only`, which
 * would make this untestable outside a request. Data access fetches; this
 * decides whether what came back is worth calling a pattern.
 */

export type PatternRow = {
  label: string
  average: number | null
  ratingCount: number
}

export type PatternGap = {
  worst: string
  best: string
  gap: number
}

/**
 * The best/worst slot pair, but only when the claim is defensible.
 *
 * Two guards, both load-bearing:
 *
 * - a slot below `minSample` is excluded entirely. "Saturday service is worse"
 *   on two Saturday ratings is a coin flip, and §28 requires a minimum sample
 *   before claiming a pattern.
 * - the spread must reach `minGap`. Reporting a 0.05 difference as a finding
 *   teaches people to ignore the section, which costs more than saying nothing.
 */
export function significantGaps(
  rows: PatternRow[],
  minSample: number,
  minGap = 0.4,
): PatternGap | null {
  const eligible = rows.filter(
    (row): row is PatternRow & { average: number } =>
      row.average !== null && row.ratingCount >= minSample,
  )

  if (eligible.length < 2) return null

  const sorted = [...eligible].sort((a, b) => a.average - b.average)
  const worst = sorted[0]
  const best = sorted[sorted.length - 1]
  if (!worst || !best) return null

  const gap = Math.round((best.average - worst.average) * 100) / 100
  if (gap < minGap) return null

  return { worst: worst.label, best: best.label, gap }
}
