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
 * CONTINUE is never disabled and nothing is required. A guest who is annoyed
 * enough to rate 1 is not owed a form — the screen exists so they can say more
 * if they want to, and leave if they do not.
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

  useEffect(() => {
    const draft = getDraft()
    setSelected(draft.issueIds)
    setDetail(draft.issueDetail)
  }, [])

  const selectIssues = (next: string[]) => {
    setSelected(next)
    patchDraft({ issueIds: next })
  }

  const writeDetail = (next: string) => {
    setDetail(next)
    patchDraft({ issueDetail: next })
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-10 px-12">
        <div>
          <h2 id="what-happened" className="font-display text-k-h2 text-ink mb-8 text-center">
            {copy.h2}
          </h2>
          <ChipGrid
            issues={issues}
            selected={selected}
            onChange={selectIssues}
            labelledBy="what-happened"
          />
        </div>

        <div>
          <h3 id="tell-us-more" className="font-display text-k-h3 text-ink mb-3 text-center">
            {copy.h3}
          </h3>
          <p className="text-k-small text-ink-muted mb-5 text-center">{copy.support}</p>
          <textarea
            aria-labelledby="tell-us-more"
            value={detail}
            onChange={(event) => writeDetail(event.target.value)}
            rows={4}
            className="border-line-strong bg-surface text-k-body text-ink focus:border-accent w-full resize-none rounded-[20px] border-2 p-7 outline-none"
          />
        </div>
      </div>

      <div className="shrink-0 px-12 pt-4 pb-4">
        <BigButton fullWidth onClick={() => router.push('/comment')}>
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
