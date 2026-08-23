import { compare, type Comparison } from './comparison'
import type { Insight, InsightFilter, Severity } from './insights'
import type { CategoryPerformance, IssueCount, ThemeCount } from '@/lib/queries/types'

/**
 * The §9 insight generators — the system writes these, not a person.
 *
 * Pure functions over already-aggregated inputs, so each can be tested against
 * a fixture without a database. Every threshold comes from config.thresholds;
 * there is not a single hard-coded number in this file.
 *
 * The rule that shapes all of them: a claim needs enough evidence to be worth
 * making. Below `min_sample_size` no insight is emitted at all — "Food is down
 * 40%" on two ratings is noise, and a dashboard that cries wolf gets ignored,
 * which is worse than a dashboard that says nothing.
 */

export type Thresholds = {
  category_attention: number
  category_strong: number
  category_drop_pct: number
  issue_spike_pct: number
  theme_emerging_pct: number
  low_rating_cluster_count: number
  min_sample_size: number
}

export type GeneratorContext = {
  thresholds: Thresholds
  /** Carried into every deep link so the feedback list opens on this window. */
  from: string
  to: string
  periodLabel: string
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** Magnitude for ranking: how far past its threshold the finding is. */
function magnitude(comparison: Comparison, thresholdPct: number): number {
  const moved = Math.abs(comparison.deltaPct ?? 0)
  return Math.max(0, moved - thresholdPct)
}

// -----------------------------------------------------------------------------
// CATEGORY_DROP — a category down more than X% against the previous period
// -----------------------------------------------------------------------------

export function categoryDropInsights(
  categories: CategoryPerformance[],
  context: GeneratorContext,
  topIssues: IssueCount[] = [],
): Insight[] {
  const { thresholds } = context

  return categories.flatMap((category) => {
    const { score } = category

    if (category.ratingCount < thresholds.min_sample_size) return []
    if (score.value === null || score.previous === null) return []
    if (score.deltaPct === null || score.deltaPct >= 0) return []
    if (Math.abs(score.deltaPct) < thresholds.category_drop_pct) return []

    // A category that fell but is still strong is worth noting, not alarming.
    const severity: Severity = score.value < thresholds.category_attention ? 'critical' : 'warning'

    const leadingIssue = topIssues.find((issue) => (issue.mentions.value ?? 0) > 0)
    const evidence = [
      `${plural(category.ratingCount, 'rating')} in this period, ${category.negativeCount} of them 1 or 2.`,
      leadingIssue
        ? `Most-mentioned issue: ${leadingIssue.name} — ${plural(leadingIssue.mentions.value ?? 0, 'mention')}.`
        : null,
    ]
      .filter(Boolean)
      .join(' ')

    return [
      {
        id: `CATEGORY_DROP:${category.categoryId}`,
        type: 'CATEGORY_DROP' as const,
        severity,
        title: `${category.name} is down ${Math.abs(score.deltaPct)}% ${score.label}`,
        metric: score,
        evidence,
        filter: {
          from: context.from,
          to: context.to,
          categoryId: category.categoryId,
          ratingBand: 'negative',
        } satisfies InsightFilter,
        score: magnitude(score, thresholds.category_drop_pct),
      },
    ]
  })
}

// -----------------------------------------------------------------------------
// CATEGORY_STRONG — a category above the strong threshold and still climbing
// -----------------------------------------------------------------------------

export function categoryStrongInsights(
  categories: CategoryPerformance[],
  context: GeneratorContext,
): Insight[] {
  const { thresholds } = context

  return categories.flatMap((category) => {
    const { score } = category

    if (category.ratingCount < thresholds.min_sample_size) return []
    if (score.value === null) return []
    if (score.value < thresholds.category_strong) return []
    // "Up AND above threshold" (§9). Flat-but-excellent is not news.
    if (score.direction !== 'up') return []

    return [
      {
        id: `CATEGORY_STRONG:${category.categoryId}`,
        type: 'CATEGORY_STRONG' as const,
        severity: 'positive' as const,
        title: `${category.name} is your strongest category and still climbing`,
        metric: score,
        evidence: `${score.value.toFixed(2)} across ${plural(category.ratingCount, 'rating')}, above the ${thresholds.category_strong} threshold.`,
        filter: {
          from: context.from,
          to: context.to,
          categoryId: category.categoryId,
          ratingBand: 'positive',
        } satisfies InsightFilter,
        score: score.deltaPct ?? 0,
      },
    ]
  })
}

// -----------------------------------------------------------------------------
// ISSUE_SPIKE — issue mentions up more than X% against the baseline
// -----------------------------------------------------------------------------

export function issueSpikeInsights(issues: IssueCount[], context: GeneratorContext): Insight[] {
  const { thresholds } = context

  return issues.flatMap((issue) => {
    const mentions = issue.mentions
    const count = mentions.value ?? 0

    // A spike from 1 to 3 is a 200% rise and means nothing.
    if (count < thresholds.min_sample_size) return []
    if (mentions.direction !== 'up') return []

    // No baseline at all is still a spike — it just cannot be a percentage.
    const rose =
      mentions.deltaPct === null
        ? (mentions.previous ?? 0) === 0
        : mentions.deltaPct >= thresholds.issue_spike_pct
    if (!rose) return []

    const change =
      mentions.deltaPct === null
        ? `up from none ${mentions.label.replace(/^vs /, 'in the ')}`
        : `up ${mentions.deltaPct}% ${mentions.label}`

    return [
      {
        id: `ISSUE_SPIKE:${issue.issueId}`,
        type: 'ISSUE_SPIKE' as const,
        severity: 'warning' as const,
        title: `${issue.name} is being raised more often`,
        metric: mentions,
        evidence: `${plural(count, 'mention')} in this period, ${change}.`,
        filter: {
          from: context.from,
          to: context.to,
          issueId: issue.issueId,
        } satisfies InsightFilter,
        score: magnitude(mentions, thresholds.issue_spike_pct),
      },
    ]
  })
}

// -----------------------------------------------------------------------------
// LOW_RATING_CLUSTER — N feedbacks at 1 or 2 on one category
// -----------------------------------------------------------------------------

export type LowRatingCluster = {
  categoryId: string
  categoryName: string
  count: number
  /** Of those, how many asked to be contacted. */
  followUpCount: number
}

export function lowRatingClusterInsights(
  clusters: LowRatingCluster[],
  context: GeneratorContext,
): Insight[] {
  const { thresholds } = context

  return clusters.flatMap((cluster) => {
    if (cluster.count < thresholds.low_rating_cluster_count) return []

    return [
      {
        id: `LOW_RATING_CLUSTER:${cluster.categoryId}`,
        type: 'LOW_RATING_CLUSTER' as const,
        // Several people independently having a bad time in the same place is
        // the single most actionable thing this system can tell anyone.
        severity: 'critical' as const,
        title: `${plural(cluster.count, 'guest')} rated ${cluster.categoryName} 1 or 2 in this period`,
        metric: compare(cluster.count, 0, context.periodLabel),
        evidence:
          cluster.followUpCount > 0
            ? `${plural(cluster.followUpCount, 'guest')} asked to be contacted.`
            : 'None of them asked to be contacted, so nobody is chasing this.',
        filter: {
          from: context.from,
          to: context.to,
          categoryId: cluster.categoryId,
          ratingBand: 'negative',
        } satisfies InsightFilter,
        score: cluster.count * 10,
      },
    ]
  })
}

// -----------------------------------------------------------------------------
// THEME_EMERGING — a comment theme appearing more often
// -----------------------------------------------------------------------------

export function themeEmergingInsights(themes: ThemeCount[], context: GeneratorContext): Insight[] {
  const { thresholds } = context

  return themes.flatMap((theme) => {
    const mentions = theme.mentions
    const count = mentions.value ?? 0

    if (count < thresholds.min_sample_size) return []
    if (mentions.direction !== 'up') return []

    const rose =
      mentions.deltaPct === null
        ? (mentions.previous ?? 0) === 0
        : mentions.deltaPct >= thresholds.theme_emerging_pct
    if (!rose) return []

    return [
      {
        id: `THEME_EMERGING:${theme.themeId}`,
        type: 'THEME_EMERGING' as const,
        severity: theme.kind === 'negative' ? ('warning' as const) : ('positive' as const),
        title: `"${theme.name}" is appearing more often in comments`,
        metric: mentions,
        evidence: `${plural(count, 'mention')} across ${plural(theme.feedbackCount, 'comment')}.`,
        filter: {
          from: context.from,
          to: context.to,
          themeId: theme.themeId,
        } satisfies InsightFilter,
        score: magnitude(mentions, thresholds.theme_emerging_pct),
      },
    ]
  })
}

// -----------------------------------------------------------------------------

export type InsightInputs = {
  categories: CategoryPerformance[]
  issues: IssueCount[]
  themes: ThemeCount[]
  clusters: LowRatingCluster[]
}

/** Run every generator over one period. Ranking and the top-N cut are separate. */
export function generateInsights(inputs: InsightInputs, context: GeneratorContext): Insight[] {
  return [
    ...lowRatingClusterInsights(inputs.clusters, context),
    ...categoryDropInsights(inputs.categories, context, inputs.issues),
    ...issueSpikeInsights(inputs.issues, context),
    ...themeEmergingInsights(inputs.themes, context),
    ...categoryStrongInsights(inputs.categories, context),
  ]
}
