'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Phone, ShieldCheck, User } from 'lucide-react'
import { BigButton } from './BigButton'
import type { AppConfig } from '@/lib/config.types'
// From lib/phone, not lib/validation: the latter imports zod, which has no
// business in the kiosk bundle (§6).
import { isValidPhone } from '@/lib/phone'
import { getDraft, patchDraft } from '@/lib/session'

/**
 * Name and mobile number — BOTH optional, always (§5, §11).
 *
 * SKIP is a full-size button under the primary one, not a grey link in a
 * corner. If the guest asked to be followed up the subheading changes to
 * explain why a number helps, but the field stays optional and SKIP stays
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
  const px = (n: number) => `calc(${n} * var(--kpx))`

  useEffect(() => {
    const draft = getDraft()
    setName(draft.name)
    setPhone(draft.phone)
    setFollowUpRequested(draft.followUpRequested === true)
  }, [])

  // Only ever complains about something the guest actually typed.
  const phoneLooksWrong = touchedPhone && phone.trim() !== '' && !isValidPhone(phone)
  const phoneLooksRight = phone.trim() !== '' && isValidPhone(phone)

  const finish = (keepDetails: boolean) => {
    patchDraft(keepDetails ? { name: name.trim(), phone: phone.trim() } : { name: '', phone: '' })
    router.push('/thanks')
  }

  const fieldClass =
    'k-card text-k-body text-ink focus:border-accent w-full outline-none bg-surface'

  return (
    <>
      <header className="shrink-0 text-center" style={{ paddingInline: px(48), paddingTop: px(8) }}>
        <h1 className="font-display text-k-h1 text-ink text-balance">{copy.h1}</h1>
        {/*
          The variant subheading depends on an answer that only exists in the
          draft, so this header renders client-side. Both strings come from
          config; neither is typed here.
        */}
        <p
          className="text-k-lead text-ink-muted mx-auto text-pretty"
          style={{ marginTop: px(14), maxWidth: px(860) }}
        >
          {followUpRequested ? copy.followup_sub : copy.support}
        </p>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col justify-center"
        style={{ gap: px(20), paddingInline: px(48) }}
      >
        <label className="block">
          <span className="text-k-small text-ink-soft block" style={{ marginBottom: px(8) }}>
            {copy.name_label}
          </span>
          <span className="relative block">
            <User
              aria-hidden="true"
              className="text-ink-muted absolute top-1/2 -translate-y-1/2"
              style={{ left: px(20), width: px(24), height: px(24) }}
              strokeWidth={1.8}
            />
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                patchDraft({ name: event.target.value })
              }}
              autoComplete="name"
              className={fieldClass}
              style={{ paddingBlock: px(18), paddingLeft: px(58), paddingRight: px(20) }}
            />
          </span>
        </label>

        <label className="block">
          <span className="text-k-small text-ink-soft block" style={{ marginBottom: px(8) }}>
            {copy.phone_label}
          </span>
          <span className="relative block">
            <Phone
              aria-hidden="true"
              className="text-ink-muted absolute top-1/2 -translate-y-1/2"
              style={{ left: px(20), width: px(24), height: px(24) }}
              strokeWidth={1.8}
            />
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
              className={fieldClass}
              style={{
                paddingBlock: px(18),
                paddingLeft: px(58),
                paddingRight: px(58),
                borderColor: phoneLooksWrong ? 'var(--color-rating-2)' : undefined,
              }}
            />
            {phoneLooksRight ? (
              <Check
                aria-hidden="true"
                className="absolute top-1/2 -translate-y-1/2 text-[color:var(--color-accent)]"
                style={{ right: px(20), width: px(24), height: px(24) }}
                strokeWidth={3}
              />
            ) : null}
          </span>
          {phoneLooksWrong ? (
            /* A hint, not a gate: SKIP and the primary button both still work. */
            <span
              id="phone-hint"
              className="text-k-micro block text-[color:var(--color-rating-2)]"
              style={{ marginTop: px(8) }}
            >
              {copy.phone_hint}
            </span>
          ) : null}
        </label>

        <p
          className="text-k-micro text-ink-soft flex items-start rounded-[--radius-button]"
          style={{
            gap: px(12),
            padding: px(18),
            background: 'var(--color-accent-soft)',
          }}
        >
          <ShieldCheck
            aria-hidden="true"
            className="text-accent shrink-0"
            style={{ width: px(24), height: px(24) }}
            strokeWidth={1.8}
          />
          <span className="text-pretty">{consentText}</span>
        </p>
      </div>

      <div className="shrink-0" style={{ paddingInline: px(48), paddingBottom: px(20) }}>
        <div className="flex flex-col" style={{ gap: px(12) }}>
          <BigButton fullWidth onClick={() => finish(true)}>
            {copy.cta}
          </BigButton>
          <BigButton fullWidth variant="secondary" onClick={() => finish(false)}>
            {copy.skip}
          </BigButton>
        </div>
        <p className="text-k-micro text-ink-muted text-center" style={{ marginTop: px(14) }}>
          {copy.micro}
        </p>
      </div>
    </>
  )
}
