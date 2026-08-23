'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import { ChipGrid } from './ChipGrid'
import type { Issue } from '@/lib/config.types'
import { getDraft, patchDraft } from '@/lib/session'

/**
 * The positive pathway (§5).
 *
 * This is not a victory lap. Knowing WHAT created the delight is the management
 * signal — "4.8 overall" tells you nothing you can repeat, "Our Team, 62
 * mentions" does. Everything optional, as everywhere else.
 */
export function LovedForm({
  issues,
  heading,
  continueLabel,
}: {
  issues: Issue[]
  heading: string
  continueLabel: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    setSelected(getDraft().lovedIds)
  }, [])

  // Merge against the STORED list — same reason as the negative pathway.
  const toggleLoved = (issueId: string) => {
    const current = getDraft().lovedIds
    const next = current.includes(issueId)
      ? current.filter((id) => id !== issueId)
      : [...current, issueId]
    patchDraft({ lovedIds: next })
    setSelected(next)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col justify-center px-12">
        <h2 id="loved-most" className="font-display text-k-h2 text-ink mb-12 text-center">
          {heading}
        </h2>
        <ChipGrid
          issues={issues}
          selected={selected}
          onToggle={toggleLoved}
          labelledBy="loved-most"
        />
      </div>

      <div className="shrink-0 px-12 pt-4 pb-4">
        <BigButton fullWidth onClick={() => router.push('/comment')}>
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
