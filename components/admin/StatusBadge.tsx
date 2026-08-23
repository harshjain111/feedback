import { cn } from '@/lib/cn'

/**
 * Follow-up status (§7, §30).
 *
 * NEW means no follow-up row exists at all — nobody has picked this up. It
 * reads deliberately plainer than OPEN so a manager can tell "nothing has
 * started" from "started and in progress" at a glance.
 */
const TONE: Record<string, string> = {
  NEW: 'bg-ground-sunk text-ink-muted',
  OPEN: 'bg-[color:var(--color-bad)]/10 text-[color:var(--color-bad)]',
  CONTACTED: 'bg-[color:var(--color-warn)]/12 text-[color:var(--color-warn)]',
  RESOLVED: 'bg-[color:var(--color-good)]/10 text-[color:var(--color-good)]',
  CLOSED: 'bg-ground-sunk text-ink-soft',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        TONE[status] ?? 'bg-ground-sunk text-ink-soft',
        className,
      )}
    >
      {status}
    </span>
  )
}
