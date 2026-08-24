'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BigButton } from './BigButton'
import type { AppConfig } from '@/lib/config.types'

/**
 * The camera step — PHOTO_MODULE.md §3, §7.
 *
 * Capture and review happen in ONE frame. The video freezes into the photo in
 * the same box it was just filling, and the buttons underneath change from
 * "take one" to "keep it / try again". Nothing moves, nothing navigates, so a
 * guest never loses the thread of what they are looking at — it reads the way a
 * camera does, not the way a form does.
 *
 * Two things here are easy to get wrong and expensive to get wrong:
 *
 * THE MIRROR. The preview is flipped, because a person in front of a screen
 * expects a mirror and an unflipped preview makes everyone lean the wrong way.
 * The CAPTURE is never flipped, and is taken from the video track's own
 * resolution rather than from the preview element. Capturing what the preview
 * shows would print every T-shirt slogan and every tattoo backwards, and the
 * first anyone would know is a guest holding a reversed word.
 *
 * The review therefore shows the UNMIRRORED frame — the one that will print.
 * Approving a mirror and receiving its opposite is being shown the wrong thing.
 *
 * THE FILL LIGHT. A 24" panel at arm's length is a real softbox, and an Indian
 * café at 9pm is dim and flat. For the last stretch of the countdown the whole
 * screen ramps to near-white. No amount of CLAHE downstream rescues an
 * underexposed frame — the information is not in it.
 */

export type CapturedFrame = {
  /** Raw base64 JPEG, no data: prefix. Lives in memory only. */
  jpegBase64: string
  /** For the in-place preview. A data: URL, never a file. */
  previewUrl: string
  width: number
  height: number
}

type Phase = 'starting' | 'live' | 'counting' | 'review' | 'sending' | 'denied'

export function MemoryCapture({
  copy,
  onConfirm,
  onSkip,
}: {
  copy: AppConfig['memory']
  /** Resolves when the print has been attempted. Never rejects. */
  onConfirm: (frame: CapturedFrame, retries: number) => Promise<void>
  onSkip: (reason: 'declined' | 'no_camera') => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [remaining, setRemaining] = useState(copy.countdown_seconds)
  const [frame, setFrame] = useState<CapturedFrame | null>(null)
  const [retries, setRetries] = useState(0)
  const px = (n: number) => `calc(${n} * var(--kpx))`

  /**
   * Give the camera back.
   *
   * Called the moment the frame is taken, and again on unmount. The LED going
   * dark is the only signal a guest has that they are no longer being watched,
   * and leaving it lit while they decide whether they like the photo is a small
   * betrayal of the promise the offer screen just made.
   */
  const releaseCamera = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    for (const track of stream.getTracks()) track.stop()
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(async () => {
    try {
      // Label matching first, so a kiosk with a webcam AND a built-in camera
      // uses the one that is actually pointed at the guest.
      let deviceId: string | undefined
      if (copy.camera_label.trim() !== '' && navigator.mediaDevices.enumerateDevices) {
        const wanted = copy.camera_label.trim().toLowerCase()
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        deviceId = devices.find(
          (device) => device.kind === 'videoinput' && device.label.toLowerCase().includes(wanted),
        )?.deviceId
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // `ideal`, not `exact`: a camera that cannot manage the configured
          // resolution should give its closest match, not refuse outright and
          // cost the guest their print.
          width: { ideal: copy.camera_width },
          height: { ideal: copy.camera_height },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setPhase('live')
      return true
    } catch {
      return false
    }
  }, [copy.camera_label, copy.camera_width, copy.camera_height])

  useEffect(() => {
    let cancelled = false

    void start().then((ok) => {
      if (cancelled) {
        releaseCamera()
        return
      }
      if (!ok) {
        // Permission revoked, camera unplugged, driver asleep. §7: any failure
        // routes silently onward. The guest is never shown an error about a
        // free gift, and never learns something was meant to happen.
        setPhase('denied')
        onSkip('no_camera')
      }
    })

    return () => {
      cancelled = true
      releaseCamera()
    }
  }, [start, onSkip, releaseCamera])

  /**
   * Take the frame.
   *
   * From `videoWidth`/`videoHeight` — the track's real resolution — not from the
   * element's layout size. The preview is scaled to fit a kiosk panel, and
   * drawing from it would hand the pipeline a downscaled image to sharpen,
   * which is the one input CLAHE and unsharp cannot recover from.
   *
   * There is no `ctx.scale(-1, 1)` in this function. That is the whole point.
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

    // Quality 0.92: the pipeline throws away all but one bit per pixel, but it
    // runs auto-levels and CLAHE first, and JPEG blocking artefacts survive both
    // and then get amplified by the dither.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    // Wipe before letting go. Dimensions read above, because resizing a canvas
    // is what clears it.
    ctx.clearRect(0, 0, width, height)
    canvas.width = 1
    canvas.height = 1

    releaseCamera()
    setFrame({
      jpegBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      previewUrl: dataUrl,
      width,
      height,
    })
    setPhase('review')
  }, [onSkip, releaseCamera])

  useEffect(() => {
    if (phase !== 'counting') return
    if (remaining <= 0) {
      capture()
      return
    }
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, remaining, capture])

  const retake = useCallback(() => {
    setRetries((count) => count + 1)
    setFrame(null)
    setRemaining(copy.countdown_seconds)
    setPhase('starting')
    void start().then((ok) => {
      if (!ok) onSkip('no_camera')
    })
  }, [copy.countdown_seconds, onSkip, start])

  const confirm = useCallback(() => {
    if (!frame) return
    setPhase('sending')
    void onConfirm(frame, retries)
  }, [frame, onConfirm, retries])

  // Fill light over the last of the countdown. At one tick per second that is
  // the final two numerals.
  const flashing = phase === 'counting' && remaining <= 2
  const canRetry = retries < copy.max_retries

  if (phase === 'denied') return null

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ paddingInline: px(44) }}>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 transition-opacity duration-500 ease-out"
        style={{ background: '#fffef8', opacity: flashing ? 0.92 : 0 }}
      />

      {/* One frame. The video freezes into the photo without moving. */}
      <div className="k-card relative flex-1 overflow-hidden" style={{ borderRadius: px(28) }}>
        {frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frame.previewUrl}
            alt=""
            className="h-full w-full object-cover"
            // NOT mirrored — this is the frame that will print.
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={copy.mirror_preview ? { transform: 'scaleX(-1)' } : undefined}
          />
        )}

        {!frame ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ padding: px(18) }}
          >
            <div
              className="h-full w-full border-dashed"
              style={{
                borderWidth: px(3),
                borderColor: 'rgb(255 255 255 / 0.55)',
                borderRadius: px(20),
              }}
            />
          </div>
        ) : null}

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
        {phase === 'review' || phase === 'sending' ? (
          <>
            <p
              className="font-display text-k-h3 text-ink text-center"
              style={{ marginBottom: px(16) }}
            >
              {copy.review_heading}
            </p>

            <div className="flex flex-col" style={{ gap: px(12) }}>
              <BigButton
                fullWidth
                className="k-cta"
                disabled={phase === 'sending'}
                onClick={confirm}
              >
                {copy.keep_cta}
              </BigButton>

              {/*
                At the cap the retake button is GONE, not disabled. A greyed-out
                button invites a guest to keep pressing something that will not
                respond, which reads as broken; an absent one just moves them on.
              */}
              {canRetry && phase !== 'sending' ? (
                <BigButton fullWidth variant="secondary" className="k-cta" onClick={retake}>
                  {copy.retry_cta}
                </BigButton>
              ) : null}
            </div>

            {/*
              Shown the moment they confirm, in place, rather than on a screen of
              its own announcing what the system is doing. It is load-bearing:
              a guest who does not know a printer exists will walk away from a
              kiosk that is mid-print.
            */}
            {phase === 'sending' ? (
              <p
                className="text-k-small text-ink-soft text-center"
                style={{ marginTop: px(14) }}
                aria-live="polite"
              >
                {copy.collect_message}
              </p>
            ) : null}
          </>
        ) : (
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
        )}
      </div>
    </div>
  )
}
