import 'server-only'

import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { GuestFilterKey, GuestListItem, GuestProfile, Paged, Pagination } from './types'

/**
 * Guest database and profile (§29–§31).
 *
 * Everything reads `guests_visible`, which decides per role what a phone number
 * looks like: the real thing for OWNER/ADMIN/MANAGER, NULL for STAFF, who get
 * only the masked form (0021, §11). aic_reveal_phone() is untouched and remains
 * the audited path — and the only route STAFF have to a number at all.
 */

type SummaryRow = {
  guest_id: string
  guest_code: string
  name: string | null
  total_feedbacks: number
  average_rating: number | null
  first_feedback_date: string | null
  last_feedback_date: string | null
  has_phone: boolean
  is_repeat: boolean
  is_negative: boolean
  is_high_engagement: boolean
  has_open_follow_up: boolean
}

type Phones = { masked: string | null; real: string | null }

function toListItem(row: SummaryRow, phones: Phones): GuestListItem {
  return {
    guestId: row.guest_id,
    guestCode: row.guest_code,
    name: row.name,
    phoneMasked: phones.masked,
    phone: phones.real,
    totalFeedbacks: row.total_feedbacks,
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    lastFeedbackDate: row.last_feedback_date,
    isRepeat: row.is_repeat,
    isNegative: row.is_negative,
    isHighEngagement: row.is_high_engagement,
    hasOpenFollowUp: row.has_open_follow_up,
  }
}

/**
 * The §32 filters, defined once here rather than re-expressed per call site.
 *
 *   New            — exactly one visit so far
 *   Repeat         — more than one
 *   Negative       — average at or below 2.5
 *   Follow-up      — has a follow-up that is not CLOSED
 *   High engagement— three visits or more
 */
export async function getGuestList(
  filter: GuestFilterKey,
  pagination: Pagination,
  search?: string,
  range?: { from: string; to: string },
): Promise<Paged<GuestListItem>> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in')

  const client = await createClient()
  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(200, Math.max(1, pagination.pageSize))

  /*
   * The date window, which this list used to ignore completely.
   *
   * The header range control sits in the admin layout, so it renders on this
   * page too — and it did nothing here. Picking "Today" left all 209 guests on
   * screen with "last seen" dates from days earlier, which reads as broken data
   * rather than an unwired filter.
   *
   * Scoped on FEEDBACK rows in the window rather than on the summary's
   * last_feedback_date: a guest who came yesterday and again today has a
   * last_feedback_date of today, and filtering on it would drop them from
   * "Yesterday" even though that is exactly when they visited.
   *
   * The cost is one extra round trip and an id list in the query string. At this
   * outlet's volume (~200 guests a month) that is nothing; if a range ever
   * returns several thousand guests the URL will outgrow PostgREST's limit and
   * this needs to become an RPC that does the join in Postgres.
   */
  let guestIdsInRange: string[] | null = null
  if (range) {
    const { data: visited } = await client
      .from('feedback')
      .select('guest_id')
      .eq('outlet_id', user.outletId)
      .gte('local_date', range.from)
      .lte('local_date', range.to)
      .not('guest_id', 'is', null)

    guestIdsInRange = [
      ...new Set((visited ?? []).map((row) => row.guest_id).filter((id): id is string => !!id)),
    ]

    // An empty `.in()` is not a filter PostgREST can express, and sending one
    // would quietly return everything — the bug this is here to fix.
    if (guestIdsInRange.length === 0) {
      return { items: [], total: 0, page, pageSize, pageCount: 0 }
    }
  }

  let query = client
    .from('v_guest_summary')
    .select('*', { count: 'exact' })
    .eq('outlet_id', user.outletId)

  if (guestIdsInRange) query = query.in('guest_id', guestIdsInRange)

  switch (filter) {
    case 'new':
      query = query.eq('total_feedbacks', 1)
      break
    case 'repeat':
      query = query.eq('is_repeat', true)
      break
    case 'negative':
      query = query.eq('is_negative', true)
      break
    case 'follow_up':
      query = query.eq('has_open_follow_up', true)
      break
    case 'high_engagement':
      query = query.eq('is_high_engagement', true)
      break
    case 'all':
      break
  }

  if (search && search.trim() !== '') {
    // Searching by phone is deliberately not offered here: the list only ever
    // holds a masked value, so a phone search would have to run against the raw
    // column and would leak existence. Guest code and name are enough.
    const term = search.trim()
    query = query.or(`name.ilike.%${term}%,guest_code.ilike.%${term}%`)
  }

  const { data, error, count } = await query
    .order('last_feedback_date', { ascending: false, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) throw new Error(`Guest list failed: ${error.message}`)

  const rowsData = (data ?? []) as unknown as SummaryRow[]
  const phones = await phonesFor(rowsData.map((row) => row.guest_id))

  const items = rowsData.map((row) => toListItem(row, phones.get(row.guest_id) ?? NO_PHONE))
  const total = count ?? items.length

  return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) }
}

const NO_PHONE: Phones = { masked: null, real: null }

async function phonesFor(guestIds: string[]): Promise<Map<string, Phones>> {
  if (guestIds.length === 0) return new Map()
  const client = await createClient()
  const { data } = await client
    .from('guests_visible')
    .select('guest_id, phone_masked, phone')
    .in('guest_id', guestIds)

  // View columns are reported nullable by the type generator because Postgres
  // cannot prove otherwise; guest_id is the view's key and never actually null.
  const pairs: [string, Phones][] = []
  for (const row of data ?? []) {
    if (row.guest_id) pairs.push([row.guest_id, { masked: row.phone_masked, real: row.phone }])
  }
  return new Map(pairs)
}

/** One guest with per-category averages and the full visit history (§30). */
export async function getGuestProfile(guestId: string): Promise<GuestProfile | null> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in')

  const client = await createClient()
  const { data, error } = await client
    .from('v_guest_summary')
    .select('*')
    .eq('outlet_id', user.outletId)
    .eq('guest_id', guestId)
    .maybeSingle()

  if (error) throw new Error(`Guest profile failed: ${error.message}`)
  if (!data) return null

  const summary = data as unknown as SummaryRow
  const phones = await phonesFor([guestId])

  const [factsResult, historyResult, categoriesResult] = await Promise.all([
    client.from('v_rating_facts').select('category_id, rating').eq('guest_id', guestId),
    client
      .from('feedback')
      .select('feedback_id, feedback_code, local_date, overall_score, comment')
      .eq('guest_id', guestId)
      .order('local_date', { ascending: false }),
    client
      .from('categories')
      .select('category_id, name, display_order')
      .eq('outlet_id', user.outletId)
      .order('display_order'),
  ])

  const totals = new Map<string, { total: number; count: number }>()
  for (const fact of factsResult.data ?? []) {
    if (!fact.category_id || fact.rating === null) continue
    const entry = totals.get(fact.category_id) ?? { total: 0, count: 0 }
    entry.total += fact.rating
    entry.count += 1
    totals.set(fact.category_id, entry)
  }

  const categoryAverages = (categoriesResult.data ?? []).map((category) => {
    const entry = totals.get(category.category_id)
    return {
      categoryId: category.category_id,
      name: category.name,
      average:
        entry && entry.count > 0 ? Math.round((entry.total / entry.count) * 100) / 100 : null,
    }
  })

  const historyRows = historyResult.data ?? []
  const perFeedback = new Map<string, { name: string; rating: number }[]>()
  if (historyRows.length > 0) {
    const { data: ratingRows } = await client
      .from('feedback_ratings')
      .select('feedback_id, rating, categories(name)')
      .in(
        'feedback_id',
        historyRows.map((row) => row.feedback_id),
      )

    for (const row of ratingRows ?? []) {
      const category = row.categories as unknown as { name: string } | null
      if (!category) continue
      const list = perFeedback.get(row.feedback_id) ?? []
      list.push({ name: category.name, rating: row.rating })
      perFeedback.set(row.feedback_id, list)
    }
  }

  return {
    ...toListItem(summary, phones.get(guestId) ?? NO_PHONE),
    firstFeedbackDate: summary.first_feedback_date,
    categoryAverages,
    history: historyRows.map((row) => ({
      feedbackId: row.feedback_id,
      feedbackCode: row.feedback_code,
      localDate: row.local_date,
      overallScore: row.overall_score === null ? null : Number(row.overall_score),
      comment: row.comment,
      ratings: perFeedback.get(row.feedback_id) ?? [],
    })),
  }
}
