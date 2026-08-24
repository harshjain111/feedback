'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MemoryCapture, type CapturedFrame } from './MemoryCapture'
import { MemoryOffer } from './MemoryOffer'
import { PrefetchNext } from './PrefetchNext'
import type { AppConfig } from '@/lib/config.types'
import { ratingValues, sentimentFor } from '@/lib/journey'
import { getDraft } from '@/lib/session'

/**
 * The Memory Print Module, as ONE route with internal steps.
 *
 * Not three pages, and the reason is rule 2 rather than taste. Navigating
 * between pages would mean parking the captured frame somewhere that survives
 * the navigation, and the only options in a browser are sessionStorage or
 * localStorage — both of which the browser writes to disk. A base64 photograph
 * in sessionStorage IS the photo written to the machine, which is exactly what
 * "the image never leaves the machine, and never touches disk" forbids.
 *
 * So the frame lives in a React ref for as long as it takes to print, and dies
 * with the page. Splitting this into routes later would quietly break the
 * module's central promise, which is why it is written down here.
 *
 * ROUTE GUARD — rule 1. This mounts only when the draft carries a feedbackCode,
 * which exists only after POST /api/feedback returned. A guest who somehow
 * lands here without one goes to thank-you and the camera is never asked for.
 * The feedback is safe before the lens ever opens.
 */

type Step = 'offer' | 'capture' | 'done'

export function MemoryFlow({ copy }: { copy: AppConfig['memory'] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('offer')
  const [ready, setReady] = useState(false)
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral')

  /**
   * The captured frame. A ref, not state, and never storage — see above.
   * Prompt 50 reads this for the review and the print.
   */
  const frameRef = useRef<CapturedFrame | null>(null)

  const leave = useCallback(() => {
    // Drop the frame before navigating. The object URL would otherwise hold the
    // decoded image alive in the compositor until GC got round to it.
    const frame = frameRef.current
    if (frame?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(frame.previewUrl)
    frameRef.current = null
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
          onCaptured={(frame) => {
            frameRef.current = frame
            // Prompt 50 puts the review and the print here. Until then a
            // captured frame goes no further, which is the safe half-state:
            // nothing is printed and nothing is kept.
            setStep('done')
            leave()
          }}
          onSkip={leave}
        />
      ) : null}
    </>
  )
}
