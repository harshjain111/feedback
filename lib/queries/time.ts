import 'server-only'

import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { HOUR_BUCKETS, type HourBucket } from '@/lib/time'
import type { DateRange } from '@/lib/range'

// Pattern detection is pure and lives in the analytics layer; re-exported here
// so callers have one import for "time analysis".
export { significantGaps, type PatternGap, type PatternRow } from '@/lib/analytics/time-patterns'

/**
 * Time-of-day (§33) and day-of-week (§34) analysis.
 *
 * Both read the denormalised columns on `feedback` rather than deriving
 * anything from timestamps, so a query never has to touch UTC and the numbers
 * always agree with what the guest's clock said.
 *
 * Every row carries its own sample count. The UI refuses to call anything a
 * pattern below the configured minimum, because "Saturday service is worse" on
 * two Saturday ratings is a coin flip, not a finding.
 */

export type BucketBreakdown = {
  bucket: HourBucket
  label: string
  ratingCount: number
  average: number | null
  negativeCount: number
  byCategory: { categoryId: string; name: string; average: number | null; ratingCount: number }[]
}

export type DayBreakdown = {
  dayOfWeek: number
  label: string
  ratingCount: number
  average: number | null
  negativeCount: number
  byCategory: { categoryId: string; name: string; average: number | null; ratingCount: number }[]
}

const BUCKET_LABELS: Record<HourBucket, string> = {
  '12-15': '12 PM – 3 PM',
  '15-18': '3 PM – 6 PM',
  '18-21': '6 PM – 9 PM',
  '21-24': '9 PM – 12 AM',
  other: 'Outside service hours',
}

/** 0 = Sunday, matching Postgres EXTRACT(DOW) and lib/time.ts dayOfWeek(). */
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Fact = {
  category_id: string | null
  rating: number | null
  hour_bucket: string | null
  day_of_week: number | null
}

async function facts(range: DateRange): Promise<{ facts: Fact[]; names: Map<string, string> }> {
  const user = await getCurrentUser()
  if (!user) return { facts: [], names: new Map() }

  const client = await createClient()
  const [factsResult, categoriesResult] = await Promise.all([
    client
      .from('v_rating_facts')
      .select('category_id, rating, hour_bucket, day_of_week')
      .eq('outlet_id', user.outletId)
      .gte('local_date', range.from)
      .lte('local_date', range.to),
    client
      .from('categories')
      .select('category_id, name')
      .eq('outlet_id', user.outletId)
      .eq('active', true)
      .order('display_order'),
  ])

  if (factsResult.error) throw new Error(`Time analysis failed: ${factsResult.error.message}`)

  return {
    facts: (factsResult.data ?? []) as Fact[],
    names: new Map((categoriesResult.data ?? []).map((row) => [row.category_id, row.name])),
  }
}

type Tally = { total: number; count: number; negative: number }

function empty(): Tally {
  return { total: 0, count: 0, negative: 0 }
}

function mean(tally: Tally): number | null {
  return tally.count === 0 ? null : Math.round((tally.total / tally.count) * 100) / 100
}

function accumulate(tally: Tally, rating: number): void {
  tally.total += rating
  tally.count += 1
  if (rating <= 2) tally.negative += 1
}

function categoryRows(
  perCategory: Map<string, Tally>,
  names: Map<string, string>,
): { categoryId: string; name: string; average: number | null; ratingCount: number }[] {
  return [...perCategory.entries()].map(([categoryId, tally]) => ({
    categoryId,
    name: names.get(categoryId) ?? 'Unknown',
    average: mean(tally),
    ratingCount: tally.count,
  }))
}

export async function getHourBucketBreakdown(range: DateRange): Promise<BucketBreakdown[]> {
  const { facts: rows, names } = await facts(range)

  const totals = new Map<string, Tally>()
  const perBucketCategory = new Map<string, Map<string, Tally>>()

  for (const fact of rows) {
    if (fact.rating === null || !fact.hour_bucket) continue
    const tally = totals.get(fact.hour_bucket) ?? empty()
    accumulate(tally, fact.rating)
    totals.set(fact.hour_bucket, tally)

    if (fact.category_id) {
      const perCategory = perBucketCategory.get(fact.hour_bucket) ?? new Map<string, Tally>()
      const categoryTally = perCategory.get(fact.category_id) ?? empty()
      accumulate(categoryTally, fact.rating)
      perCategory.set(fact.category_id, categoryTally)
      perBucketCategory.set(fact.hour_bucket, perCategory)
    }
  }

  // Always return every bucket, in service order, so a quiet slot reads as
  // "no data" rather than silently vanishing from the table.
  return HOUR_BUCKETS.map((bucket) => {
    const tally = totals.get(bucket) ?? empty()
    return {
      bucket,
      label: BUCKET_LABELS[bucket],
      ratingCount: tally.count,
      average: mean(tally),
      negativeCount: tally.negative,
      byCategory: categoryRows(perBucketCategory.get(bucket) ?? new Map(), names),
    }
  })
}

export async function getDayOfWeekBreakdown(range: DateRange): Promise<DayBreakdown[]> {
  const { facts: rows, names } = await facts(range)

  const totals = new Map<number, Tally>()
  const perDayCategory = new Map<number, Map<string, Tally>>()

  for (const fact of rows) {
    if (fact.rating === null || fact.day_of_week === null) continue
    const tally = totals.get(fact.day_of_week) ?? empty()
    accumulate(tally, fact.rating)
    totals.set(fact.day_of_week, tally)

    if (fact.category_id) {
      const perCategory = perDayCategory.get(fact.day_of_week) ?? new Map<string, Tally>()
      const categoryTally = perCategory.get(fact.category_id) ?? empty()
      accumulate(categoryTally, fact.rating)
      perCategory.set(fact.category_id, categoryTally)
      perDayCategory.set(fact.day_of_week, perCategory)
    }
  }

  // Monday-first reads better for a business week than Sunday-first, even
  // though the stored value follows Postgres with 0 = Sunday.
  const order = [1, 2, 3, 4, 5, 6, 0]

  return order.map((dayOfWeek) => {
    const tally = totals.get(dayOfWeek) ?? empty()
    return {
      dayOfWeek,
      label: DAY_LABELS[dayOfWeek] ?? 'Unknown',
      ratingCount: tally.count,
      average: mean(tally),
      negativeCount: tally.negative,
      byCategory: categoryRows(perDayCategory.get(dayOfWeek) ?? new Map(), names),
    }
  })
}
