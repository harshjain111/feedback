'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import { ChipGrid } from './ChipGrid'
import type { AppConfig, Issue } from '@/lib/config.types'
import { getDraft, patchDraft } from '@/lib/session'

/**
 * The negative pathway (§5).
 *
 * CONTINUE is never disabled and nothing is required. A guest annoyed enough to
 * rate 1 is not owed a form — the screen exists so they can say more if they
 * want to, and leave if they do not.
 */
export function IssuesForm({
  issues,
  copy,
  continueLabel,
}: {
  issues: Issue[]
  copy: AppConfig['negative']
  continueLabel: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState('')
  const px = (n: number) => `calc(${n} * var(--kpx))`

  useEffect(() => {
    const draft = getDraft()
    setSelected(draft.issueIds)
    setDetail(draft.issueDetail)
  }, [])

  // Merge against the STORED list, never the closed-over one: two tiles tapped
  // in the same tick would otherwise each build from the same stale array.
  const toggleIssue = (issueId: string) => {
    const current = getDraft().issueIds
    const next = current.includes(issueId)
      ? current.filter((id) => id !== issueId)
      : [...current, issueId]
    patchDraft({ issueIds: next })
    setSelected(next)
  }

  const writeDetail = (next: string) => {
    setDetail(next)
    patchDraft({ issueDetail: next })
  }

  return (
    <>
      <div
        className="flex min-h-0 flex-1 flex-col justify-center"
        style={{ gap: px(20), paddingInline: px(40) }}
      >
        <div>
          <h2
            id="what-happened"
            className="font-display text-k-h2 text-ink text-center"
            style={{ marginBottom: px(6) }}
          >
            {copy.h2}
          </h2>
          <p className="text-k-small text-ink-muted text-center" style={{ marginBottom: px(16) }}>
            {copy.chips_hint}
          </p>
          <ChipGrid
            issues={issues}
            selected={selected}
            onToggle={toggleIssue}
            labelledBy="what-happened"
            tone="negative"
            columns={3}
          />
        </div>

        <div>
          <h3
            id="tell-us-more"
            className="font-display text-k-h3 text-ink text-center"
            style={{ marginBottom: px(6) }}
          >
            {copy.h3}
          </h3>
          <p className="text-k-small text-ink-muted text-center" style={{ marginBottom: px(12) }}>
            {copy.support}
          </p>
          <textarea
            aria-labelledby="tell-us-more"
            value={detail}
            onChange={(event) => writeDetail(event.target.value)}
            rows={3}
            className="k-card text-k-body text-ink focus:border-accent w-full resize-none outline-none"
            style={{ padding: px(20) }}
          />
        </div>
      </div>

      <div className="shrink-0" style={{ paddingInline: px(40), paddingBlock: px(20) }}>
        <BigButton fullWidth onClick={() => router.push('/comment')}>
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
