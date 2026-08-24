'use client'

import { ShieldCheck } from 'lucide-react'
import { BigButton } from './BigButton'
import type { AppConfig } from '@/lib/config.types'

/**
 * "Before you go — take a memory with you" (PHOTO_MODULE.md §7, §9).
 *
 * The offer is unconditional and this component is where that is either honoured
 * or quietly broken. CLAUDE.md §14.3 governs it absolutely: the same gift for a
 * 1/5 guest and a 5/5 guest, never mentioned during rating, never conditioned on
 * anything.
 *
 * What DOES change is the register. A guest who waited forty minutes for cold
 * food does not want a cheerful "smile!" — it reads as papering over the
 * complaint they just made. So the negative branch gets its own copy set:
 * sincere instead of upbeat, and explicitly not a lesser offer.
 *
 * SKIP is a full-size button under the primary one. Never a small grey link —
 * a guest who does not want to be photographed should not have to hunt.
 */
export function MemoryOffer({
  copy,
  sentiment,
  onTake,
  onSkip,
}: {
  copy: AppConfig['memory']
  sentiment: 'positive' | 'neutral' | 'negative'
  onTake: () => void
  onSkip: () => void
}) {
  const px = (n: number) => `calc(${n} * var(--kpx))`
  const negative = sentiment === 'negative'

  const heading = negative ? copy.negative_offer_heading : copy.offer_heading
  const body = negative ? copy.negative_offer_body : copy.offer_body

  return (
    <>
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"
        style={{ paddingInline: px(56), paddingTop: px(34) }}
      >
        <h1 className="font-display text-k-h1 text-ink text-balance">{heading}</h1>

        <p
          className="text-k-lead text-ink-soft text-pretty"
          style={{ marginTop: px(24), maxWidth: px(840) }}
        >
          {body}
        </p>

        {/*
          Rule 2, said plainly and before the guest decides — not in a policy
          page they will never open. Somebody weighing whether to be
          photographed in a café is owed this at the moment of the decision.
        */}
        <p
          className="text-k-small text-ink-soft flex items-start rounded-[--radius-button]"
          style={{
            gap: px(12),
            padding: px(20),
            marginTop: px(40),
            maxWidth: px(760),
            background: 'var(--color-accent-soft)',
          }}
        >
          <ShieldCheck
            aria-hidden="true"
            className="text-accent shrink-0"
            style={{ width: px(26), height: px(26) }}
            strokeWidth={1.8}
          />
          <span className="text-pretty text-left">{copy.privacy_line}</span>
        </p>
      </div>

      <div className="k-cta-dock shrink-0" style={{ paddingInline: px(48), paddingBottom: px(20) }}>
        <div className="flex flex-col" style={{ gap: px(12) }}>
          <BigButton fullWidth className="k-cta" onClick={onTake}>
            {copy.take_cta}
          </BigButton>
          <BigButton fullWidth variant="secondary" className="k-cta" onClick={onSkip}>
            {copy.skip_cta}
          </BigButton>
        </div>
      </div>
    </>
  )
}
