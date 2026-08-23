'use client'

import { cn } from '@/lib/cn'

/**
 * Multi-select chip for the issue and "what did you love" screens.
 *
 * Selected state has to be unmistakable across a room: filled accent, not a
 * tinted border. Labels come from the `issues` table, never from here.
 */
export function Chip({
  label,
  selected,
  onToggle,
  className,
}: {
  label: string
  selected: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        'rounded-chip inline-flex min-h-[88px] items-center justify-center border-2 px-10 py-5',
        'text-k-lead font-sans font-medium',
        'transition-[background-color,border-color,color] duration-[--duration-kiosk] ease-[--ease-kiosk]',
        'focus-visible:outline-accent focus-visible:outline-4 focus-visible:outline-offset-4',
        selected
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line-strong bg-surface text-ink-soft',
        className,
      )}
    >
      {label}
    </button>
  )
}
