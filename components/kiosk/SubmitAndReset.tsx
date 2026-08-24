'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { flush } from '@/lib/kiosk/queue'
import { submitDraft } from '@/lib/kiosk/submit'
import { clearDraft, getDraft, hasAnyRating } from '@/lib/session'

/**
 * The safety net, and the reset (§4).
 *
 * This used to BE the submit. PHOTO_MODULE.md rule 1 moved the commit to the
 * contact screen, so that the feedback is in Postgres before the camera opens
 * and a jammed printer can never cost a guest their record.
 *
 * It still calls submitDraft(), and that is deliberate rather than leftover.
 * The call is idempotent — a draft that already carries a feedbackCode returns
 * it without a second write, and `submission_id`'s unique index (§7) would stop
 * a duplicate even if it did. What it catches is every path that reaches
 * thank-you without passing through contact: a journey abandoned and resumed, a
 * future screen order, an offline submit that queued and has since come back.
 *
 * The alternative — trusting that contact always ran — is exactly the kind of
 * assumption that silently loses feedback when someone reorders the journey.
 *
 * The guest never sees a failure. If the POST fails they still get their
 * thank-you and the terminal still resets; the retry queue handles the rest,
 * and an error dialog on a café wall helps nobody.
 */
export function SubmitAndReset({ seconds }: { seconds: number }) {
  const router = useRouter()
  const submitted = useRef(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // React Strict Mode runs effects twice in development. The ref stops the
    // second run; the submission_id unique index stops everything else.
    if (submitted.current) return
    submitted.current = true

    const draft = getDraft()

    const send = async () => {
      if (!hasAnyRating(draft)) return
      // Idempotent: returns the existing code without writing when the contact
      // screen already committed, which is the normal path.
      await submitDraft()
      clearDraft()
    }

    void send()

    // Anything left from an earlier outage goes out now that we clearly have a
    // working connection, or the next time one appears.
    void flush()
    const onOnline = () => void flush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  /**
   * Back-button re-entry (§43).
   *
   * The journey is over and the draft is gone. Walking back into /contact would
   * show a stranger an empty form mid-flow, so any attempt to leave this screen
   * backwards lands on Welcome instead. A pushed sentinel entry means the first
   * Back press is caught rather than the guest already being gone.
   */
  useEffect(() => {
    window.history.pushState({ kioskThanks: true }, '')

    const onPopState = () => {
      clearDraft()
      window.location.replace('/')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Subtle progress toward the auto-reset — reassurance that the terminal is
  // about to be ready for the next guest, not a countdown pressuring this one.
  useEffect(() => {
    const total = Math.max(2, seconds) * 1000
    const startedAt = Date.now()

    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      setProgress(Math.min(1, elapsed / total))
      if (elapsed >= total) {
        window.clearInterval(tick)
        clearDraft()
        router.replace('/')
      }
    }, 100)

    return () => window.clearInterval(tick)
  }, [router, seconds])

  return (
    <div
      className="bg-line/50 h-1.5 w-full max-w-[420px] overflow-hidden rounded-full"
      role="presentation"
    >
      <div
        className="bg-accent h-full rounded-full transition-[width] duration-100 ease-linear"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )
}
