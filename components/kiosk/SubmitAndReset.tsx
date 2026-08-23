'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { clearDraft, getDraft, hasAnyRating } from '@/lib/session'

/**
 * The single atomic submit, fired on the thank-you transition (§4).
 *
 * Nothing before this screen has touched Postgres. Here the whole draft goes up
 * in one POST, the draft is wiped, and the kiosk returns to Welcome after
 * config.kiosk.thanks_seconds.
 *
 * The guest never sees a failure. If the POST fails they still get their
 * thank-you and the terminal still resets — the retry queue is Prompt 43's job,
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

      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId: draft.submissionId,
            ratings: draft.ratings,
            issueIds: draft.issueIds,
            lovedIds: draft.lovedIds,
            issueDetail: draft.issueDetail,
            comment: draft.comment,
            followUpRequested: draft.followUpRequested,
            name: draft.name,
            phone: draft.phone,
          }),
          keepalive: true,
        })

        if (!response.ok) {
          console.error('[kiosk] submit rejected:', response.status, await response.text())
        }
      } catch (error) {
        // Prompt 43 queues this in IndexedDB and retries on reconnect, reusing
        // the same submissionId so the retry collapses into one row.
        console.error('[kiosk] submit failed:', error)
      } finally {
        clearDraft()
      }
    }

    void send()
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
