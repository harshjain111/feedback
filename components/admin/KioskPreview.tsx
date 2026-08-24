'use client'

import type { AppConfig } from '@/lib/config.types'

/**
 * A live portrait preview of the kiosk screen being edited (Prompt 35).
 *
 * Not an iframe of the real kiosk: an iframe would need a round trip and the
 * 60-second config cache to expire before it showed anything, so a manager
 * would type and see nothing change. This renders the same copy in the same
 * shapes at 1080x1920 scaled down, updating as they type — the point is to
 * answer "will this fit and does it read right" before saving.
 */

type Screen =
  'welcome' | 'rate' | 'negative' | 'positive' | 'comment' | 'followup' | 'contact' | 'thanks'

const SCALE = 0.22
const WIDTH = 1080
const HEIGHT = 1920

export function KioskPreview({ screen, config }: { screen: Screen; config: AppConfig }) {
  return (
    <div className="sticky top-4">
      <p className="text-ink-muted mb-2 text-[11px] tracking-wide uppercase">
        Live preview · 1080×1920
      </p>
      <div
        className="border-line overflow-hidden rounded-xl border shadow-sm"
        style={{ width: WIDTH * SCALE, height: HEIGHT * SCALE }}
      >
        <div
          className="bg-ground origin-top-left"
          style={{ width: WIDTH, height: HEIGHT, transform: `scale(${SCALE})` }}
        >
          <div className="flex h-full flex-col">
            <div className="flex flex-1 flex-col items-center justify-center px-16 text-center">
              <Body screen={screen} config={config} />
            </div>
            <div className="border-line text-ink-muted text-k-micro border-t px-12 py-6 text-center">
              {config.footer.brand} · {config.footer.website_label} ·{' '}
              {config.footer.instagram_label} · {config.footer.grievance_label}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Body({ screen, config }: { screen: Screen; config: AppConfig }) {
  switch (screen) {
    case 'welcome':
      return (
        <>
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.welcome.h1}</h1>
          <p className="font-display text-k-h2 text-ink-soft mt-10">{config.welcome.h2}</p>
          <p className="text-k-lead text-ink-muted mt-8">{config.welcome.support}</p>
          <Cta label={config.welcome.cta} />
          <p className="text-k-small text-ink-muted mt-10">{config.welcome.micro}</p>
        </>
      )
    case 'rate':
      return (
        <>
          <h1 className="font-display text-k-h1 text-ink">{config.rate.h1}</h1>
          <p className="text-k-lead text-ink-muted mt-5">{config.rate.sub}</p>
          <Cta label={config.rate.cta} />
        </>
      )
    case 'negative':
      return (
        <>
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.negative.h1}</h1>
          <p className="text-k-lead text-ink-muted mt-5">{config.negative.sub}</p>
          <p className="font-display text-k-h2 text-ink mt-12">{config.negative.h2}</p>
          <p className="font-display text-k-h3 text-ink mt-10">{config.negative.h3}</p>
          <p className="text-k-small text-ink-muted mt-3">{config.negative.support}</p>
        </>
      )
    case 'positive':
      return (
        <>
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.positive.h1}</h1>
          <p className="text-k-lead text-ink-muted mt-5">{config.positive.sub}</p>
          <p className="font-display text-k-h2 text-ink mt-12">{config.positive.h2}</p>
        </>
      )
    case 'comment':
      return (
        <>
          <h1 className="font-display text-k-h2 text-ink text-balance">{config.comment.h1}</h1>
          <p className="text-k-lead text-ink-muted mt-5">{config.comment.support}</p>
          <span className="bg-accent-soft text-accent text-k-micro rounded-chip mt-8 px-6 py-2">
            {config.comment.badge}
          </span>
          <div className="border-line-strong bg-surface text-k-body text-ink-muted mt-6 w-full rounded-[20px] border-2 p-8 text-left">
            {config.comment.placeholder}
          </div>
        </>
      )
    case 'contact':
      return (
        <>
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.contact.h1}</h1>
          <p className="text-k-lead text-ink-muted mt-5">{config.contact.support}</p>
          <p className="text-k-small text-ink-muted mt-10 self-start">
            {config.contact.name_label}
          </p>
          <div className="border-line-strong bg-surface h-24 w-full rounded-[20px] border-2" />
          <p className="text-k-small text-ink-muted mt-6 self-start">
            {config.contact.phone_label}
          </p>
          <div className="border-line-strong bg-surface h-24 w-full rounded-[20px] border-2" />
          <p className="text-k-micro text-ink-muted mt-6">{config.privacy.consent_text}</p>
          <div className="mt-10 flex gap-6">
            <Cta label={config.contact.cta} inline />
            <Cta label={config.contact.skip} inline secondary />
          </div>
          <p className="text-k-micro text-ink-muted mt-5">{config.contact.micro}</p>
        </>
      )
    case 'thanks':
      return (
        <>
          <h1 className="font-display text-k-h1 text-ink text-balance">{config.thanks.h1}</h1>
          <p className="text-k-lead text-ink-soft mt-10">{config.thanks.body}</p>
          <p className="font-display text-k-h2 text-accent mt-12">{config.thanks.line}</p>
          <p className="text-k-body text-ink-muted mt-8">{config.thanks.support}</p>
          <div className="border-line mt-16 w-full border-t pt-8">
            <p className="font-display text-k-h3 text-ink">{config.grievance.h1}</p>
            <p className="text-k-small text-ink-muted mt-3">{config.grievance.support}</p>
            <p className="text-k-h3 text-accent mt-4">📞 {config.grievance.phone}</p>
          </div>
        </>
      )
  }
}

function Cta({
  label,
  inline,
  secondary,
}: {
  label: string
  inline?: boolean
  secondary?: boolean
}) {
  return (
    <span
      className={`${inline ? '' : 'mt-20'}rounded-button text-k-h3 inline-flex min-h-[88px] items-center justify-center px-12 py-6 font-semibold ${
        secondary ? 'border-line-strong text-ink border-2' : 'bg-accent text-accent-ink'
      }`}
    >
      {label}
    </span>
  )
}
