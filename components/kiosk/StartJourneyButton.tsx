'use client'

import { useRouter } from 'next/navigation'
import { BigButton } from './BigButton'
import { clearDraft } from '@/lib/session'

/**
 * The Welcome CTA.
 *
 * Clears any draft before navigating, so a journey abandoned before the idle
 * timer fired cannot bleed into the next guest's answers. The label comes from
 * config — this component never contains copy.
 */
export function StartJourneyButton({ label }: { label: string }) {
  const router = useRouter()

  return (
    <BigButton
      onClick={() => {
        clearDraft()
        router.push('/rate')
      }}
    >
      {label}
    </BigButton>
  )
}
