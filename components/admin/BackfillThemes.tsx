'use client'

import { useState } from 'react'
import { History } from 'lucide-react'

/**
 * Re-match historical comments against the current lexicon (Prompt 27, §36).
 *
 * A deliberate action, not something a keyword save triggers. Adding one word
 * should not silently rewrite months of theme history, and a manager who wants
 * the past to reflect the new list should be the one to say so.
 */
export function BackfillThemes() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ processed: number; matched: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (
      !window.confirm(
        'Re-scan every past comment against the current keywords?\n\n' +
          'Theme counts on the analytics pages will change to reflect the new list. ' +
          'The comments themselves are never modified.',
      )
    ) {
      return
    }

    setState('running')
    try {
      const response = await fetch('/api/admin/backfill-themes', { method: 'POST' })
      const json = await response.json()
      if (!response.ok) {
        setState('error')
        setError(json.error ?? 'Backfill failed')
        return
      }
      setResult(json)
      setState('done')
    } catch {
      setState('error')
      setError('Could not reach the server.')
    }
  }

  return (
    <div className="border-line mt-4 rounded-xl border border-dashed p-3">
      <button
        type="button"
        onClick={run}
        disabled={state === 'running'}
        className="border-line-strong text-ink-soft hover:bg-ground-sunk inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        <History size={13} strokeWidth={2} aria-hidden="true" />
        {state === 'running' ? 'Re-scanning…' : 'Re-scan past comments'}
      </button>

      <p className="text-ink-muted mt-2 text-[11px]">
        Keyword changes only affect new comments until this is run. Only the theme index is
        rewritten — what guests actually wrote is never touched.
      </p>

      {state === 'done' && result ? (
        <p className="mt-1 text-[11px] text-[color:var(--color-good)]">
          Re-scanned {result.processed} comment{result.processed === 1 ? '' : 's'}; {result.matched}{' '}
          now match at least one theme.
        </p>
      ) : null}
      {state === 'error' ? (
        <p className="mt-1 text-[11px] text-[color:var(--color-bad)]">{error}</p>
      ) : null}
    </div>
  )
}
