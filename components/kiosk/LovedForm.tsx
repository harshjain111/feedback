'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import { ChipGrid } from './ChipGrid'
import type { Issue } from '@/lib/config.types'
import { getDraft, patchDraft } from '@/lib/session'

/**
 * The positive pathway (§5). Everything optional, as everywhere else.
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
  const px = (n: number) => `calc(${n} * var(--kpx))`

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
      <div
        className="flex min-h-0 flex-1 flex-col justify-center"
        style={{ paddingInline: px(40) }}
      >
        <h2
          id="loved-most"
          className="font-display text-k-h2 text-ink text-center"
          style={{ marginBottom: px(28) }}
        >
          {heading}
        </h2>
        <ChipGrid
          issues={issues}
          selected={selected}
          onToggle={toggleLoved}
          labelledBy="loved-most"
          tone="positive"
          columns={3}
        />
      </div>

      <div className="shrink-0" style={{ paddingInline: px(40), paddingBlock: px(20) }}>
        <BigButton fullWidth onClick={() => router.push('/comment')}>
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
