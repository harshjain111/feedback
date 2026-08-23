'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { BigButton } from './BigButton'
import { getDraft, patchDraft } from '@/lib/session'

/** Counter appears only past this length — never a pressure gauge from keystroke one. */
const COUNTER_FROM = 400
const MAX_LENGTH = 2000

export function CommentForm({
  placeholder,
  badge,
  continueLabel,
}: {
  placeholder: string
  badge: string
  continueLabel: string
}) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setComment(getDraft().comment)
  }, [])

  const write = (next: string) => {
    setComment(next)
    patchDraft({ comment: next })
  }

  /**
   * The one screen allowed to scroll (§6), and only because the on-screen
   * keyboard eats the bottom half of a tablet. scrollIntoView on focus keeps
   * the field above it without us trying to guess the keyboard's height.
   */
  const onFocus = () => {
    window.setTimeout(() => {
      fieldRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 250)
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-12">
        <div className="flex min-h-full flex-col justify-center py-6">
          <div className="mb-5 flex justify-center">
            <span className="bg-accent-soft text-accent text-k-micro rounded-chip px-6 py-2 font-medium">
              {badge}
            </span>
          </div>

          <textarea
            ref={fieldRef}
            value={comment}
            onChange={(event) => write(event.target.value)}
            onFocus={onFocus}
            placeholder={placeholder}
            maxLength={MAX_LENGTH}
            rows={7}
            aria-label={placeholder}
            className="border-line-strong bg-surface text-k-body text-ink placeholder:text-ink-muted/60 focus:border-accent w-full resize-none rounded-[20px] border-2 p-8 outline-none"
          />

          <p
            className="text-k-micro text-ink-muted mt-3 text-right"
            aria-live="polite"
            style={{ visibility: comment.length >= COUNTER_FROM ? 'visible' : 'hidden' }}
          >
            {comment.length} / {MAX_LENGTH}
          </p>
        </div>
      </div>

      <div className="shrink-0 px-12 pt-2 pb-4">
        <BigButton fullWidth onClick={() => router.push('/followup')}>
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
