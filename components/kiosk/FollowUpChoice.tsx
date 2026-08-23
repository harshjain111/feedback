'use client'

import { useRouter } from 'next/navigation'
import { BigButton } from './BigButton'
import { patchDraft } from '@/lib/session'

/**
 * "Would you like us to follow up?" (§5).
 *
 * Two equal-weight buttons. Neither is visually pushed, because pushing one
 * would be manipulation (§14.3) — and because a guest who declines contact is
 * giving a real answer, not failing to give the right one.
 *
 * This is resolution, not escalation: the words "complaint", "lodge" and
 * "manager" appear nowhere on this screen, and a seed test asserts it.
 */
export function FollowUpChoice({ yesLabel, noLabel }: { yesLabel: string; noLabel: string }) {
  const router = useRouter()

  const answer = (followUpRequested: boolean) => {
    patchDraft({ followUpRequested })
    router.push('/contact')
  }

  return (
    <div className="flex shrink-0 gap-8 px-12 pb-4">
      <BigButton fullWidth onClick={() => answer(true)}>
        {yesLabel}
      </BigButton>
      <BigButton fullWidth variant="secondary" onClick={() => answer(false)}>
        {noLabel}
      </BigButton>
    </div>
  )
}
