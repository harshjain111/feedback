/**
 * The words a phone actually shows for a low rating.
 *
 * Split out of lib/push.ts deliberately: that module is `server-only` because
 * it holds the VAPID keys and the database read, and this is a pure function of
 * its arguments. Keeping them in one file made the copy — the part that decides
 * whether a manager walks to the table — the one part that could not be tested.
 */

export type PushPayload = {
  title: string
  body: string
  /** Where notificationclick should land. Relative, resolved against origin. */
  url: string
  /** Collapses same-subject notifications on the device instead of stacking. */
  tag: string
}

/**
 * The notification for a submission that scored below the alert threshold.
 *
 * ONE notification per submission, not one per bad category. A guest who rates
 * food 1, service 2 and hospitality 2 has had one bad visit; three buzzes in
 * the same second would train the recipient to swipe them away.
 *
 * The body leads with the guest's own words where there are any. "Food was
 * cold and nobody came back" is what makes somebody walk to the table; "Food
 * was rated 1 out of 5" is a number they will read later.
 */
export function lowRatingNotification(input: {
  feedbackId: string
  guestName: string | null
  comment: string | null
  worst: { categoryName: string; rating: number }
  lowCount: number
}): PushPayload {
  const who = input.guestName?.trim() ? input.guestName.trim() : 'A guest'
  const others =
    input.lowCount > 1 ? ` and ${input.lowCount - 1} other${input.lowCount > 2 ? 's' : ''}` : ''

  const title = `${who} rated ${input.worst.categoryName} ${input.worst.rating}/5${others}`

  const comment = input.comment?.trim()
  const body = comment
    ? comment.length > 160
      ? `${comment.slice(0, 157)}…`
      : comment
    : 'No comment left. Open the feedback to see the full submission.'

  return {
    title,
    body,
    url: `/admin/feedback/${input.feedbackId}`,
    // One notification per feedback: a retry or a duplicate evaluation replaces
    // the existing one on the device rather than adding to it.
    tag: `feedback:${input.feedbackId}`,
  }
}
