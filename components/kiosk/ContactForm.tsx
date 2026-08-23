'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import type { AppConfig } from '@/lib/config.types'
import { getDraft, patchDraft } from '@/lib/session'
import { isValidPhone } from '@/lib/validation'

/**
 * Name and mobile number — BOTH optional, always (§5, §11).
 *
 * SKIP is a full-size button sitting next to the primary one, not a grey link
 * in a corner. If the guest asked to be followed up, the subheading changes to
 * explain why a number helps — but the field stays optional and SKIP stays
 * exactly as reachable. Nothing here ever blocks.
 */
export function ContactForm({
  copy,
  consentText,
}: {
  copy: AppConfig['contact']
  consentText: string
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [followUpRequested, setFollowUpRequested] = useState(false)
  const [touchedPhone, setTouchedPhone] = useState(false)

  useEffect(() => {
    const draft = getDraft()
    setName(draft.name)
    setPhone(draft.phone)
    setFollowUpRequested(draft.followUpRequested === true)
  }, [])

  // Only ever complains about something the guest actually typed.
  const phoneLooksWrong = touchedPhone && phone.trim() !== '' && !isValidPhone(phone)

  const finish = (keepDetails: boolean) => {
    patchDraft(keepDetails ? { name: name.trim(), phone: phone.trim() } : { name: '', phone: '' })
    router.push('/thanks')
  }

  return (
    <>
      <header className="shrink-0 px-12 pt-12 pb-4 text-center">
        <h1 className="font-display text-k-h1 text-ink text-balance">{copy.h1}</h1>
        {/*
          The variant subheading depends on an answer that only exists in the
          draft, so this header is rendered client-side. Both strings come from
          config; neither is typed here.
        */}
        <p className="text-k-lead text-ink-muted mx-auto mt-5 max-w-[860px] text-pretty">
          {followUpRequested ? copy.followup_sub : copy.support}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-8 px-12">
        <label className="block">
          <span className="text-k-small text-ink-muted mb-3 block">{copy.name_label}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              patchDraft({ name: event.target.value })
            }}
            autoComplete="name"
            className="border-line-strong bg-surface text-k-body text-ink focus:border-accent w-full rounded-[20px] border-2 px-8 py-6 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-k-small text-ink-muted mb-3 block">{copy.phone_label}</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              patchDraft({ phone: event.target.value })
            }}
            onBlur={() => setTouchedPhone(true)}
            autoComplete="tel"
            aria-invalid={phoneLooksWrong}
            aria-describedby={phoneLooksWrong ? 'phone-hint' : undefined}
            className="border-line-strong bg-surface text-k-body text-ink focus:border-accent w-full rounded-[20px] border-2 px-8 py-6 outline-none aria-[invalid=true]:border-[color:var(--color-rating-2)]"
          />
          {phoneLooksWrong ? (
            <span
              id="phone-hint"
              className="text-k-micro mt-3 block text-[color:var(--color-rating-2)]"
            >
              {/* A hint, not a gate: SKIP and the primary button both still work. */}
              10 digits, starting 6–9
            </span>
          ) : null}
        </label>

        <p className="text-k-micro text-ink-muted max-w-[880px] text-pretty">{consentText}</p>
      </div>

      <div className="shrink-0 px-12 pt-4 pb-4">
        <div className="flex gap-6">
          <BigButton fullWidth onClick={() => finish(true)}>
            {copy.cta}
          </BigButton>
          <BigButton variant="secondary" onClick={() => finish(false)}>
            {copy.skip}
          </BigButton>
        </div>
        <p className="text-k-micro text-ink-muted mt-5 text-center">{copy.micro}</p>
      </div>
    </>
  )
}
