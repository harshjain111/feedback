'use client'

import { useRouter } from 'next/navigation'
import { BigButton } from './BigButton'
import { PrefetchNext } from './PrefetchNext'
import { clearDraft } from '@/lib/session'

/**
 * The Welcome CTA.
 *
 * Clears any draft before navigating, so a journey abandoned before the idle
 * timer fired cannot bleed into the next guest's answers. The label comes from
 * config — this component never contains copy.
 *
 * No arrow icon: §5 locks the label as "SHARE YOUR FEEDBACK →", arrow included.
 * Adding a lucide arrow on top rendered the button with two of them.
 */
export function StartJourneyButton({ label }: { label: string }) {
  const router = useRouter()

  return (
    <>
      <PrefetchNext routes={['/rate']} />
      <BigButton
        className="k-cta"
        onClick={() => {
          clearDraft()
          router.push('/rate')
        }}
      >
        {label}
      </BigButton>
    </>
  )
}
