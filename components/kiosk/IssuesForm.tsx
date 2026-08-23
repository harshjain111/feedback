'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import { ChipGrid } from './ChipGrid'
import { PrefetchNext } from './PrefetchNext'
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
  /**
   * The comment section's copy, reused for the placeholder. §5 gives the
   * negative pathway a support line but no placeholder, and an unlabelled empty
   * box reads as broken — so it borrows "YOUR THOUGHTS..." rather than
   * hard-coding a second one (§3).
   */
  commentCopy,
  continueLabel,
}: {
  issues: Issue[]
  copy: AppConfig['negative']
  commentCopy: AppConfig['comment']
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
      <PrefetchNext routes={['/contact']} />

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ gap: px(22), paddingInline: px(44), paddingTop: px(12) }}
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

        <div className="flex min-h-0 flex-1 flex-col">
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
            placeholder={commentCopy.placeholder}
            maxLength={2000}
            className="k-card bg-surface text-k-body text-ink placeholder:text-ink-muted/60 focus:border-accent min-h-0 w-full flex-1 resize-none outline-none"
            /*
             * Capped rather than free to fill: flex-1 alone gave the box 44% of a
             * 960px screen, and a void that size reads as a broken layout rather
             * than an invitation. 460 design px is still four or five comfortable
             * lines, which is more than anyone types on a kiosk on their way out.
             */
            style={{ padding: px(24), maxHeight: px(460) }}
          />
        </div>
      </div>

      <div className="k-cta-dock shrink-0" style={{ paddingInline: px(44), paddingBlock: px(20) }}>
        <BigButton fullWidth className="k-cta" onClick={() => router.push('/contact')}>
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
