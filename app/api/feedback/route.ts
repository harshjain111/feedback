import { NextResponse } from 'next/server'
import { extractThemes } from '@/lib/analytics/themes'
import { getOutletId, getThemeLexicon } from '@/lib/config'
import { overallScore, ratingValues, sentimentFor } from '@/lib/journey'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowOfflineSeedFallback } from '@/lib/supabase/env'
import { localStamps, nowIST } from '@/lib/time'
import { combineComments, feedbackSubmissionSchema } from '@/lib/validation'

/**
 * POST /api/feedback — the one write the kiosk makes (CLAUDE.md §4, §7).
 *
 * Service role, server only: the kiosk is anonymous and RLS gives anon no write
 * anywhere, so this route is the only door in.
 *
 * Idempotent by construction. `submission_id` is minted once per journey and
 * carries a UNIQUE (outlet_id, submission_id) index, so a double-tap, an
 * offline retry (§43) or a back-button re-entry all resolve to the same row and
 * the same feedback_code — with a 200, never an error.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const parsed = feedbackSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid submission', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const submission = parsed.data

  const ratings = ratingValues(submission.ratings)
  if (ratings.length === 0) {
    return NextResponse.json({ error: 'No ratings in submission' }, { status: 400 })
  }

  // Dev convenience only: with no Supabase project configured there is nothing
  // to write to, and the journey still needs to be walkable end to end for
  // review. Never reachable in production — allowOfflineSeedFallback() is false
  // as soon as NODE_ENV is production or the keys are present.
  if (allowOfflineSeedFallback()) {
    console.warn('[feedback] Supabase not configured — submission simulated, nothing persisted.')
    return NextResponse.json({
      feedbackCode: `AIC-SIMULATED-${submission.submissionId.slice(0, 8)}`,
      simulated: true,
    })
  }

  const db = createAdminClient()

  try {
    const outletId = await getOutletId()

    // --- idempotency: has this exact journey already landed? -----------------
    const { data: existing } = await db
      .from('feedback')
      .select('feedback_code')
      .eq('outlet_id', outletId)
      .eq('submission_id', submission.submissionId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ feedbackCode: existing.feedback_code, duplicate: true })
    }

    // --- guest resolution (§7): phone is the unique guest key ----------------
    let guestId: string | null = null
    const phone = submission.phone.trim()

    if (phone !== '') {
      const { data: found } = await db
        .from('guests')
        .select('guest_id, name')
        .eq('outlet_id', outletId)
        .eq('phone', phone)
        .maybeSingle()

      if (found) {
        guestId = found.guest_id
        // A returning guest who gives a name this time should get it recorded,
        // but a blank field must never erase what we already had.
        if (submission.name.trim() !== '' && submission.name.trim() !== found.name) {
          await db
            .from('guests')
            .update({ name: submission.name.trim() })
            .eq('guest_id', found.guest_id)
        }
      } else {
        const { data: created, error: guestError } = await db
          .from('guests')
          .insert({
            outlet_id: outletId,
            phone,
            name: submission.name.trim() === '' ? null : submission.name.trim(),
          })
          .select('guest_id')
          .single()

        if (guestError) throw guestError
        guestId = created.guest_id
      }
    }
    // No phone → guest_id stays null. The feedback is still fully counted in
    // analytics; it just is not attributable to a person (§7).

    // --- the feedback row ----------------------------------------------------
    const submittedAt = nowIST()
    const stamps = localStamps(submittedAt)
    const comment = combineComments(submission.issueDetail, submission.comment)

    const { data: feedback, error: feedbackError } = await db
      .from('feedback')
      .insert({
        outlet_id: outletId,
        kiosk_id: submission.kioskId ?? null,
        guest_id: guestId,
        submission_id: submission.submissionId,
        submitted_at: submittedAt.toISOString(),
        ...stamps,
        overall_score: overallScore(ratings),
        sentiment: sentimentFor(ratings),
        comment,
        follow_up_requested: submission.followUpRequested === true,
      })
      .select('feedback_id, feedback_code')
      .single()

    if (feedbackError) {
      // Two tablets racing the same submissionId: the unique index won, so the
      // other request already created the row. Return that one.
      if (feedbackError.code === '23505') {
        const { data: raced } = await db
          .from('feedback')
          .select('feedback_code')
          .eq('outlet_id', outletId)
          .eq('submission_id', submission.submissionId)
          .maybeSingle()

        if (raced) {
          return NextResponse.json({ feedbackCode: raced.feedback_code, duplicate: true })
        }
      }
      throw feedbackError
    }

    const feedbackId = feedback.feedback_id

    // --- ratings, chips, themes ---------------------------------------------
    const ratingRows = Object.entries(submission.ratings).map(([categoryId, rating]) => ({
      feedback_id: feedbackId,
      category_id: categoryId,
      rating,
    }))
    const { error: ratingsError } = await db.from('feedback_ratings').insert(ratingRows)
    if (ratingsError) throw ratingsError

    const chipIds = [...new Set([...submission.issueIds, ...submission.lovedIds])]
    if (chipIds.length > 0) {
      const { error: issuesError } = await db
        .from('feedback_issues')
        .insert(chipIds.map((issueId) => ({ feedback_id: feedbackId, issue_id: issueId })))
      if (issuesError) throw issuesError
    }

    if (comment) {
      const lexicon = await getThemeLexicon()
      const matches = extractThemes(comment, lexicon)
      if (matches.length > 0) {
        const { error: themesError } = await db
          .from('feedback_themes')
          .insert(matches.map((match) => ({ feedback_id: feedbackId, ...match })))
        if (themesError) throw themesError
      }
    }

    // --- follow-up -----------------------------------------------------------
    if (submission.followUpRequested === true) {
      const { error: followUpError } = await db.from('follow_ups').insert({
        outlet_id: outletId,
        feedback_id: feedbackId,
        guest_id: guestId,
        status: 'OPEN',
      })
      if (followUpError) throw followUpError
      // The trigger from Prompt 02 mirrors this onto feedback.status. Nothing
      // here ever writes that column.
    }

    // --- alerts --------------------------------------------------------------
    // Prompt 31 implements the real evaluator. Deliberately a no-op rather than
    // a half-rule, so nobody mistakes a placeholder for working alerting.
    await evaluateAlerts()

    return NextResponse.json({ feedbackCode: feedback.feedback_code })
  } catch (error) {
    console.error('[feedback] submit failed:', error)
    return NextResponse.json({ error: 'Could not record feedback' }, { status: 500 })
  }
}

/** Stub — real triggers, thresholds and dedupe land in Prompt 31. */
async function evaluateAlerts(): Promise<void> {
  return
}
