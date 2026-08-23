'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { resetConfigValue, updateConfigValue } from '@/lib/actions/settings'
import { cn } from '@/lib/cn'

/**
 * One editable config value.
 *
 * Saves on blur rather than behind a form button: a CMS with forty fields and
 * one Save is a CMS where people lose work. Every field carries "Reset to
 * default", which puts back exactly what 0002_seed.sql shipped — for the locked
 * copy of §5 that is the approved wording, so the escape hatch from a bad edit
 * is always one click.
 */
export function ConfigField({
  configKey,
  label,
  value,
  type = 'text',
  hint,
  onLocalChange,
}: {
  configKey: string
  label: string
  value: string | number | boolean | null
  type?: 'text' | 'textarea' | 'number' | 'boolean'
  hint?: string
  /** Lets the live preview update as you type, before the save lands. */
  onLocalChange?: (key: string, value: string | number | boolean | null) => void
}) {
  const [current, setCurrent] = useState(value)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const change = (next: string | number | boolean | null) => {
    setCurrent(next)
    setSaved('idle')
    onLocalChange?.(configKey, next)
  }

  const persist = (next: string | number | boolean | null) => {
    if (next === value && saved === 'idle') return
    setSaved('saving')
    startTransition(async () => {
      const result = await updateConfigValue(configKey, next)
      if (result.ok) {
        setSaved('done')
        setError(null)
      } else {
        setSaved('error')
        setError(result.error)
      }
    })
  }

  const reset = () => {
    setSaved('saving')
    startTransition(async () => {
      const result = await resetConfigValue(configKey)
      if (result.ok) {
        setSaved('done')
        // Server state is authoritative now; a reload shows the seeded value.
        window.location.reload()
      } else {
        setSaved('error')
        setError(result.error)
      }
    })
  }

  const inputClass =
    'w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent'

  return (
    <div className="py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={configKey} className="text-ink text-xs font-medium">
          {label}
          <span className="text-ink-muted ml-2 font-mono text-[10px]">{configKey}</span>
        </label>

        <span className="flex items-center gap-2">
          {saved === 'saving' ? <span className="text-ink-muted text-[11px]">saving…</span> : null}
          {saved === 'done' ? (
            <span className="text-[11px] text-[color:var(--color-good)]">saved</span>
          ) : null}
          <button
            type="button"
            onClick={reset}
            title="Reset to the seeded default"
            className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-[11px]"
          >
            <RotateCcw size={11} strokeWidth={2} aria-hidden="true" />
            Reset
          </button>
        </span>
      </div>

      {type === 'textarea' ? (
        <textarea
          id={configKey}
          rows={3}
          value={String(current ?? '')}
          onChange={(event) => change(event.target.value)}
          onBlur={(event) => persist(event.target.value)}
          className={cn(inputClass, 'resize-none')}
        />
      ) : type === 'number' ? (
        <input
          id={configKey}
          type="number"
          step="any"
          value={current === null ? '' : String(current)}
          onChange={(event) =>
            change(event.target.value === '' ? null : Number(event.target.value))
          }
          onBlur={(event) => persist(event.target.value === '' ? null : Number(event.target.value))}
          className={inputClass}
        />
      ) : type === 'boolean' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            id={configKey}
            type="checkbox"
            checked={current === true}
            onChange={(event) => {
              change(event.target.checked)
              persist(event.target.checked)
            }}
            className="h-4 w-4"
          />
          <span className="text-ink-soft">{current === true ? 'Enabled' : 'Disabled'}</span>
        </label>
      ) : (
        <input
          id={configKey}
          type="text"
          value={String(current ?? '')}
          onChange={(event) => change(event.target.value)}
          onBlur={(event) => persist(event.target.value)}
          className={inputClass}
        />
      )}

      {hint ? <p className="text-ink-muted mt-1 text-[11px]">{hint}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-[color:var(--color-bad)]">{error}</p> : null}
    </div>
  )
}
