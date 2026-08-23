import type { Comparison } from './comparison'

/**
 * Auto-generated insights — CLAUDE.md §9, §21, §37.
 *
 * The system writes these, not a human. Every card has to answer five
 * questions, and the type is shaped so you cannot build one that skips any:
 *
 *   What happened?          title
 *   How significant?        metric (a Comparison, never a bare number)
 *   Improving or worsening? metric.direction + polarity
 *   Why?                    evidence
 *   What next?              filter, which deep-links into the feedback list
 *
 * This file defines the shape and severity rules. The generators that produce
 * insights from data are Prompt 24.
 */

export const INSIGHT_TYPES = [
  'CATEGORY_DROP',
  'ISSUE_SPIKE',
  'LOW_RATING_CLUSTER',
  'CATEGORY_STRONG',
  'THEME_EMERGING',
] as const

export type InsightType = (typeof INSIGHT_TYPES)[number]

export const SEVERITIES = ['critical', 'warning', 'info', 'positive'] as const
export type Severity = (typeof SEVERITIES)[number]

/** Query params that open the feedback list already filtered to the evidence. */
export type InsightFilter = {
  from?: string
  to?: string
  categoryId?: string
  issueId?: string
  themeId?: string
  ratingBand?: 'positive' | 'neutral' | 'negative'
}

export type Insight = {
  id: string
  type: InsightType
  severity: Severity
  /** What happened, in one line. */
  title: string
  /** How significant, as a comparison — never a bare number. */
  metric: Comparison
  /** Why: the supporting evidence line, e.g. "Main issue: Waiting Time — 23 mentions". */
  evidence: string
  /** What next: the pre-filtered feedback list this card links to. */
  filter: InsightFilter
  /** Ranking weight — severity x magnitude, set by the generator. */
  score: number
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
  positive: 1,
}

/**
 * Rank by severity first, then by magnitude (§24).
 *
 * A 40% drop in a category the café barely gets rated on should not outrank
 * three 1-star Service ratings in the last hour, so severity dominates and
 * magnitude only breaks ties within a band.
 */
export function rankInsights(insights: Insight[], limit = 5): Insight[] {
  return [...insights]
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
      if (bySeverity !== 0) return bySeverity
      return b.score - a.score
    })
    .slice(0, limit)
}

/** Build the querystring for a card's VIEW FEEDBACK → link. */
export function insightHref(filter: InsightFilter, base = '/admin/feedback'): string {
  const params = new URLSearchParams()
  if (filter.from && filter.to) {
    params.set('range', 'custom')
    params.set('from', filter.from)
    params.set('to', filter.to)
  }
  if (filter.categoryId) params.set('categoryId', filter.categoryId)
  if (filter.issueId) params.set('issueId', filter.issueId)
  if (filter.themeId) params.set('themeId', filter.themeId)
  if (filter.ratingBand) params.set('ratingBand', filter.ratingBand)

  const query = params.toString()
  return query === '' ? base : `${base}?${query}`
}
