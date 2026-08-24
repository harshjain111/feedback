import { Camera, Printer, RotateCcw, Scroll } from 'lucide-react'
import { PanelEmpty } from './Panel'
import type { MemoryUptake } from '@/lib/queries/types'

/**
 * Memory Print Module uptake (PHOTO_MODULE.md §8).
 *
 * A sharp drop here usually means the printer is failing silently rather than
 * that guests stopped wanting photos — the failure path is deliberately
 * invisible to guests (§7), so this number is one of the few places it shows.
 * That is why it sits on the dashboard rather than in settings.
 */
export function MemoryUptakePanel({ uptake }: { uptake: MemoryUptake }) {
  if (uptake.offered === 0) {
    return <PanelEmpty message="No guest has been offered a print in this period." />
  }

  const cells = [
    {
      label: 'Offered',
      value: String(uptake.offered),
      icon: Camera,
      tint: 'var(--color-accent)',
      note: 'Guests shown the offer',
    },
    {
      label: 'Printed',
      value: String(uptake.printed),
      icon: Printer,
      tint: 'var(--color-good)',
      note: 'Keepsakes collected',
    },
    {
      label: 'Uptake',
      value: uptake.uptakePct === null ? '—' : `${uptake.uptakePct}%`,
      icon: Printer,
      tint: 'var(--color-warn)',
      note: 'Printed of offered',
    },
    {
      label: 'Retakes',
      value: String(uptake.retries),
      icon: RotateCcw,
      tint: 'var(--color-terracotta)',
      note: 'Capped at 3 per guest',
    },
    {
      label: 'Paper used',
      value: `${uptake.paperMetres} m`,
      icon: Scroll,
      tint: 'var(--color-ink-muted)',
      // Said plainly: a printer share is write-only, so nothing can read the roll.
      note: 'Estimated, not measured',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((cell) => (
        <div key={cell.label} className="border-line bg-surface rounded-2xl border p-4">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${cell.tint} 12%, transparent)` }}
          >
            <cell.icon size={17} strokeWidth={2} aria-hidden="true" style={{ color: cell.tint }} />
          </span>
          <p className="text-ink-soft mt-3 text-[13px] font-medium">{cell.label}</p>
          <p className="font-display text-ink mt-1 text-3xl tabular-nums">{cell.value}</p>
          <p className="text-ink-muted mt-1 text-xs">{cell.note}</p>
        </div>
      ))}
    </div>
  )
}
