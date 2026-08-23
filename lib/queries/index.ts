import 'server-only'

import { compareOverRange, resolvePeriods } from '@/lib/analytics/comparison'
import { getCurrentUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import type { DateRange } from '@/lib/range'
import type {
  CategoryPerformance,
  CategoryStatus,
  IssueCount,
  Kpis,
  ThemeCount,
  TodaySnapshot,
  TrendPoint,
} from './types'

/**
 * Typed, comparison-enriched data access (§21).
 *
 * Two rules:
 *
 * 1. Aggregation happens in Postgres. These functions read the 0004 views and
 *    do arithmetic on already-grouped rows; they never pull raw feedback into
 *    Node to count it.
 * 2. Everything goes through the RLS-bound server client, never the service
 *    role. A MANAGER querying the dashboard gets exactly the rows their
 *    policies allow — the analytics layer is not a hole in §8.
 */

async function db() {
  return createClient()
}

async function outletId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in')
  return user.outletId
}

type DailyRow = {
  local_date: string
  feedback_count: number
  avg_score: number | null
  positive_count: number
  neutral_count: number
  negative_count: number
  follow_up_count: number
  comment_count: number
  identified_guest_count: number
}

async function dailyRows(range: DateRange): Promise<DailyRow[]> {
  const client = await db()
  const { data, error } = await client
    .from('v_feedback_daily')
    .select(
      'local_date, feedback_count, avg_score, positive_count, neutral_count, negative_count, follow_up_count, comment_count, identified_guest_count',
    )
    .eq('outlet_id', await outletId())
    .gte('local_date', range.from)
    .lte('local_date', range.to)
    .order('local_date')

  if (error) throw new Error(`Daily rollup failed: ${error.message}`)
  return (data ?? []) as DailyRow[]
}

/** Weighted totals for a window. Averages are weighted by count, not by day. */
function summarise(rows: DailyRow[]) {
  const feedbackCount = rows.reduce((sum, row) => sum + row.feedback_count, 0)
  const positive = rows.reduce((sum, row) => sum + row.positive_count, 0)
  const negative = rows.reduce((sum, row) => sum + row.negative_count, 0)
  const followUps = rows.reduce((sum, row) => sum + row.follow_up_count, 0)

  // A plain mean of daily averages would let a quiet Tuesday with two 5s
  // outweigh a busy Saturday with forty 3s.
  const scored = rows.filter((row) => row.avg_score !== null)
  const weightedTotal = scored.reduce(
    (sum, row) => sum + Number(row.avg_score) * row.feedback_count,
    0,
  )
  const scoredCount = scored.reduce((sum, row) => sum + row.feedback_count, 0)

  const pct = (part: number) =>
    feedbackCount === 0 ? null : Math.round((part / feedbackCount) * 1000) / 10

  return {
    feedbackCount,
    avgScore: scoredCount === 0 ? null : Math.round((weightedTotal / scoredCount) * 100) / 100,
    positivePct: pct(positive),
    negativePct: pct(negative),
    negativeCount: negative,
    complaintRate: pct(negative),
    followUpRate: pct(followUps),
    followUps,
  }
}

/** Headline KPIs for the range, each against its previous period (§20, §36). */
export async function getKpis(range: DateRange): Promise<Kpis> {
  const { current, previous } = resolvePeriods(range)
  const [currentRows, previousRows, categories] = await Promise.all([
    dailyRows(current),
    dailyRows(previous),
    getCategoryPerformance(range),
  ])

  const now = summarise(currentRows)
  const before = summarise(previousRows)

  return {
    overall: compareOverRange(now.avgScore, before.avgScore, range),
    feedbackCount: compareOverRange(now.feedbackCount, before.feedbackCount, range),
    positivePct: compareOverRange(now.positivePct, before.positivePct, range),
    negativePct: compareOverRange(now.negativePct, before.negativePct, range),
    complaintRate: compareOverRange(now.complaintRate, before.complaintRate, range),
    followUpRate: compareOverRange(now.followUpRate, before.followUpRate, range),
    categories,
  }
}

type CategoryRow = {
  category_id: string
  rating_count: number
  avg_rating: number | null
  negative_count: number
}

async function categoryRows(range: DateRange): Promise<CategoryRow[]> {
  const client = await db()
  const { data, error } = await client
    .from('v_category_daily')
    .select('category_id, rating_count, avg_rating, negative_count')
    .eq('outlet_id', await outletId())
    .gte('local_date', range.from)
    .lte('local_date', range.to)

  if (error) throw new Error(`Category rollup failed: ${error.message}`)
  return (data ?? []) as CategoryRow[]
}

function foldCategories(rows: CategoryRow[]) {
  const byCategory = new Map<string, { total: number; count: number; negative: number }>()

  for (const row of rows) {
    const entry = byCategory.get(row.category_id) ?? { total: 0, count: 0, negative: 0 }
    entry.total += Number(row.avg_rating ?? 0) * row.rating_count
    entry.count += row.rating_count
    entry.negative += row.negative_count
    byCategory.set(row.category_id, entry)
  }

  return byCategory
}

/** Per-category score, trend and status against the configurable thresholds (§24). */
export async function getCategoryPerformance(range: DateRange): Promise<CategoryPerformance[]> {
  const { current, previous } = resolvePeriods(range)
  const client = await db()

  const [currentRows, previousRows, config, categoriesResult] = await Promise.all([
    categoryRows(current),
    categoryRows(previous),
    getConfig(),
    client
      .from('categories')
      .select('category_id, name, icon, display_order')
      .eq('outlet_id', await outletId())
      .eq('active', true)
      .order('display_order'),
  ])

  if (categoriesResult.error) {
    throw new Error(`Could not load categories: ${categoriesResult.error.message}`)
  }

  const now = foldCategories(currentRows)
  const before = foldCategories(previousRows)

  return (categoriesResult.data ?? []).map((category) => {
    const currentEntry = now.get(category.category_id)
    const previousEntry = before.get(category.category_id)

    const score =
      currentEntry && currentEntry.count > 0
        ? Math.round((currentEntry.total / currentEntry.count) * 100) / 100
        : null
    const previousScore =
      previousEntry && previousEntry.count > 0
        ? Math.round((previousEntry.total / previousEntry.count) * 100) / 100
        : null

    let status: CategoryStatus = 'watch'
    if (score !== null) {
      if (score >= config.thresholds.category_strong) status = 'strong'
      else if (score < config.thresholds.category_attention) status = 'attention'
    }

    return {
      categoryId: category.category_id,
      name: category.name,
      icon: category.icon,
      score: compareOverRange(score, previousScore, range),
      ratingCount: currentEntry?.count ?? 0,
      negativeCount: currentEntry?.negative ?? 0,
      status,
    }
  })
}

/**
 * Daily satisfaction trend (§25).
 *
 * Days with no feedback come back as `value: null`, not 0 — the chart must show
 * a gap. Interpolating a closed Monday into the line would invent data.
 */
export async function getTrend(range: DateRange): Promise<TrendPoint[]> {
  const rows = await dailyRows(range)
  const byDate = new Map(rows.map((row) => [row.local_date, row]))

  return eachDay(range).map((date) => {
    const row = byDate.get(date)
    return {
      date,
      value: row?.avg_score === null || row?.avg_score === undefined ? null : Number(row.avg_score),
      count: row?.feedback_count ?? 0,
    }
  })
}

/**
 * One trend series per category (§25).
 *
 * Same gap rule as getTrend: a category with no ratings on a given day is null,
 * never zero, so the line breaks instead of implying the café scored nothing.
 */
export async function getCategoryTrends(
  range: DateRange,
): Promise<{ categoryId: string; name: string; points: TrendPoint[] }[]> {
  const client = await db()
  const outlet = await outletId()

  const [rowsResult, categoriesResult] = await Promise.all([
    client
      .from('v_category_daily')
      .select('local_date, category_id, avg_rating, rating_count')
      .eq('outlet_id', outlet)
      .gte('local_date', range.from)
      .lte('local_date', range.to),
    client
      .from('categories')
      .select('category_id, name, display_order')
      .eq('outlet_id', outlet)
      .eq('active', true)
      .order('display_order'),
  ])

  if (rowsResult.error) throw new Error(`Category trend failed: ${rowsResult.error.message}`)

  const byCategory = new Map<string, Map<string, { value: number | null; count: number }>>()
  for (const row of rowsResult.data ?? []) {
    if (!row.category_id || !row.local_date) continue
    const series = byCategory.get(row.category_id) ?? new Map()
    series.set(row.local_date, {
      value: row.avg_rating === null ? null : Number(row.avg_rating),
      count: row.rating_count ?? 0,
    })
    byCategory.set(row.category_id, series)
  }

  const days = eachDay(range)

  return (categoriesResult.data ?? []).map((category) => {
    const series = byCategory.get(category.category_id)
    return {
      categoryId: category.category_id,
      name: category.name,
      points: days.map((date) => ({
        date,
        value: series?.get(date)?.value ?? null,
        count: series?.get(date)?.count ?? 0,
      })),
    }
  })
}

/** Every Kolkata calendar date in the range, inclusive. */
function eachDay(range: DateRange): string[] {
  const days: string[] = []
  const cursor = new Date(`${range.from}T00:00:00Z`)
  const end = new Date(`${range.to}T00:00:00Z`)
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

async function issueRows(range: DateRange): Promise<{ issue_id: string; mention_count: number }[]> {
  const client = await db()
  const { data, error } = await client
    .from('v_issue_daily')
    .select('issue_id, mention_count')
    .eq('outlet_id', await outletId())
    .gte('local_date', range.from)
    .lte('local_date', range.to)

  if (error) throw new Error(`Issue rollup failed: ${error.message}`)
  return (data ?? []) as { issue_id: string; mention_count: number }[]
}

/** Top areas of improvement, ranked, with period-over-period change (§25). */
export async function getTopIssues(
  range: DateRange,
  kind: 'negative' | 'positive' = 'negative',
): Promise<IssueCount[]> {
  const { current, previous } = resolvePeriods(range)
  const client = await db()

  const [currentRows, previousRows, issuesResult] = await Promise.all([
    issueRows(current),
    issueRows(previous),
    client
      .from('issues')
      .select('issue_id, name, kind')
      .eq('outlet_id', await outletId())
      .eq('kind', kind),
  ])

  if (issuesResult.error) throw new Error(`Could not load issues: ${issuesResult.error.message}`)

  const tally = (rows: { issue_id: string; mention_count: number }[]) => {
    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.issue_id, (map.get(row.issue_id) ?? 0) + Number(row.mention_count))
    }
    return map
  }

  const now = tally(currentRows)
  const before = tally(previousRows)

  return (issuesResult.data ?? [])
    .map((issue) => ({
      issueId: issue.issue_id,
      name: issue.name,
      kind,
      mentions: compareOverRange(
        now.get(issue.issue_id) ?? 0,
        before.get(issue.issue_id) ?? 0,
        range,
      ),
    }))
    .sort((a, b) => (b.mentions.value ?? 0) - (a.mentions.value ?? 0))
}

/** Comment themes for the range, ranked (§26). */
export async function getThemeBreakdown(
  range: DateRange,
  kind: 'negative' | 'positive',
): Promise<ThemeCount[]> {
  const { current, previous } = resolvePeriods(range)
  const client = await db()
  const outlet = await outletId()

  const fetchThemes = async (window: DateRange) => {
    const { data, error } = await client
      .from('v_theme_daily')
      .select('theme_id, feedback_count, mention_count')
      .eq('outlet_id', outlet)
      .gte('local_date', window.from)
      .lte('local_date', window.to)

    if (error) throw new Error(`Theme rollup failed: ${error.message}`)
    return (data ?? []) as { theme_id: string; feedback_count: number; mention_count: number }[]
  }

  const [currentRows, previousRows, themesResult] = await Promise.all([
    fetchThemes(current),
    fetchThemes(previous),
    client
      .from('themes')
      .select('theme_id, name, kind')
      .eq('outlet_id', outlet)
      .eq('kind', kind)
      .eq('active', true),
  ])

  if (themesResult.error) throw new Error(`Could not load themes: ${themesResult.error.message}`)

  const tally = (rows: { theme_id: string; feedback_count: number; mention_count: number }[]) => {
    const map = new Map<string, { feedbacks: number; mentions: number }>()
    for (const row of rows) {
      const entry = map.get(row.theme_id) ?? { feedbacks: 0, mentions: 0 }
      entry.feedbacks += Number(row.feedback_count)
      entry.mentions += Number(row.mention_count)
      map.set(row.theme_id, entry)
    }
    return map
  }

  const now = tally(currentRows)
  const before = tally(previousRows)

  return (themesResult.data ?? [])
    .map((theme) => ({
      themeId: theme.theme_id,
      name: theme.name,
      kind,
      feedbackCount: now.get(theme.theme_id)?.feedbacks ?? 0,
      mentions: compareOverRange(
        now.get(theme.theme_id)?.mentions ?? 0,
        before.get(theme.theme_id)?.mentions ?? 0,
        range,
      ),
    }))
    .filter((theme) => (theme.mentions.value ?? 0) > 0)
    .sort((a, b) => (b.mentions.value ?? 0) - (a.mentions.value ?? 0))
}

/** The snapshot strip on Today at a Glance (§32). */
export async function getTodaySnapshot(range: DateRange): Promise<TodaySnapshot> {
  const { current, previous } = resolvePeriods(range)
  const [currentRows, previousRows] = await Promise.all([dailyRows(current), dailyRows(previous)])

  const now = summarise(currentRows)
  const before = summarise(previousRows)

  return {
    feedbackCount: compareOverRange(now.feedbackCount, before.feedbackCount, range),
    avgExperience: compareOverRange(now.avgScore, before.avgScore, range),
    positivePct: compareOverRange(now.positivePct, before.positivePct, range),
    negativeCount: compareOverRange(now.negativeCount, before.negativeCount, range),
    followUpsRequired: compareOverRange(now.followUps, before.followUps, range),
  }
}

export * from './types'
export { getFeedbackDetail, getFeedbackList } from './feedback'
export { getGuestList, getGuestProfile } from './guests'
