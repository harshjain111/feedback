'use client'

import { useRef } from 'react'
import { FaceIcon } from './FaceIcon'
import type { RatingFace } from '@/lib/config.types'

/**
 * The five rating faces in one horizontal row — CLAUDE.md §5.
 *
 * The face is the PRIMARY interaction. Never stars, never a number the guest
 * has to interpret: colour must register before the label does.
 *
 * Labels sit under every face all the time, as in the approved reference —
 * a guest should not have to tap something to find out what it means. The
 * selected face gets a ring in its own colour and the others fade back, so the
 * choice is unmistakable from a standing distance.
 *
 * Rows come from `rating_scale`, so nothing here assumes there are five.
 */

type FaceScaleProps = {
  scale: RatingFace[]
  value: number | null
  onChange: (value: number) => void
  labelledBy?: string
  /** Face diameter in design px. */
  size?: number
}

export function FaceScale({ scale, value, onChange, labelledBy, size = 104 }: FaceScaleProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const px = (n: number) => `calc(${n} * var(--kpx))`

  const select = (next: number) => {
    onChange(next)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = scale.length - 1
    let target: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = Math.min(index + 1, last)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = Math.max(index - 1, 0)
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = last

    if (target === null) return
    event.preventDefault()

    const face = scale[target]
    if (!face) return
    select(face.value)
    refs.current[target]?.focus()
  }

  const focusIndex = Math.max(
    0,
    scale.findIndex((face) => face.value === value),
  )

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex w-full items-start justify-between"
      style={{ gap: px(6) }}
    >
      {scale.map((face, index) => {
        const selected = face.value === value
        const dimmed = value !== null && !selected

        return (
          <button
            key={face.scale_id}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={face.label}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => select(face.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className="k-tap flex flex-1 flex-col items-center rounded-[--radius-button] focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ gap: px(8), padding: px(4), outlineColor: face.colour }}
          >
            <span
              className="grid place-items-center rounded-full transition-[transform,box-shadow,opacity] duration-[--duration-kiosk] ease-[--ease-kiosk]"
              style={{
                transform: selected ? 'scale(1.06)' : 'scale(1)',
                boxShadow: selected
                  ? `0 0 0 calc(4 * var(--kpx)) var(--color-surface), 0 0 0 calc(9 * var(--kpx)) ${face.colour}`
                  : 'none',
                opacity: dimmed ? 0.4 : 1,
              }}
            >
              <FaceIcon faceKey={face.face_key} colour={face.colour} size={size} />
            </span>

            <span
              className="text-k-micro text-center leading-tight transition-colors duration-[--duration-kiosk]"
              style={{
                color: selected ? face.colour : 'var(--color-ink-muted)',
                fontWeight: selected ? 700 : 500,
                opacity: dimmed ? 0.6 : 1,
              }}
            >
              {face.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
