import 'server-only'

import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { GuestFilterKey, GuestListItem, GuestProfile, Paged, Pagination } from './types'

/**
 * Guest database and profile (§29–§31).
 *
 * Everything reads `guests_visible`, so the phone number is masked before it
 * leaves Postgres. The unmasked value is only ever produced by
 * aic_reveal_phone(), which checks the role and writes an audit_log row (§11).
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

function toListItem(row: SummaryRow, phoneMasked: string | null): GuestListItem {
  return {
    guestId: row.guest_id,
    guestCode: row.guest_code,
    name: row.name,
    phoneMasked,
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
): Promise<Paged<GuestListItem>> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in')

  const client = await createClient()
  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(200, Math.max(1, pagination.pageSize))

  let query = client
    .from('v_guest_summary')
    .select('*', { count: 'exact' })
    .eq('outlet_id', user.outletId)

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
  const masked = await maskedPhones(rowsData.map((row) => row.guest_id))

  const items = rowsData.map((row) => toListItem(row, masked.get(row.guest_id) ?? null))
  const total = count ?? items.length

  return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) }
}

async function maskedPhones(guestIds: string[]): Promise<Map<string, string | null>> {
  if (guestIds.length === 0) return new Map()
  const client = await createClient()
  const { data } = await client
    .from('guests_visible')
    .select('guest_id, phone_masked')
    .in('guest_id', guestIds)

  // View columns are reported nullable by the type generator because Postgres
  // cannot prove otherwise; guest_id is the view's key and never actually null.
  const pairs: [string, string | null][] = []
  for (const row of data ?? []) {
    if (row.guest_id) pairs.push([row.guest_id, row.phone_masked])
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
  const masked = await maskedPhones([guestId])

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
    ...toListItem(summary, masked.get(guestId) ?? null),
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
