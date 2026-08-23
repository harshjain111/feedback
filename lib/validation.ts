import { z } from 'zod'
import { INDIAN_MOBILE, normalisePhone } from './phone'

export { canKeepContact, INDIAN_MOBILE, isValidPhone, normalisePhone } from './phone'

/**
 * Shared validation — CLAUDE.md §5, §7.
 *
 * The kiosk uses these for gentle inline feedback; POST /api/feedback uses them
 * as the real gate. Nothing here is ever `required` on the guest's side: phone
 * and name are optional always (§11), and validation only has an opinion once
 * the guest has actually typed something.
 */

/** Empty is fine. Anything typed must be a real mobile number. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform(normalisePhone)
  .refine((value) => value === '' || INDIAN_MOBILE.test(value), {
    message: 'Enter a 10-digit mobile number',
  })

export const optionalNameSchema = z.string().trim().max(120)

// -----------------------------------------------------------------------------
// Submit payload — the gate on POST /api/feedback (Prompt 17)
// -----------------------------------------------------------------------------

/** A rating: one active category, 1..5, matching the DB CHECK constraint. */
export const ratingSchema = z.number().int().min(1).max(5)

export const feedbackSubmissionSchema = z.object({
  /** Idempotency key (§7). Required: without it a retry would duplicate. */
  submissionId: z.string().uuid(),

  /** category_id -> 1..5. At least one, or there is nothing to record. */
  ratings: z.record(z.string().uuid().or(z.string().min(1)), ratingSchema),

  issueIds: z.array(z.string().min(1)).max(50).default([]),
  lovedIds: z.array(z.string().min(1)).max(50).default([]),

  issueDetail: z.string().max(2000).default(''),
  comment: z.string().max(2000).default(''),

  followUpRequested: z.boolean().nullable().default(null),

  name: optionalNameSchema.default(''),
  phone: optionalPhoneSchema.default(''),

  /** Which kiosk sent this, when the tablet knows (§43 heartbeat). */
  kioskId: z.string().uuid().nullish(),
})

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>

/**
 * The guest's own words, preserved in full (§14.10).
 *
 * The negative pathway asks "TELL US MORE" and the general comment screen then
 * asks "anything else", so a negative journey can produce two texts while §7
 * gives `feedback` one comment column. Both are kept, joined by a blank line —
 * nothing is dropped or summarised. If attribution between the two ever
 * matters for analytics, that needs a second column and a migration.
 */
export function combineComments(issueDetail: string, comment: string): string | null {
  const parts = [issueDetail.trim(), comment.trim()].filter((part) => part !== '')
  return parts.length === 0 ? null : parts.join('\n\n')
}
