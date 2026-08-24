'use client'

import { BigButton } from './BigButton'
import type { CapturedFrame } from './MemoryCapture'
import type { AppConfig } from '@/lib/config.types'

/**
 * "Happy with this one?" — PHOTO_MODULE.md §7, §9.
 *
 * The retry cap is the operational detail here. Three retakes, then KEEP is the
 * only option: without it one table can hold the kiosk during the 9pm exit rush
 * while everyone behind them waits, which costs far more feedback than a
 * slightly unflattering photo does.
 *
 * When the cap is reached the RETRY button is not disabled, it is gone. A
 * greyed-out button invites a guest to keep pressing something that will not
 * respond, which reads as broken; an absent one just moves them on.
 *
 * The preview is shown UNMIRRORED — the same frame that will print. A guest who
 * approves a mirrored preview and receives its opposite has been shown the
 * wrong thing, and any writing in shot is where they will notice.
 */
export function MemoryReview({
  copy,
  frame,
  retries,
  onRetry,
  onKeep,
}: {
  copy: AppConfig['memory']
  frame: CapturedFrame
  retries: number
  onRetry: () => void
  onKeep: () => void
}) {
  const px = (n: number) => `calc(${n} * var(--kpx))`
  const canRetry = retries < copy.max_retries

  return (
    <>
      <header className="shrink-0 text-center" style={{ paddingInline: px(48), paddingTop: px(8) }}>
        <h1 className="font-display text-k-h2 text-ink text-balance">{copy.review_heading}</h1>
      </header>

      <div
        className="flex min-h-0 flex-1 items-center justify-center"
        style={{ paddingInline: px(44), paddingBlock: px(20) }}
      >
        <div className="k-card overflow-hidden" style={{ borderRadius: px(28) }}>
          {/*
            A plain img, not next/image. This src is a data: URL held in memory
            for a few seconds — never a file, never on a server. next/image
            would want to fetch and optimise something that must not leave the
            machine.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frame.previewUrl}
            alt=""
            className="block h-full w-full object-contain"
            style={{ maxHeight: px(960) }}
          />
        </div>
      </div>

      <div className="k-cta-dock shrink-0" style={{ paddingInline: px(44), paddingBottom: px(20) }}>
        <div className="flex flex-col" style={{ gap: px(12) }}>
          <BigButton fullWidth className="k-cta" onClick={onKeep}>
            {copy.keep_cta}
          </BigButton>
          {canRetry ? (
            <BigButton fullWidth variant="secondary" className="k-cta" onClick={onRetry}>
              {copy.retry_cta}
            </BigButton>
          ) : null}
        </div>
      </div>
    </>
  )
}

/**
 * "Printing your memory…" — §9.
 *
 * Deliberately not a progress bar. The agent takes a few seconds and cannot
 * report how far through it is, so a bar would be a fiction; a breathing mark
 * says "working" without claiming to know when it will finish.
 *
 * "Collect it just below the screen" is the load-bearing line. A guest who does
 * not know a printer exists will walk away from a kiosk that is mid-print.
 */
export function MemoryPrinting({ copy }: { copy: AppConfig['memory'] }) {
  const px = (n: number) => `calc(${n} * var(--kpx))`

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"
      style={{ paddingInline: px(56) }}
    >
      <span
        className="k-breathe grid place-items-center rounded-full"
        style={{
          width: px(160),
          height: px(160),
          background: 'var(--color-accent-soft)',
          color: 'var(--color-accent)',
        }}
      >
        <svg viewBox="0 0 100 100" style={{ width: px(84), height: px(84) }} aria-hidden="true">
          <rect
            x="24"
            y="34"
            width="52"
            height="34"
            rx="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
          />
          <path d="M34 34 V22 h32 v12" fill="none" stroke="currentColor" strokeWidth="5" />
          <path d="M34 60 h32 v20 h-32 z" fill="none" stroke="currentColor" strokeWidth="5" />
        </svg>
      </span>

      <h1 className="font-display text-k-h2 text-ink" style={{ marginTop: px(44) }}>
        {copy.printing_message}
      </h1>

      <p className="text-k-lead text-ink-soft" style={{ marginTop: px(20) }}>
        {copy.collect_message}
      </p>
    </div>
  )
}
