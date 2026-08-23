/**
 * The kiosk journey draft — CLAUDE.md §4.
 *
 * The entire journey lives in sessionStorage as one object. Nothing reaches
 * Postgres until the final submit on the thank-you transition, so a guest who
 * walks away mid-journey leaves no partial record, and the idle timer can wipe
 * the whole thing in one call.
 *
 * Client-only by construction: every accessor guards on `window` so importing
 * this from a Server Component is harmless rather than a crash.
 */

const STORAGE_KEY = 'aic.draft.v1'

export type FeedbackDraft = {
  /**
   * Idempotency key (§7). Minted once when the journey starts and kept for its
   * whole life, so a double-tap on submit, an offline retry (§43) or a
   * back-button re-entry all collapse into one row. Never regenerated.
   */
  submissionId: string
  startedAt: string

  /** category_id → 1..5 */
  ratings: Record<string, number>

  /** Selected chips on the negative pathway. */
  issueIds: string[]
  /** Selected chips on the positive pathway. */
  lovedIds: string[]

  /** "TELL US MORE" on the negative pathway. */
  issueDetail: string
  /** The general comment screen. */
  comment: string

  /** null until the guest answers — it is a real question, not a default. */
  followUpRequested: boolean | null

  name: string
  phone: string
}

function emptyDraft(): FeedbackDraft {
  return {
    submissionId: newSubmissionId(),
    startedAt: new Date().toISOString(),
    ratings: {},
    issueIds: [],
    lovedIds: [],
    issueDetail: '',
    comment: '',
    followUpRequested: null,
    name: '',
    phone: '',
  }
}

function newSubmissionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Ancient tablet browser. Good enough for a uniqueness key that is also
  // protected by a database unique index.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

/** Read the current draft, creating one if the journey has just begun. */
export function getDraft(): FeedbackDraft {
  if (!isBrowser()) return emptyDraft()

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const fresh = emptyDraft()
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    return fresh
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackDraft>
    // Merge over a fresh object so a draft written by an older build (missing a
    // field we added since) cannot produce `undefined` halfway through a screen.
    return { ...emptyDraft(), ...parsed, submissionId: parsed.submissionId ?? newSubmissionId() }
  } catch {
    const fresh = emptyDraft()
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    return fresh
  }
}

/** Merge a partial update into the draft and return the result. */
export function patchDraft(patch: Partial<FeedbackDraft>): FeedbackDraft {
  const next = { ...getDraft(), ...patch }
  if (isBrowser()) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

/**
 * Wipe the draft. Called by the idle timer and after a successful submit, so
 * the next guest never sees the previous guest's answers (§4).
 */
export function clearDraft(): void {
  if (isBrowser()) window.sessionStorage.removeItem(STORAGE_KEY)
}

/** Every active category has been rated — the gate on CONTINUE (§5). */
export function isComplete(draft: FeedbackDraft, categoryIds: string[]): boolean {
  return categoryIds.length > 0 && categoryIds.every((id) => typeof draft.ratings[id] === 'number')
}

/** True once the guest has done enough for a submit to be meaningful. */
export function hasAnyRating(draft: FeedbackDraft): boolean {
  return Object.keys(draft.ratings).length > 0
}
