'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
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
      <ArrowRight
        style={{ width: 'calc(26 * var(--kpx))', height: 'calc(26 * var(--kpx))' }}
        strokeWidth={2.4}
        aria-hidden="true"
        className="ml-[calc(10*var(--kpx))] inline"
      />
    </BigButton>
  )
}
