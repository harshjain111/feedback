import { enqueue } from './queue'
import { getDraft, patchDraft, hasAnyRating, type FeedbackDraft } from '@/lib/session'

/**
 * The single atomic submit (§4).
 *
 * Extracted out of the thank-you screen because PHOTO_MODULE.md rule 1 moved the
 * commit point: the feedback must be in Postgres BEFORE the camera opens, so
 * that a jammed printer, a revoked permission or a dead agent can never cost a
 * guest their feedback record. The submit now fires on leaving the contact
 * screen; thank-you only sends what the photo path did not.
 *
 * Idempotent by construction. `submission_id` carries a unique index (§7), so
 * calling this twice for one journey returns the same feedback_code rather than
 * writing a second row — which is what makes it safe to have two callers.
 *
 * The guest never sees a failure. An offline kiosk queues and moves on; an
 * error dialog on a café wall helps nobody and the guest has already done their
 * part (§43).
 */

export type SubmitOutcome = {
  /** The code, or null if the write did not land. The journey continues either way. */
  feedbackCode: string | null
  /** True when it went to the retry queue instead of Postgres. */
  queued: boolean
}

function payloadOf(draft: FeedbackDraft) {
  return {
    submissionId: draft.submissionId,
    ratings: draft.ratings,
    issueIds: draft.issueIds,
    lovedIds: draft.lovedIds,
    issueDetail: draft.issueDetail,
    comment: draft.comment,
    followUpRequested: draft.followUpRequested,
    name: draft.name,
    phone: draft.phone,
  }
}

export async function submitDraft(): Promise<SubmitOutcome> {
  const draft = getDraft()

  // Already done for this journey — the code is the receipt.
  if (draft.feedbackCode !== null) {
    return { feedbackCode: draft.feedbackCode, queued: false }
  }

  // A journey with nothing rated is somebody brushing the screen on the way
  // past. Nothing to record, and nothing to apologise for.
  if (!hasAnyRating(draft)) return { feedbackCode: null, queued: false }

  const payload = payloadOf(draft)

  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })

    if (response.ok) {
      const body = (await response.json()) as { feedbackCode?: string }
      const feedbackCode = body.feedbackCode ?? null
      // Written to the draft, because this is what the /memory guard reads.
      if (feedbackCode !== null) patchDraft({ feedbackCode })
      return { feedbackCode, queued: false }
    }

    // A 5xx or a rate limit is worth retrying; a validation failure is not, and
    // queuing it would loop forever.
    if (response.status >= 500 || response.status === 429) {
      await enqueue(draft.submissionId, payload)
      return { feedbackCode: null, queued: true }
    }

    console.error('[kiosk] submit rejected:', response.status)
    return { feedbackCode: null, queued: false }
  } catch {
    // Offline.
    await enqueue(draft.submissionId, payload)
    return { feedbackCode: null, queued: true }
  }
}

/**
 * Record what the photo module did, on the feedback row that already exists.
 *
 * Best-effort and deliberately unawaited-safe: uptake analytics are worth
 * having and are worth nothing compared to the guest's journey continuing. A
 * failure here is swallowed.
 *
 * Note what is NOT sent: no image, no dimensions, no caption. Three booleans and
 * a count, keyed by the submission_id the kiosk already holds (§7, §12).
 */
export async function recordMemoryOutcome(patch: {
  offered?: boolean
  printed?: boolean
  retries?: number
}): Promise<void> {
  const draft = getDraft()
  if (draft.feedbackCode === null) return

  try {
    await fetch('/api/feedback/memory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: draft.submissionId, ...patch }),
      keepalive: true,
    })
  } catch {
    // Swallowed on purpose. See above.
  }
}
