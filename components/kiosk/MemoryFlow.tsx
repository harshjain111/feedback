'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MemoryCapture, type CapturedFrame } from './MemoryCapture'
import { MemoryOffer } from './MemoryOffer'
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
 * Capture, review and print are ONE step now, in one frame: the video freezes
 * into the photo where it stood, the buttons change, and confirming prints
 * without announcing itself. There is no screen that tells a guest the system is
 * working — they see their picture, they say yes, and the paper comes out.
 *
 * ROUTE GUARD — rule 1. This mounts only when the draft carries a feedbackCode,
 * which exists only after POST /api/feedback returned. A guest who somehow lands
 * here without one goes to thank-you and the camera is never asked for. The
 * feedback is safe before the lens ever opens.
 */

type Step = 'offer' | 'capture'

export function MemoryFlow({ copy }: { copy: AppConfig['memory'] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('offer')
  const [ready, setReady] = useState(false)
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral')
  /** Guards against a double-tap on the confirm button sending two jobs. */
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

  /**
   * Print, then leave. Never throws, never reports.
   *
   * The wait after a successful print is not decoration: it is long enough to
   * read where the paper comes out and to notice it arriving. Cutting straight
   * to thank-you leaves people walking away from a print they never saw.
   *
   * A failure gets no wait and no explanation — same exit, nothing said (§7).
   */
  const confirm = useCallback(
    async (frame: CapturedFrame, retries: number) => {
      if (printing.current) return
      printing.current = true

      const result = await sendPrint({
        jpegBase64: frame.jpegBase64,
        caption: sentiment === 'negative' ? copy.caption_line_negative : copy.caption_line,
        dateLabel: `${copy.footer_line} · ${kioskDateLabel()}`,
        share: copy.printer_share,
        copies: copy.print_copies,
      })

      // Uptake only. No image, no caption, no dimensions (§12).
      void recordMemoryOutcome({ printed: result.ok, retries })

      if (result.ok) {
        await new Promise((resolve) => window.setTimeout(resolve, 2600))
      }
      leave()
    },
    [copy, leave, sentiment],
  )

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
        <MemoryCapture copy={copy} onConfirm={confirm} onSkip={leave} />
      ) : null}

    </>
  )
}
