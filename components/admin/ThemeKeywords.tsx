'use client'

import { useState, useTransition } from 'react'
import { setThemeKeywords } from '@/lib/actions/settings'
import { cn } from '@/lib/cn'

/**
 * The keyword list behind one theme (§36).
 *
 * Comma-separated on purpose: a manager adding five words at once should not
 * have to click Add five times, and the list is the unit of meaning, not the
 * individual word.
 */
export function ThemeKeywords({
  themeId,
  name,
  kind,
  keywords,
}: {
  themeId: string
  name: string
  kind: string
  keywords: string[]
}) {
  const [value, setValue] = useState(keywords.join(', '))
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (value === keywords.join(', ')) return
    startTransition(async () => {
      const result = await setThemeKeywords(
        themeId,
        value.split(',').map((word) => word.trim()),
      )
      if (result.ok) {
        setState('saved')
        setError(null)
      } else {
        setState('error')
        setError(result.error)
      }
    })
  }

  return (
    <div className="border-line bg-surface rounded-lg border px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-ink text-xs font-medium">
          {name}
          <span
            className={cn(
              'ml-2 rounded-full px-1.5 py-0.5 text-[10px]',
              kind === 'negative'
                ? 'bg-[color:var(--color-bad)]/10 text-[color:var(--color-bad)]'
                : 'bg-[color:var(--color-good)]/10 text-[color:var(--color-good)]',
            )}
          >
            {kind}
          </span>
        </span>
        {state === 'saved' ? (
          <span className="text-[11px] text-[color:var(--color-good)]">saved</span>
        ) : null}
      </div>

      <input
        type="text"
        value={value}
        disabled={pending}
        onChange={(event) => {
          setValue(event.target.value)
          setState('idle')
        }}
        onBlur={save}
        aria-label={`Keywords for ${name}`}
        className="border-line-strong focus:border-accent w-full rounded-lg border px-2 py-1 font-mono text-xs outline-none"
      />

      {error ? <p className="mt-1 text-[11px] text-[color:var(--color-bad)]">{error}</p> : null}
    </div>
  )
}
