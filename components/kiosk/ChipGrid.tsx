'use client'

import { Check } from 'lucide-react'
import { CategoryIcon } from './CategoryIcon'
import type { Issue } from '@/lib/config.types'
import { cn } from '@/lib/cn'

/**
 * Multi-select tiles for the issue and "what did you love" screens.
 *
 * Tiles with icons rather than text pills, as in the approved reference: a
 * guest scanning a wall of seven word-chips has to read all seven, where an
 * icon grid can be recognised. It also keeps every option the same size, so
 * "Billing" does not look like a lesser choice than "Waiting Time".
 *
 * Selecting nothing is always valid. There is no minimum and no validation.
 */
export function ChipGrid({
  issues,
  selected,
  onToggle,
  labelledBy,
  tone = 'negative',
  columns = 3,
}: {
  issues: Issue[]
  selected: string[]
  /**
   * Reports WHICH tile was tapped rather than the whole next array, so the
   * parent merges against the stored draft — two taps in one tick cannot each
   * build from the same stale list and drop one.
   */
  onToggle: (issueId: string) => void
  labelledBy?: string
  tone?: 'negative' | 'positive'
  columns?: number
}) {
  const px = (n: number) => `calc(${n} * var(--kpx))`
  const activeColour = tone === 'negative' ? 'var(--color-terracotta)' : 'var(--color-accent)'

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="grid"
      style={{ gap: px(14), gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {issues.map((issue) => {
        const isSelected = selected.includes(issue.issue_id)

        return (
          <button
            key={issue.issue_id}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            onClick={() => onToggle(issue.issue_id)}
            className={cn(
              'k-card k-tap relative flex flex-col items-center justify-center',
              'transition-[border-color,background-color] duration-[--duration-kiosk] ease-[--ease-kiosk]',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
            style={{
              gap: px(10),
              padding: px(16),
              borderColor: isSelected ? activeColour : undefined,
              borderWidth: isSelected ? px(2.5) : undefined,
              background: isSelected ? 'var(--color-surface)' : undefined,
              outlineColor: activeColour,
            }}
          >
            {isSelected ? (
              <span
                className="absolute grid place-items-center rounded-full text-white"
                style={{
                  top: px(8),
                  right: px(8),
                  width: px(24),
                  height: px(24),
                  background: activeColour,
                }}
              >
                <Check size={14} strokeWidth={3} aria-hidden="true" />
              </span>
            ) : null}

            <span style={{ color: isSelected ? activeColour : 'var(--color-ink-muted)' }}>
              <CategoryIcon name={issue.icon ?? 'smile'} size={34} />
            </span>

            <span
              className="text-k-small text-center leading-tight"
              style={{
                color: isSelected ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                fontWeight: isSelected ? 600 : 500,
              }}
            >
              {issue.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
