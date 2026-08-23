'use client'

import { useEffect } from 'react'
import { clearDraft } from '@/lib/session'

/**
 * The kiosk crash boundary (§43).
 *
 * A guest must never see a stack trace, and a wedged terminal at a café exit is
 * worse than a lost submission. So anything that throws resets to Welcome and
 * clears the draft — which also means the next guest cannot inherit the
 * previous one's half-finished answers through a crash.
 *
 * The copy here is the one place the kiosk is allowed a hard-coded string: it
 * has to work when the config loader is the thing that failed.
 */
export default function KioskError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[kiosk] crashed:', error)
    clearDraft()

    // Long enough that a genuine repeated crash does not become a reload loop,
    // short enough that the terminal is usable again before the next guest.
    const timer = window.setTimeout(() => {
      window.location.href = '/'
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [error])

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-16 text-center">
      <h1 className="font-display text-k-h2 text-ink">One moment.</h1>
      <p className="text-k-lead text-ink-muted mt-6">We are getting things ready again.</p>
      <button
        type="button"
        onClick={() => {
          clearDraft()
          reset()
        }}
        className="border-line-strong text-ink text-k-body mt-12 min-h-[88px] rounded-[16px] border-2 px-10"
      >
        Start again
      </button>
    </section>
  )
}
