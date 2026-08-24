'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Phone, ShieldCheck, User } from 'lucide-react'
import { BigButton } from './BigButton'
import type { AppConfig } from '@/lib/config.types'
// From lib/phone, not lib/validation: the latter imports zod, which has no
// business in the kiosk bundle (§6).
import { canKeepContact, isValidPhone } from '@/lib/phone'
import { PrefetchNext } from './PrefetchNext'
import { ratingValues, sentimentFor } from '@/lib/journey'
import { getDraft, patchDraft } from '@/lib/session'
import { submitDraft } from '@/lib/kiosk/submit'

/**
 * Name and mobile number — BOTH optional, always (§5, §11).
 *
 * SKIP is a full-size button under the primary one, not a grey link in a
 * corner. If the guest asked to be followed up the subheading changes to
 * explain why a number helps, but the field stays optional and SKIP stays
 * exactly as reachable. Nothing here ever blocks.
 *
 * KEEP ME CONNECTED, however, is live only once there is something to keep.
 * It used to work on an empty form, and that was a promise the system could not
 * honour: guest resolution keys on the phone number (§7), so a submission with
 * no number — or with a name and no number — stores no guest at all. The guest
 * tapped a button that said they were connected and walked away not connected.
 *
 * Gating the button is not the same as requiring the field. §4's rule is that
 * nothing may block the journey, and nothing does: SKIP sits directly beneath,
 * full size, always live, and it is the correct button for a guest who does not
 * want to share anything.
 */
export function ContactForm({
  copy,
  consentText,
  memoryEnabled,
}: {
  copy: AppConfig['contact']
  consentText: string
  /** §8b layer 1. False means the journey must not route through /memory at all. */
  memoryEnabled: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [wantsCallback, setWantsCallback] = useState(false)
  const [touchedPhone, setTouchedPhone] = useState(false)
  // The submit is a network round trip now, so both buttons must lock while
  // it runs. A double-tap would otherwise start a second journey-ending
  // navigation on top of the first.
  const [busy, setBusy] = useState(false)
  const px = (n: number) => `calc(${n} * var(--kpx))`

  useEffect(() => {
    const draft = getDraft()
    setName(draft.name)
    setPhone(draft.phone)
    // The standalone "would you like us to follow up?" screen was removed: it
    // asked for consent to call and was immediately followed by a screen asking
    // for the number, which is the same question twice.
    //
    // A callback is now INFERRED — a guest who had a bad visit and still leaves
    // a number is asking to be contacted about it. A guest who had a good visit
    // and leaves one is joining the mailing list, which is a different thing and
    // must not open a follow-up nobody needs to chase.
    setWantsCallback(sentimentFor(ratingValues(draft.ratings)) === 'negative')
  }, [])

  // Only ever complains about something the guest actually typed.
  const phoneLooksWrong = touchedPhone && phone.trim() !== '' && !isValidPhone(phone)
  const phoneLooksRight = phone.trim() !== '' && isValidPhone(phone)

  // A valid number is the whole condition — see canKeepContact for why a name
  // on its own does not count.
  const canKeep = canKeepContact(phone)

  // Explain the dimming only once the guest has started — a hint under an
  // untouched form is noise, and the micro line already says SKIP is fine.
  const showCtaHint = !canKeep && (name.trim() !== '' || phone.trim() !== '')

  /**
   * The end of the questions, and now also the COMMIT POINT (§4).
   *
   * PHOTO_MODULE.md rule 1 moved the write here from the thank-you screen: the
   * feedback must be in Postgres before the camera can open, so a jammed
   * printer or a revoked permission can never cost a guest their record.
   *
   * The submit is awaited but nothing is blocked on its success. It returns a
   * code, a queued flag, or neither, and the journey continues identically in
   * all three cases — only the photo module cares, and it declines to run
   * without a code rather than complaining about one.
   */
  const finish = async (keepDetails: boolean) => {
    if (busy) return
    setBusy(true)

    const keptPhone = keepDetails ? phone.trim() : ''
    patchDraft({
      name: keepDetails ? name.trim() : '',
      phone: keptPhone,
      followUpRequested: wantsCallback && keptPhone !== '',
    })

    const { feedbackCode } = await submitDraft()

    // No code means the write did not land — offline, or queued for retry. The
    // photo module needs a committed row to attach its three booleans to, so it
    // is skipped rather than run against nothing.
    router.push(memoryEnabled && feedbackCode !== null ? '/memory' : '/thanks')
  }

  const fieldClass =
    'k-card text-k-body text-ink focus:border-accent w-full outline-none bg-surface'

  return (
    <>
      <PrefetchNext routes={['/thanks', '/memory']} />

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
          {wantsCallback ? copy.followup_sub : copy.support}
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

      <div className="k-cta-dock shrink-0" style={{ paddingInline: px(48), paddingBottom: px(20) }}>
        <div className="flex flex-col" style={{ gap: px(12) }}>
          <BigButton fullWidth className="k-cta" disabled={!canKeep} onClick={() => finish(true)}>
            {copy.cta}
          </BigButton>
          <BigButton
            fullWidth
            variant="secondary"
            className="k-cta"
            disabled={busy}
            onClick={() => void finish(false)}
          >
            {copy.skip}
          </BigButton>
        </div>
        <p
          className="text-k-micro text-ink-muted text-center"
          style={{ marginTop: px(14) }}
          aria-live="polite"
        >
          {showCtaHint ? copy.cta_hint : copy.micro}
        </p>
      </div>
    </>
  )
}
