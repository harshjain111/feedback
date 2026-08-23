import { Store } from 'lucide-react'

/**
 * Outlet selector.
 *
 * One café today, so it renders as a label rather than a dropdown — a select
 * with a single option is noise. Everything behind it is already per-outlet
 * (§43), so this becomes a real control by swapping this component alone.
 */
export function OutletSelector({ name, code }: { name: string; code: string }) {
  return (
    <div className="border-line bg-surface text-ink-soft inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
      <Store size={15} strokeWidth={1.8} aria-hidden="true" className="text-ink-muted" />
      <span className="text-ink font-medium">{name}</span>
      <span className="text-ink-muted text-xs">{code}</span>
    </div>
  )
}
