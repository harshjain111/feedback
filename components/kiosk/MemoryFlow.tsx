'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MemoryCapture, type CapturedFrame } from './MemoryCapture'
import { MemoryOffer } from './MemoryOffer'
import { MemoryPrinting, MemoryReview } from './MemoryReview'
import { PrefetchNext } from './PrefetchNext'
import type { AppConfig } from '@/lib/config.types'
import { ratingValues, sentimentFor } from '@/lib/journey'
import { kioskDateLabel, sendPrint } from '@/lib/kiosk/print-agent'
import { recordMemoryOutcome } from '@/lib/kiosk/submit'
import { getDraft } from '@/lib/session'

/**
 * The Memory Print Module, as ONE route with internal steps.
 *
 * Not three pages, and the reason is rule 2 rather than taste. Navigating
 * between pages would mean parking the captured frame somewhere that survives
 * the navigation, and the only options a browser offers are sessionStorage and
 * localStorage — both written to disk. A base64 photograph in sessionStorage IS
 * the photo written to the machine, which is exactly what "the image never
 * leaves the machine, and never touches disk" forbids.
 *
 * So the frame lives in a React ref for as long as it takes to print, and dies
 * with the page. Splitting this into routes later would quietly break the
 * module's central promise, which is why it is written down here.
 *
 * ROUTE GUARD — rule 1. This mounts only when the draft carries a feedbackCode,
 * which exists only after POST /api/feedback returned. A guest who somehow lands
 * here without one goes to thank-you and the camera is never asked for. The
 * feedback is safe before the lens ever opens.
 */

type Step = 'offer' | 'capture' | 'review' | 'printing'

export function MemoryFlow({ copy }: { copy: AppConfig['memory'] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('offer')
  const [ready, setReady] = useState(false)
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral')
  const [frame, setFrame] = useState<CapturedFrame | null>(null)
  const [retries, setRetries] = useState(0)

  /** Guards against a double-tap on PRINT IT sending two jobs. */
  const printing = useRef(false)

  /**
   * Leave for thank-you, dropping the frame first.
   *
   * Every exit from this module goes through here, including every failure.
   * §7: no camera permission, agent unreachable, out of paper, timeout — all of
   * them route SILENTLY onward. A guest is never shown an error message about a
   * free gift; they simply reach the thank-you screen they were always going to
   * reach, none the wiser that anything was meant to happen.
   */
  const leave = useCallback(() => {
    setFrame((current) => {
      if (current?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    router.replace('/thanks')
  }, [router])

  useEffect(() => {
    const draft = getDraft()

    // Rule 1. No committed feedback, no camera.
    if (draft.feedbackCode === null) {
      router.replace('/thanks')
      return
    }

    setSentiment(sentimentFor(ratingValues(draft.ratings)))
    setReady(true)
  }, [router])

  /**
   * The offer was shown. Recorded when the guest first sees it, not when they
   * accept — `memory_offered` is the denominator for uptake, so it has to count
   * the people who said no.
   */
  useEffect(() => {
    if (!ready) return
    void recordMemoryOutcome({ offered: true })
  }, [ready])

  const print = useCallback(async () => {
    if (printing.current || !frame) return
    printing.current = true
    setStep('printing')

    const result = await sendPrint({
      jpegBase64: frame.jpegBase64,
      caption: sentiment === 'negative' ? copy.caption_line_negative : copy.caption_line,
      dateLabel: `${copy.footer_line} · ${kioskDateLabel()}`,
    })

    // Uptake only. No image, no caption, no dimensions (§12).
    void recordMemoryOutcome({ printed: result.ok, retries })

    if (result.ok) {
      // Long enough to read "collect it just below the screen" and notice the
      // paper. Cutting straight to thank-you leaves people walking away from a
      // print they never saw come out.
      window.setTimeout(leave, 2600)
      return
    }

    // Failed. Same exit, no explanation. Prompt 51's auto-disable is what stops
    // the next guest being offered something the printer cannot deliver.
    leave()
  }, [copy, frame, leave, retries, sentiment])

  // Nothing renders until the guard has run, so a guest never sees a flash of
  // the offer on a journey that should not have reached it.
  if (!ready) return null

  return (
    <>
      <PrefetchNext routes={['/thanks']} />

      {step === 'offer' ? (
        <MemoryOffer
          copy={copy}
          sentiment={sentiment}
          onTake={() => setStep('capture')}
          onSkip={leave}
        />
      ) : null}

      {step === 'capture' ? (
        <MemoryCapture
          copy={copy}
          onCaptured={(captured) => {
            setFrame(captured)
            setStep('review')
          }}
          onSkip={leave}
        />
      ) : null}

      {step === 'review' && frame ? (
        <MemoryReview
          copy={copy}
          frame={frame}
          retries={retries}
          onRetry={() => {
            setRetries((count) => count + 1)
            setFrame(null)
            setStep('capture')
          }}
          onKeep={() => void print()}
        />
      ) : null}

      {step === 'printing' ? <MemoryPrinting copy={copy} /> : null}
    </>
  )
}
