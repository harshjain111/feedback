'use client'

import { useRouter } from 'next/navigation'
import { CircleCheck, CircleSlash } from 'lucide-react'
import { BigButton } from './BigButton'
import { patchDraft } from '@/lib/session'

/**
 * "Would you like us to follow up?" (§5).
 *
 * Two equal-weight buttons, stacked so neither is the wider one. Pushing either
 * would be manipulation (§14.3) — and a guest who declines contact is giving a
 * real answer, not failing to give the right one.
 *
 * Resolution, not escalation: the words "complaint", "lodge" and "manager"
 * appear nowhere, and a seed test asserts it.
 */
export function FollowUpChoice({
  yesLabel,
  yesSubLabel,
  noLabel,
}: {
  yesLabel: string
  yesSubLabel: string
  noLabel: string
}) {
  const router = useRouter()
  const px = (n: number) => `calc(${n} * var(--kpx))`
  const icon = (Node: typeof CircleCheck) => (
    <Node style={{ width: px(30), height: px(30) }} strokeWidth={1.8} aria-hidden="true" />
  )

  const answer = (followUpRequested: boolean) => {
    patchDraft({ followUpRequested })
    router.push('/contact')
  }

  return (
    <div
      className="flex shrink-0 flex-col"
      style={{ gap: px(16), paddingInline: px(40), paddingBottom: px(20) }}
    >
      <BigButton
        fullWidth
        icon={icon(CircleCheck)}
        subLabel={yesSubLabel}
        onClick={() => answer(true)}
      >
        {yesLabel}
      </BigButton>
      <BigButton
        fullWidth
        variant="secondary"
        icon={icon(CircleSlash)}
        onClick={() => answer(false)}
      >
        {noLabel}
      </BigButton>
    </div>
  )
}
