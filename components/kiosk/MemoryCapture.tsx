'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BigButton } from './BigButton'
import type { AppConfig } from '@/lib/config.types'

/**
 * The camera step of the Memory Print Module — PHOTO_MODULE.md §3.
 *
 * Two things here are easy to get wrong and expensive to get wrong:
 *
 * THE MIRROR. The preview is flipped, because a person in front of a screen
 * expects a mirror and an unflipped preview makes everyone lean the wrong way.
 * The CAPTURE is not flipped, and is taken from the video track's own
 * resolution rather than from the preview element. Capturing what the preview
 * shows would print every T-shirt slogan and every tattoo backwards, and the
 * first anyone would know is a guest holding a reversed word.
 *
 * THE FILL LIGHT. A 24" panel at arm's length is a real softbox, and an Indian
 * café at 9pm is dim and flat. For the last stretch of the countdown the whole
 * screen ramps to near-white. No amount of CLAHE downstream rescues an
 * underexposed frame — the information is not in it.
 */

export type CapturedFrame = {
  /** Raw base64 JPEG, no data: prefix. Lives in memory only. */
  jpegBase64: string
  /** For the review step's <img>. Revoked when the frame is dropped. */
  previewUrl: string
  width: number
  height: number
}

type Phase = 'starting' | 'live' | 'counting' | 'captured' | 'denied'

export function MemoryCapture({
  copy,
  onCaptured,
  onSkip,
}: {
  copy: AppConfig['memory']
  onCaptured: (frame: CapturedFrame) => void
  onSkip: (reason: 'declined' | 'no_camera') => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [remaining, setRemaining] = useState(copy.countdown_seconds)
  const px = (n: number) => `calc(${n} * var(--kpx))`

  /**
   * Give the camera back.
   *
   * Called on unmount and immediately after the frame is taken. The LED going
   * dark is the only signal a guest has that they are no longer being watched,
   * and leaving it lit while they read a caption is a small betrayal of the
   * promise the offer screen just made.
   */
  const releaseCamera = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    for (const track of stream.getTracks()) track.stop()
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user',
          },
          audio: false,
        })

        if (cancelled) {
          for (const track of stream.getTracks()) track.stop()
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setPhase('live')
      } catch {
        // Permission revoked, camera unplugged, driver asleep. §7: any failure
        // routes silently onward. The guest is never shown an error about a
        // free gift, and never learns something was meant to happen.
        if (!cancelled) {
          setPhase('denied')
          onSkip('no_camera')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      releaseCamera()
    }
  }, [onSkip, releaseCamera])

  /**
   * Take the frame.
   *
   * From `videoWidth`/`videoHeight` — the track's real resolution — not from the
   * element's layout size. The preview is scaled to fit a kiosk panel and
   * drawing from it would hand the pipeline a downscaled image to sharpen,
   * which is the one input CLAHE and unsharp cannot recover from.
   *
   * No `ctx.scale(-1, 1)` anywhere in this function. That is the whole point.
   */
  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      onSkip('no_camera')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      onSkip('no_camera')
      return
    }

    const width = canvas.width
    const height = canvas.height
    ctx.drawImage(video, 0, 0, width, height)

    // Quality 0.92: the pipeline is about to throw away all but one bit per
    // pixel, but it does auto-levels and CLAHE first, and JPEG blocking artefacts
    // survive both and then get amplified by the dither.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpegBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1)

    // Wipe the canvas before letting it go. Same reasoning as the agent zeroing
    // its buffers: the frame should not outlive the moment it is needed.
    // Dimensions are read above, because resizing a canvas is what clears it.
    ctx.clearRect(0, 0, width, height)
    canvas.width = 1
    canvas.height = 1

    setPhase('captured')
    releaseCamera()

    onCaptured({ jpegBase64, previewUrl: dataUrl, width, height })
  }, [onCaptured, onSkip, releaseCamera])

  // The countdown.
  useEffect(() => {
    if (phase !== 'counting') return

    if (remaining <= 0) {
      capture()
      return
    }

    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, remaining, capture])

  // Fill light over the last 1.5s, which at one tick per second means the final
  // two numerals.
  const flashing = phase === 'counting' && remaining <= 2

  if (phase === 'denied') return null

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ paddingInline: px(44) }}>
      {/*
        The fill light. Fixed and full-bleed so it lights the guest's face, not
        just the area behind the video. pointer-events-none so it can never
        swallow a tap on SKIP.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 transition-opacity duration-500 ease-out"
        style={{ background: '#fffef8', opacity: flashing ? 0.92 : 0 }}
      />

      <div
        className="k-card relative flex-1 overflow-hidden"
        style={{ borderRadius: px(28) }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          // MIRRORED. Preview only — see capture() for why this flip must not
          // reach the canvas.
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* 4:5 guide, inset enough to hold four people at a table. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ padding: px(18) }}
        >
          <div
            className="h-full w-full rounded-[inherit] border-dashed"
            style={{
              borderWidth: px(3),
              borderColor: 'rgb(255 255 255 / 0.55)',
              borderRadius: px(20),
            }}
          />
        </div>

        {phase === 'counting' ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span
              className="font-display text-white tabular-nums"
              style={{
                fontSize: px(280),
                lineHeight: 1,
                textShadow: `0 0 ${px(40)} rgb(0 0 0 / 0.45)`,
              }}
            >
              {remaining}
            </span>
          </div>
        ) : null}
      </div>

      <div className="k-cta-dock shrink-0" style={{ paddingBlock: px(20) }}>
        <div className="flex flex-col" style={{ gap: px(12) }}>
          <BigButton
            fullWidth
            className="k-cta"
            disabled={phase !== 'live'}
            onClick={() => {
              setRemaining(copy.countdown_seconds)
              setPhase('counting')
            }}
          >
            {copy.take_cta}
          </BigButton>
          <BigButton
            fullWidth
            variant="secondary"
            className="k-cta"
            onClick={() => {
              releaseCamera()
              onSkip('declined')
            }}
          >
            {copy.skip_cta}
          </BigButton>
        </div>
      </div>
    </div>
  )
}
