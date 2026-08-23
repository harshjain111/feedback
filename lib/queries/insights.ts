import 'server-only'

import { generateInsights, type LowRatingCluster } from '@/lib/analytics/insight-generators'
import { rankInsights, type Insight } from '@/lib/analytics/insights'
import { getCurrentUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import { comparisonLabel, type DateRange } from '@/lib/range'
import { getCategoryPerformance, getThemeBreakdown, getTopIssues } from './index'

/**
 * Insights for a range (§21, §37).
 *
 * This module only fetches and wires; every rule lives in the pure generators
 * so it can be tested without a database. Thresholds come from config, so a
 * manager tuning sensitivity in settings changes what the dashboard says
 * without a deploy.
 */

/** Guests who rated a category 1 or 2 in this window, per category. */
export async function getLowRatingClusters(range: DateRange): Promise<LowRatingCluster[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const client = await createClient()

  const [factsResult, categoriesResult] = await Promise.all([
    client
      .from('v_rating_facts')
      .select('feedback_id, category_id, rating, follow_up_requested')
      .eq('outlet_id', user.outletId)
      .gte('local_date', range.from)
      .lte('local_date', range.to)
      .lte('rating', 2),
    client
      .from('categories')
      .select('category_id, name')
      .eq('outlet_id', user.outletId)
      .eq('active', true),
  ])

  if (factsResult.error) throw new Error(`Cluster query failed: ${factsResult.error.message}`)

  const names = new Map((categoriesResult.data ?? []).map((row) => [row.category_id, row.name]))

  // Distinct feedbacks per category: one guest rating Service 1 is one guest,
  // however many rows the fact view holds for them.
  const seen = new Map<string, { feedbacks: Set<string>; followUps: Set<string> }>()

  for (const fact of factsResult.data ?? []) {
    if (!fact.category_id || !fact.feedback_id) continue
    const entry = seen.get(fact.category_id) ?? { feedbacks: new Set(), followUps: new Set() }
    entry.feedbacks.add(fact.feedback_id)
    if (fact.follow_up_requested) entry.followUps.add(fact.feedback_id)
    seen.set(fact.category_id, entry)
  }

  return [...seen.entries()].map(([categoryId, entry]) => ({
    categoryId,
    categoryName: names.get(categoryId) ?? 'Unknown',
    count: entry.feedbacks.size,
    followUpCount: entry.followUps.size,
  }))
}

export async function getInsights(range: DateRange, limit = 5): Promise<Insight[]> {
  const [config, categories, issues, negativeThemes, positiveThemes, clusters] = await Promise.all([
    getConfig(),
    getCategoryPerformance(range),
    getTopIssues(range, 'negative'),
    getThemeBreakdown(range, 'negative'),
    getThemeBreakdown(range, 'positive'),
    getLowRatingClusters(range),
  ])

  const generated = generateInsights(
    { categories, issues, themes: [...negativeThemes, ...positiveThemes], clusters },
    {
      thresholds: config.thresholds,
      from: range.from,
      to: range.to,
      periodLabel: comparisonLabel(range),
    },
  )

  return rankInsights(generated, limit)
}
