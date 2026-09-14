'use client'

import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

/**
 * When an admin page throws.
 *
 * Without this boundary an error anywhere under /admin fell through to Next's
 * own error page: no sidebar, no nav, no way back except the browser's back
 * button, and a stack trace in development that tells a café manager nothing.
 *
 * Rendered inside the admin layout, so the shell survives and the rest of the
 * app is still reachable. The digest is shown because it is the one piece of
 * information that makes a report actionable — it is the key the server logs
 * are indexed by.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The server already logged this; this is for the browser console, so a
    // developer looking over someone's shoulder sees the real cause.
    console.error('[admin]', error)
  }, [error])

  return (
    <div className="border-line bg-surface mx-auto max-w-lg rounded-2xl border p-6 text-center">
      <h1 className="font-display text-ink text-2xl">Something went wrong here.</h1>
      <p className="text-ink-soft mt-2 text-sm">
        The rest of the admin is still working — this page failed to load. Trying again usually
        fixes it, because the most common cause is a dropped connection to the database.
      </p>

      {error.digest ? (
        <p className="text-ink-muted mt-3 text-xs">
          Reference <span className="font-mono">{error.digest}</span> — quote this if you report it.
        </p>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="text-accent-ink hover:bg-accent-hover mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        style={{ background: 'var(--color-accent)' }}
      >
        <RotateCcw size={15} strokeWidth={2.2} aria-hidden="true" />
        Try again
      </button>
    </div>
  )
}
