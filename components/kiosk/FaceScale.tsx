'use client'

import { useId, useRef } from 'react'
import { FaceIcon } from './FaceIcon'
import type { RatingFace } from '@/lib/config.types'
import { cn } from '@/lib/cn'

/**
 * The five rating faces in one horizontal row — CLAUDE.md §5.
 *
 * The face is the PRIMARY interaction. Never stars, never a number the guest
 * has to interpret: colour must register before the label does. The rows come
 * from the `rating_scale` table, so the labels, colours and even the number of
 * steps are CMS-editable and nothing here assumes five.
 *
 * Accessibility: a real radiogroup with roving tabindex and arrow-key movement,
 * labelled from the DB row. A kiosk is rarely driven by keyboard, but a screen
 * reader on a guest's own device should still make sense of it.
 */

type FaceScaleProps = {
  scale: RatingFace[]
  value: number | null
  onChange: (value: number) => void
  /** id of the element that names this group — usually the category question. */
  labelledBy?: string
  /** Face diameter in px. Tap targets must stay >= 140 on the kiosk (§6). */
  size?: number
}

export function FaceScale({ scale, value, onChange, labelledBy, size = 140 }: FaceScaleProps) {
  const groupId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const select = (next: number) => {
    onChange(next)
    // Haptic-style confirmation where the device offers it (§6).
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

  // Roving tabindex: the chosen face owns the tab stop, or the first one before
  // any choice is made.
  const focusIndex = Math.max(
    0,
    scale.findIndex((face) => face.value === value),
  )

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      id={groupId}
      className="flex w-full items-start justify-between gap-2"
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
            className={cn(
              'rounded-card focus-visible:outline-accent flex flex-col items-center gap-3 p-1',
              'focus-visible:outline-4 focus-visible:outline-offset-2',
            )}
          >
            <span
              className={cn(
                'grid place-items-center rounded-full',
                'transition-[transform,box-shadow,opacity] duration-[--duration-kiosk] ease-[--ease-kiosk]',
              )}
              style={{
                transform: selected ? 'scale(1.08)' : 'scale(1)',
                boxShadow: selected ? `0 0 0 10px ${face.colour}33` : 'none',
                opacity: dimmed ? 0.38 : 1,
              }}
            >
              <FaceIcon faceKey={face.face_key} colour={face.colour} size={size} />
            </span>

            <span
              className="text-k-small transition-colors duration-[--duration-kiosk]"
              style={{
                color: selected ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                fontWeight: selected ? 600 : 400,
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
