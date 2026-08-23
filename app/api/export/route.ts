import ExcelJS from 'exceljs'
import { PassThrough } from 'node:stream'
import { getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { maskPhone } from '@/lib/phone'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRange } from '@/lib/range'

/**
 * GET /api/export — the six-sheet workbook of §10, §39.
 *
 * Role-restricted per §11: OWNER and ADMIN get full phone numbers, MANAGER gets
 * masked ones, STAFF gets no export at all. The masking happens here rather
 * than being left to the query layer, because this is the one place a real
 * number is legitimately allowed to leave the building — and every export
 * writes an audit_log row saying who took it and what was in it.
 *
 * Streamed with ExcelJS's WorkbookWriter rather than buffered: a year of
 * feedback is a large workbook to hold in memory on a serverless function.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATE_FORMAT = 'dd-mmm-yyyy'

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser()
  if (!can(user, 'export:data')) {
    return new Response('Not permitted', { status: 403 })
  }

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const scope = params.scope === 'all' ? 'all' : 'current'
  const range = parseRange(params)

  // scope=all ignores the date filter; scope=current respects whatever the
  // admin was looking at when they clicked.
  const from = scope === 'all' ? '1970-01-01' : range.from
  const to = scope === 'all' ? '9999-12-31' : range.to

  const showFullPhone = can(user, 'export:full_phone')
  const client = await createClient()

  const [feedback, categories, ratings, issues, guests, followUps, daily] = await Promise.all([
    client
      .from('feedback')
      .select(
        'feedback_id, feedback_code, local_date, local_time, day_of_week, hour_bucket, overall_score, sentiment, comment, follow_up_requested, status, guest_id',
      )
      .eq('outlet_id', user!.outletId)
      .gte('local_date', from)
      .lte('local_date', to)
      .order('local_date', { ascending: false }),
    client
      .from('categories')
      .select('category_id, name, display_order')
      .eq('outlet_id', user!.outletId)
      .order('display_order'),
    client
      .from('v_rating_facts')
      .select('feedback_id, category_id, rating, local_date')
      .eq('outlet_id', user!.outletId)
      .gte('local_date', from)
      .lte('local_date', to),
    client
      .from('v_issue_daily')
      .select('issue_id, local_date, mention_count')
      .eq('outlet_id', user!.outletId)
      .gte('local_date', from)
      .lte('local_date', to),
    client.from('guests').select('*').eq('outlet_id', user!.outletId),
    client
      .from('v_follow_up_facts')
      .select(
        'follow_up_id, feedback_id, status, local_date, created_at, resolved_at, resolution_hours',
      )
      .eq('outlet_id', user!.outletId)
      .gte('local_date', from)
      .lte('local_date', to),
    client
      .from('v_feedback_daily')
      .select('*')
      .eq('outlet_id', user!.outletId)
      .gte('local_date', from)
      .lte('local_date', to)
      .order('local_date'),
  ])

  const { data: issueNames } = await client
    .from('issues')
    .select('issue_id, name, kind')
    .eq('outlet_id', user!.outletId)

  const categoryList = categories.data ?? []
  const issueNameById = new Map((issueNames ?? []).map((row) => [row.issue_id, row]))
  const guestById = new Map((guests.data ?? []).map((row) => [row.guest_id, row]))

  // feedback_id -> category_id -> rating
  const ratingLookup = new Map<string, Map<string, number>>()
  for (const row of ratings.data ?? []) {
    if (!row.feedback_id || !row.category_id || row.rating === null) continue
    const perFeedback = ratingLookup.get(row.feedback_id) ?? new Map<string, number>()
    perFeedback.set(row.category_id, row.rating)
    ratingLookup.set(row.feedback_id, perFeedback)
  }

  // §10 / §11: every export is recorded, including whether it carried real
  // phone numbers. Written BEFORE the bytes are produced and treated as fatal:
  // an export that cannot be logged must not happen, because "we can prove who
  // took the phone numbers" is the whole point of the requirement. Doing it
  // afterwards also meant a client that disconnected mid-download skipped it.
  const { error: auditError } = await createAdminClient()
    .from('audit_log')
    .insert({
      outlet_id: user!.outletId,
      user_id: user!.userId,
      action: 'EXPORT',
      entity: 'feedback',
      entity_id: `${from}..${to}`,
      after: {
        scope,
        from,
        to,
        rows: (feedback.data ?? []).length,
        full_phone_numbers: showFullPhone,
      } as never,
    })

  if (auditError) {
    console.error('[export] refused: could not write the audit record:', auditError.message)
    return new Response('Export could not be recorded, so it was not produced.', { status: 500 })
  }

  const stream = new PassThrough()
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true })
  workbook.creator = 'All India Café CXIS'

  const addSheet = (name: string, columns: Partial<ExcelJS.Column>[]) => {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    sheet.columns = columns
    sheet.getRow(1).font = { bold: true }
    return sheet
  }

  // --- 1. Feedback ----------------------------------------------------------
  const feedbackSheet = addSheet('Feedback', [
    { header: 'Code', key: 'code', width: 22 },
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Time', key: 'time', width: 10 },
    { header: 'Hour bucket', key: 'bucket', width: 13 },
    { header: 'Guest', key: 'guest', width: 20 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Overall', key: 'overall', width: 9 },
    { header: 'Sentiment', key: 'sentiment', width: 11 },
    ...categoryList.map((category) => ({
      header: category.name,
      key: `cat_${category.category_id}`,
      width: 13,
    })),
    { header: 'Follow-up', key: 'followUp', width: 11 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Comment', key: 'comment', width: 60 },
  ])

  for (const row of feedback.data ?? []) {
    const guest = row.guest_id ? guestById.get(row.guest_id) : undefined
    const perCategory = ratingLookup.get(row.feedback_id) ?? new Map()

    const record: Record<string, unknown> = {
      code: row.feedback_code,
      date: new Date(`${row.local_date}T00:00:00Z`),
      time: row.local_time,
      bucket: row.hour_bucket,
      guest: guest?.name ?? (row.guest_id ? (guest?.guest_code ?? '') : 'Anonymous'),
      phone: guest?.phone ? (showFullPhone ? guest.phone : maskPhone(guest.phone)) : '',
      overall: row.overall_score === null ? '' : Number(row.overall_score),
      sentiment: row.sentiment ?? '',
      followUp: row.follow_up_requested ? 'Yes' : 'No',
      status: row.status,
      // Verbatim, never an excerpt: the export is the record (§14.10).
      comment: row.comment ?? '',
    }
    for (const category of categoryList) {
      record[`cat_${category.category_id}`] = perCategory.get(category.category_id) ?? ''
    }
    feedbackSheet.addRow(record).commit()
  }
  feedbackSheet.commit()

  // --- 2. Guests ------------------------------------------------------------
  const guestSheet = addSheet('Guests', [
    { header: 'Guest code', key: 'code', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Visits', key: 'visits', width: 9 },
    { header: 'Average', key: 'average', width: 10 },
    { header: 'First visit', key: 'first', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Last visit', key: 'last', width: 14, style: { numFmt: DATE_FORMAT } },
  ])
  for (const guest of guests.data ?? []) {
    guestSheet
      .addRow({
        code: guest.guest_code,
        name: guest.name ?? '',
        phone: guest.phone ? (showFullPhone ? guest.phone : maskPhone(guest.phone)) : '',
        visits: guest.total_feedbacks,
        average: guest.average_rating === null ? '' : Number(guest.average_rating),
        first: guest.first_feedback_date ? new Date(`${guest.first_feedback_date}T00:00:00Z`) : '',
        last: guest.last_feedback_date ? new Date(`${guest.last_feedback_date}T00:00:00Z`) : '',
      })
      .commit()
  }
  guestSheet.commit()

  // --- 3. Ratings Summary (per category per day) ----------------------------
  const summarySheet = addSheet('Ratings Summary', [
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Ratings', key: 'count', width: 10 },
    { header: 'Average', key: 'average', width: 10 },
    { header: 'Positive', key: 'positive', width: 10 },
    { header: 'Neutral', key: 'neutral', width: 10 },
    { header: 'Negative', key: 'negative', width: 10 },
  ])
  const perDayCategory = new Map<
    string,
    { total: number; count: number; pos: number; neu: number; neg: number }
  >()
  for (const fact of ratings.data ?? []) {
    if (!fact.local_date || !fact.category_id || fact.rating === null) continue
    const key = `${fact.local_date}|${fact.category_id}`
    const entry = perDayCategory.get(key) ?? { total: 0, count: 0, pos: 0, neu: 0, neg: 0 }
    entry.total += fact.rating
    entry.count += 1
    if (fact.rating >= 4) entry.pos += 1
    else if (fact.rating === 3) entry.neu += 1
    else entry.neg += 1
    perDayCategory.set(key, entry)
  }
  const categoryNameById = new Map(categoryList.map((c) => [c.category_id, c.name]))
  for (const [key, entry] of [...perDayCategory.entries()].sort()) {
    const [date, categoryId] = key.split('|')
    summarySheet
      .addRow({
        date: new Date(`${date}T00:00:00Z`),
        category: categoryNameById.get(categoryId ?? '') ?? '',
        count: entry.count,
        average: Math.round((entry.total / entry.count) * 100) / 100,
        positive: entry.pos,
        neutral: entry.neu,
        negative: entry.neg,
      })
      .commit()
  }
  summarySheet.commit()

  // --- 4. Issues ------------------------------------------------------------
  const issueSheet = addSheet('Issues', [
    { header: 'Issue', key: 'issue', width: 22 },
    { header: 'Kind', key: 'kind', width: 12 },
    { header: 'Mentions', key: 'mentions', width: 11 },
  ])
  const issueTotals = new Map<string, number>()
  for (const row of issues.data ?? []) {
    if (!row.issue_id) continue
    issueTotals.set(
      row.issue_id,
      (issueTotals.get(row.issue_id) ?? 0) + Number(row.mention_count ?? 0),
    )
  }
  for (const [issueId, mentions] of [...issueTotals.entries()].sort((a, b) => b[1] - a[1])) {
    const issue = issueNameById.get(issueId)
    issueSheet.addRow({ issue: issue?.name ?? '', kind: issue?.kind ?? '', mentions }).commit()
  }
  issueSheet.commit()

  // --- 5. Follow-ups --------------------------------------------------------
  const followUpSheet = addSheet('Follow-ups', [
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Opened', key: 'opened', width: 20 },
    { header: 'Resolved', key: 'resolved', width: 20 },
    { header: 'Hours to resolve', key: 'hours', width: 16 },
  ])
  for (const row of followUps.data ?? []) {
    followUpSheet
      .addRow({
        date: row.local_date ? new Date(`${row.local_date}T00:00:00Z`) : '',
        status: row.status ?? '',
        opened: row.created_at ?? '',
        resolved: row.resolved_at ?? '',
        // Blank, not zero, while still open — a backlog must not read as speed.
        hours: row.resolution_hours === null ? '' : Number(row.resolution_hours),
      })
      .commit()
  }
  followUpSheet.commit()

  // --- 6. Daily Summary -----------------------------------------------------
  const dailySheet = addSheet('Daily Summary', [
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Feedbacks', key: 'count', width: 11 },
    { header: 'Average', key: 'average', width: 10 },
    { header: 'Positive', key: 'positive', width: 10 },
    { header: 'Neutral', key: 'neutral', width: 10 },
    { header: 'Negative', key: 'negative', width: 10 },
    { header: 'Follow-ups', key: 'followUps', width: 12 },
    { header: 'With comment', key: 'comments', width: 13 },
  ])
  for (const row of daily.data ?? []) {
    dailySheet
      .addRow({
        date: row.local_date ? new Date(`${row.local_date}T00:00:00Z`) : '',
        count: row.feedback_count ?? 0,
        average: row.avg_score === null ? '' : Number(row.avg_score),
        positive: row.positive_count ?? 0,
        neutral: row.neutral_count ?? 0,
        negative: row.negative_count ?? 0,
        followUps: row.follow_up_count ?? 0,
        comments: row.comment_count ?? 0,
      })
      .commit()
  }
  dailySheet.commit()

  await workbook.commit()

  const filename = `AIC-Feedback-${from}-to-${to}.xlsx`

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
