'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  const px = (n: number) => `calc(${n} * var(--kpx))`

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
   * the field above it without trying to guess the keyboard's height.
   */
  const onFocus = () => {
    window.setTimeout(() => {
      fieldRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 250)
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingInline: px(48) }}>
        <div className="flex min-h-full flex-col justify-center" style={{ paddingBlock: px(16) }}>
          <div className="flex justify-center" style={{ marginBottom: px(16) }}>
            <span
              className="bg-accent-soft text-accent text-k-micro rounded-chip font-medium"
              style={{ paddingInline: px(22), paddingBlock: px(8) }}
            >
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
            rows={6}
            aria-label={placeholder}
            className="k-card bg-surface text-k-body text-ink placeholder:text-ink-muted/60 focus:border-accent w-full resize-none outline-none"
            style={{ padding: px(26) }}
          />

          <p
            className="text-k-micro text-ink-muted text-right"
            aria-live="polite"
            style={{
              marginTop: px(10),
              visibility: comment.length >= COUNTER_FROM ? 'visible' : 'hidden',
            }}
          >
            {comment.length} / {MAX_LENGTH}
          </p>
        </div>
      </div>

      <div className="shrink-0" style={{ paddingInline: px(48), paddingBottom: px(20) }}>
        <BigButton fullWidth onClick={() => router.push('/followup')}>
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
