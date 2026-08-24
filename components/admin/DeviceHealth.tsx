'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CameraOff, Printer, PrinterCheck } from 'lucide-react'
import { setMemoryEnabled } from '@/lib/actions/memory'
import { cn } from '@/lib/cn'

/**
 * Device health, in the admin header (PHOTO_MODULE.md §6, §8b).
 *
 * The badge exists because a jammed printer and a quiet evening look identical
 * on a dashboard. It surfaces the moment the kiosk reports it, not three days
 * later when a guest mentions the photo did not come out.
 *
 * The one-tap "turn off memory prints" lives HERE and not only in settings,
 * which §8b is explicit about: a manager with a jammed printer at 9pm on a
 * Saturday should not have to navigate a settings tree while the café is full.
 * The control is beside the problem it solves.
 *
 * Nothing here is ever visible to a guest.
 */
export function DeviceHealth({
  printerStatus,
  cameraStatus,
  memoryEnabled,
  canToggle,
  blockedReason,
}: {
  printerStatus: string
  cameraStatus: string
  memoryEnabled: boolean
  canToggle: boolean
  /** Set when a kill-switch layer other than the master is holding it off. */
  blockedReason: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(memoryEnabled)
  const [error, setError] = useState<string | null>(null)

  const printerBad = printerStatus !== 'online'
  const cameraBad = cameraStatus === 'absent' || cameraStatus === 'denied'

  const printerLabel =
    {
      online: 'Printer online',
      offline: 'Printer offline',
      out_of_paper: 'Out of paper',
      cover_open: 'Printer cover open',
      unknown: 'Printer unknown',
    }[printerStatus] ?? 'Printer unknown'

  // Nothing worth saying: everything healthy, module on, no layer blocking it.
  if (!printerBad && !cameraBad && enabled && blockedReason === null) return null

  const toggle = () => {
    setError(null)
    startTransition(async () => {
      const next = !enabled
      const result = await setMemoryEnabled(next)
      if (result.ok) setEnabled(next)
      else setError(result.error)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {printerBad ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-bad) 40%, transparent)',
            color: 'var(--color-bad)',
          }}
        >
          <Printer size={13} strokeWidth={2} aria-hidden="true" />
          {printerLabel}
        </span>
      ) : (
        <span className="text-ink-muted inline-flex items-center gap-1.5 text-xs">
          <PrinterCheck size={13} strokeWidth={2} aria-hidden="true" />
          {printerLabel}
        </span>
      )}

      {cameraBad ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-bad) 40%, transparent)',
            color: 'var(--color-bad)',
          }}
          title={cameraStatus === 'denied' ? 'The OS camera permission was revoked.' : undefined}
        >
          <CameraOff size={13} strokeWidth={2} aria-hidden="true" />
          {cameraStatus === 'denied' ? 'Camera blocked' : 'No camera'}
        </span>
      ) : null}

      {blockedReason ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-warn) 45%, transparent)',
            color: 'var(--color-warn)',
          }}
        >
          <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />
          {blockedReason}
        </span>
      ) : null}

      {canToggle ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
            enabled
              ? 'border-line-strong text-ink-soft hover:bg-ground-sunk border'
              : 'text-accent-ink',
          )}
          style={enabled ? undefined : { background: 'var(--color-accent)' }}
        >
          {pending ? '…' : enabled ? 'Turn off memory prints' : 'Turn memory prints back on'}
        </button>
      ) : null}

      {error ? <span className="text-xs text-[color:var(--color-bad)]">{error}</span> : null}
    </div>
  )
}
