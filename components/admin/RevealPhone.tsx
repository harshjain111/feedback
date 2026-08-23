'use client'

import { useState, useTransition } from 'react'
import { Eye } from 'lucide-react'
import { revealGuestPhone } from '@/lib/actions/follow-ups'

/**
 * Unmasking a guest's number (§11).
 *
 * Deliberately an action with a button rather than something the page does for
 * you: every reveal writes an audit_log row naming who did it and why, and a
 * value that appears automatically is one nobody chose to look at. The database
 * function does the permission check and the logging — this component cannot
 * bypass either.
 */
export function RevealPhone({ guestId, masked }: { guestId: string; masked: string | null }) {
  const [pending, startTransition] = useTransition()
  const [phone, setPhone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!masked) return <span className="text-ink-muted">Not given</span>

  if (phone) {
    return (
      <span className="text-ink">
        {phone}
        <span className="text-ink-muted ml-2 text-[11px]">revealed · logged</span>
      </span>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-ink">{masked}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await revealGuestPhone(guestId, 'Viewed on the guest profile')
            if (result.ok) setPhone(result.phone)
            else setError(result.error)
          })
        }
        className="border-line text-ink-soft hover:bg-ground-sunk inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] disabled:opacity-50"
      >
        <Eye size={11} strokeWidth={2} aria-hidden="true" />
        Reveal
      </button>
      {error ? <span className="text-[11px] text-[color:var(--color-bad)]">{error}</span> : null}
    </span>
  )
}
