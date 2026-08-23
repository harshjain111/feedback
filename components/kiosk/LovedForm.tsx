'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import { ChipGrid } from './ChipGrid'
import { PrefetchNext } from './PrefetchNext'
import type { AppConfig, Issue } from '@/lib/config.types'
import { getDraft, patchDraft } from '@/lib/session'

/**
 * The positive pathway (§5), with the comment folded in.
 *
 * The comment used to be its own screen for every guest. It is here now because
 * a separate page asking "anything else?" immediately after asking "what did
 * you love?" is the same question twice — and every extra tap is a guest who
 * walks away before finishing.
 *
 * Everything optional, as everywhere else.
 */
export function LovedForm({
  issues,
  heading,
  comment: commentCopy,
  continueLabel,
}: {
  issues: Issue[]
  heading: string
  comment: AppConfig['comment']
  continueLabel: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const px = (n: number) => `calc(${n} * var(--kpx))`

  useEffect(() => {
    const draft = getDraft()
    setSelected(draft.lovedIds)
    setComment(draft.comment)
  }, [])

  // Merge against the STORED list: two tiles tapped in the same tick would
  // otherwise each build from the same stale array and drop one.
  const toggleLoved = (issueId: string) => {
    const current = getDraft().lovedIds
    const next = current.includes(issueId)
      ? current.filter((id) => id !== issueId)
      : [...current, issueId]
    patchDraft({ lovedIds: next })
    setSelected(next)
  }

  const write = (next: string) => {
    setComment(next)
    patchDraft({ comment: next })
  }

  return (
    <>
      <PrefetchNext routes={['/contact']} />

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ gap: px(24), paddingInline: px(44), paddingTop: px(12) }}
      >
        <div>
          <h2
            id="loved-most"
            className="font-display text-k-h2 text-ink text-center"
            style={{ marginBottom: px(20) }}
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

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex items-baseline justify-center"
            style={{ gap: px(12), marginBottom: px(12) }}
          >
            <h3 className="font-display text-k-h3 text-ink">{commentCopy.h1_short}</h3>
            <span
              className="bg-accent-soft text-accent text-k-micro rounded-chip font-medium"
              style={{ paddingInline: px(16), paddingBlock: px(4) }}
            >
              {commentCopy.badge}
            </span>
          </div>
          <textarea
            aria-label={commentCopy.placeholder}
            value={comment}
            onChange={(event) => write(event.target.value)}
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
