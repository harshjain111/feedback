'use client'

import { Chip } from './Chip'
import type { Issue } from '@/lib/config.types'

/**
 * Multi-select chip grid for the issue and "what did you love" screens.
 *
 * Selecting nothing is always a valid answer — there is no minimum and no
 * validation. The chips come from the `issues` table, so labels, order and
 * which ones exist are all CMS-controlled.
 */
export function ChipGrid({
  issues,
  selected,
  onToggle,
  labelledBy,
}: {
  issues: Issue[]
  selected: string[]
  /**
   * Reports WHICH chip was tapped rather than the whole next array. The parent
   * then merges against the stored draft, so two taps in the same tick cannot
   * each build from the same stale list and drop one.
   */
  onToggle: (issueId: string) => void
  labelledBy?: string
}) {
  const toggle = onToggle

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap justify-center gap-5">
      {issues.map((issue) => (
        <Chip
          key={issue.issue_id}
          label={issue.name}
          selected={selected.includes(issue.issue_id)}
          onToggle={() => toggle(issue.issue_id)}
        />
      ))}
    </div>
  )
}
