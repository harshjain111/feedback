import 'server-only'

import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { FeedbackDetail, FeedbackFilters, FeedbackListItem, Paged, Pagination } from './types'

/**
 * The feedback list and detail (§28, §29).
 *
 * Phone numbers are masked at the QUERY layer, not in the component: the list
 * reads guests through `guests_visible`, so a masked value is the only thing
 * that ever reaches the server component. §11 and Prompt 42 both require this —
 * masking in JSX would still put the real number in the RSC payload.
 */

const EXCERPT_LENGTH = 140

function excerpt(comment: string | null): string | null {
  if (!comment) return null
  const flat = comment.replace(/\s+/g, ' ').trim()
  return flat.length <= EXCERPT_LENGTH ? flat : `${flat.slice(0, EXCERPT_LENGTH - 1)}…`
}

type RawFeedback = {
  feedback_id: string
  feedback_code: string
  submitted_at: string
  local_date: string
  local_time: string
  overall_score: number | null
  sentiment: string | null
  comment: string | null
  follow_up_requested: boolean
  status: string
  guest_id: string | null
}

function toSentiment(value: string | null): FeedbackListItem['sentiment'] {
  return value === 'positive' || value === 'neutral' || value === 'negative' ? value : null
}

async function decorate(
  rawRows: RawFeedback[],
): Promise<Omit<FeedbackListItem, 'commentExcerpt'>[] & { comment?: never }> {
  const client = await createClient()
  const ids = rawRows.map((row) => row.feedback_id)
  if (ids.length === 0) return []

  const [ratings, issues, guests] = await Promise.all([
    client
      .from('feedback_ratings')
      .select('feedback_id, rating, categories(category_id, name, display_order)')
      .in('feedback_id', ids),
    client.from('feedback_issues').select('feedback_id, issues(name)').in('feedback_id', ids),
    client
      .from('guests_visible')
      .select('guest_id, name, phone_masked')
      .in(
        'guest_id',
        rawRows.map((row) => row.guest_id).filter((id): id is string => Boolean(id)),
      ),
  ])

  const ratingsBy = new Map<string, { categoryId: string; name: string; rating: number }[]>()
  for (const row of ratings.data ?? []) {
    const category = row.categories as unknown as {
      category_id: string
      name: string
      display_order: number
    } | null
    if (!category) continue
    const list = ratingsBy.get(row.feedback_id) ?? []
    list.push({ categoryId: category.category_id, name: category.name, rating: row.rating })
    ratingsBy.set(row.feedback_id, list)
  }

  const issuesBy = new Map<string, string[]>()
  for (const row of issues.data ?? []) {
    const issue = row.issues as unknown as { name: string } | null
    if (!issue) continue
    const list = issuesBy.get(row.feedback_id) ?? []
    list.push(issue.name)
    issuesBy.set(row.feedback_id, list)
  }

  const guestsBy = new Map((guests.data ?? []).map((guest) => [guest.guest_id, guest] as const))

  return rawRows.map((row) => {
    const guest = row.guest_id ? guestsBy.get(row.guest_id) : undefined
    return {
      feedbackId: row.feedback_id,
      feedbackCode: row.feedback_code,
      submittedAt: row.submitted_at,
      localDate: row.local_date,
      localTime: row.local_time,
      guestName: guest?.name ?? null,
      guestPhoneMasked: guest?.phone_masked ?? null,
      overallScore: row.overall_score === null ? null : Number(row.overall_score),
      sentiment: toSentiment(row.sentiment),
      ratings: (ratingsBy.get(row.feedback_id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      issues: issuesBy.get(row.feedback_id) ?? [],
      followUpRequested: row.follow_up_requested,
      status: row.status,
    }
  })
}

const SELECT =
  'feedback_id, feedback_code, submitted_at, local_date, local_time, overall_score, sentiment, comment, follow_up_requested, status, guest_id'

/** Paginated, filtered feedback list. Every filter maps to a URL param (§29). */
export async function getFeedbackList(
  filters: FeedbackFilters,
  pagination: Pagination,
): Promise<Paged<FeedbackListItem>> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in')

  const client = await createClient()
  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(200, Math.max(1, pagination.pageSize))

  let query = client
    .from('feedback')
    .select(SELECT, { count: 'exact' })
    .eq('outlet_id', user.outletId)
    .gte('local_date', filters.from)
    .lte('local_date', filters.to)

  if (filters.ratingBand) query = query.eq('sentiment', filters.ratingBand)
  if (filters.followUpRequested !== undefined) {
    query = query.eq('follow_up_requested', filters.followUpRequested)
  }
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.hasComment === true) query = query.not('comment', 'is', null)
  if (filters.hasComment === false) query = query.is('comment', null)
  if (filters.guestType === 'identified') query = query.not('guest_id', 'is', null)
  if (filters.guestType === 'anonymous') query = query.is('guest_id', null)
  if (filters.search) query = query.ilike('comment', `%${filters.search}%`)

  // Category, issue and theme filters are membership questions, so they are
  // resolved to a feedback_id set first rather than joined into the page query.
  const restrict = await restrictingIds(filters)
  if (restrict !== null) {
    if (restrict.length === 0) {
      return { items: [], total: 0, page, pageSize, pageCount: 0 }
    }
    query = query.in('feedback_id', restrict)
  }

  const { data, error, count } = await query
    .order('submitted_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) throw new Error(`Feedback list failed: ${error.message}`)

  const decorated = await decorate((data ?? []) as RawFeedback[])
  const items: FeedbackListItem[] = decorated.map((item, index) => ({
    ...item,
    commentExcerpt: excerpt((data ?? [])[index]?.comment ?? null),
  }))

  const total = count ?? items.length
  return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) }
}

/** Resolve category/issue/theme filters to a feedback_id set, or null if unused. */
async function restrictingIds(filters: FeedbackFilters): Promise<string[] | null> {
  const client = await createClient()
  const sets: string[][] = []

  if (filters.categoryId) {
    const { data } = await client
      .from('feedback_ratings')
      .select('feedback_id')
      .eq('category_id', filters.categoryId)
    sets.push((data ?? []).map((row) => row.feedback_id))
  }

  if (filters.issueId) {
    const { data } = await client
      .from('feedback_issues')
      .select('feedback_id')
      .eq('issue_id', filters.issueId)
    sets.push((data ?? []).map((row) => row.feedback_id))
  }

  if (filters.themeId) {
    const { data } = await client
      .from('feedback_themes')
      .select('feedback_id')
      .eq('theme_id', filters.themeId)
    sets.push((data ?? []).map((row) => row.feedback_id))
  }

  if (sets.length === 0) return null

  // Intersection: filters combine with AND, as the UI implies.
  return sets.reduce((accumulator, set) => accumulator.filter((id) => set.includes(id)))
}

/** One feedback with its full comment and follow-up thread (§28, §30). */
export async function getFeedbackDetail(feedbackId: string): Promise<FeedbackDetail | null> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not signed in')

  const client = await createClient()
  const { data, error } = await client
    .from('feedback')
    .select(SELECT)
    .eq('outlet_id', user.outletId)
    .eq('feedback_id', feedbackId)
    .maybeSingle()

  if (error) throw new Error(`Feedback detail failed: ${error.message}`)
  if (!data) return null

  const raw = data as RawFeedback
  const [base] = await decorate([raw])
  if (!base) return null

  const [guestResult, followUpResult] = await Promise.all([
    raw.guest_id
      ? client
          .from('guests_visible')
          .select('guest_id, guest_code')
          .eq('guest_id', raw.guest_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from('follow_ups')
      .select('follow_up_id, status, assigned_to, resolution, created_at, resolved_at')
      .eq('feedback_id', feedbackId)
      .maybeSingle(),
  ])

  let followUp: FeedbackDetail['followUp'] = null
  if (followUpResult.data) {
    const record = followUpResult.data
    const [notesResult, assigneeResult] = await Promise.all([
      client
        .from('follow_up_notes')
        .select('note_id, body, created_at, author_id')
        .eq('follow_up_id', record.follow_up_id)
        .order('created_at'),
      record.assigned_to
        ? client.from('app_users').select('name').eq('user_id', record.assigned_to).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const authorIds = [
      ...new Set((notesResult.data ?? []).map((note) => note.author_id).filter(Boolean)),
    ] as string[]
    const authorsResult = authorIds.length
      ? await client.from('app_users').select('user_id, name').in('user_id', authorIds)
      : { data: [] }
    const authors = new Map((authorsResult.data ?? []).map((row) => [row.user_id, row.name]))

    followUp = {
      followUpId: record.follow_up_id,
      status: record.status,
      assignedTo: record.assigned_to,
      assignedToName: assigneeResult.data?.name ?? null,
      resolution: record.resolution,
      createdAt: record.created_at,
      resolvedAt: record.resolved_at,
      notes: (notesResult.data ?? []).map((note) => ({
        noteId: note.note_id,
        authorName: note.author_id ? (authors.get(note.author_id) ?? null) : null,
        body: note.body,
        createdAt: note.created_at,
      })),
    }
  }

  return {
    ...base,
    commentExcerpt: excerpt(raw.comment),
    // The detail view shows the guest's own words in full, never the excerpt.
    comment: raw.comment,
    guestId: raw.guest_id,
    guestCode: guestResult.data?.guest_code ?? null,
    followUp,
  }
}
