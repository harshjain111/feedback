'use client'

import { useState } from 'react'
import { BigButton } from '@/components/kiosk/BigButton'
import { Chip } from '@/components/kiosk/Chip'
import { FaceIcon } from '@/components/kiosk/FaceIcon'
import type { FaceKey } from '@/lib/config.types'

/**
 * /styleguide — the visual foundation, on one page, for approval before any
 * guest-facing screen is built (Prompt 06 checkpoint).
 *
 * The faces and labels below are stand-ins so the drawing can be judged. On the
 * real screens every one of these comes from the database: the ramp lives in
 * rating_scale and the copy in app_config (§3).
 */

const SCALE: { value: number; faceKey: FaceKey; label: string; colour: string }[] = [
  { value: 1, faceKey: 'angry', label: 'Very Poor', colour: '#E63329' },
  { value: 2, faceKey: 'sad', label: 'Poor', colour: '#F07829' },
  { value: 3, faceKey: 'neutral', label: 'Okay', colour: '#F5C518' },
  { value: 4, faceKey: 'happy', label: 'Good', colour: '#8DC63F' },
  { value: 5, faceKey: 'delighted', label: 'Excellent', colour: '#39B54A' },
]

const TOKENS = [
  { name: 'ground', hex: '#FBF8F2', note: 'ivory paper — the kiosk ground' },
  { name: 'ground-sunk', hex: '#F4EFE5', note: 'recessed panels' },
  { name: 'surface', hex: '#FFFFFF', note: 'cards, inputs' },
  { name: 'ink', hex: '#1B1512', note: 'headings' },
  { name: 'ink-soft', hex: '#4A3F38', note: 'body' },
  { name: 'ink-muted', hex: '#7D6F64', note: 'supporting lines' },
  { name: 'line', hex: '#E6DCCD', note: 'hairlines' },
  { name: 'line-strong', hex: '#D3C5B0', note: 'chip borders' },
  { name: 'accent', hex: '#A8482A', note: 'terracotta — the single warm accent' },
  { name: 'accent-soft', hex: '#F6E7DF', note: 'accent wash' },
]

const TYPE = [
  { cls: 'text-k-display font-display', label: 'k-display / 88px', sample: 'All India Café' },
  { cls: 'text-k-h1 font-display', label: 'k-h1 / 64px', sample: 'YOUR EXPERIENCE MATTERS.' },
  { cls: 'text-k-h2 font-display', label: 'k-h2 / 44px', sample: 'WHAT HAPPENED?' },
  { cls: 'text-k-h3 font-sans font-semibold', label: 'k-h3 / 34px', sample: 'CONTINUE →' },
  { cls: 'text-k-lead font-sans', label: 'k-lead / 30px', sample: 'Tell us how we did.' },
  {
    cls: 'text-k-body font-sans',
    label: 'k-body / 26px',
    sample: 'Good, bad or somewhere in between — tell us honestly.',
  },
  {
    cls: 'text-k-small font-sans',
    label: 'k-small / 22px',
    sample: 'It takes less than a minute.',
  },
  {
    cls: 'text-k-micro font-sans',
    label: 'k-micro / 20px — the floor',
    sample: 'Optional — you can skip this step.',
  },
]

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-line border-t py-16">
      <div className="mb-10">
        <h2 className="text-ink-muted font-sans text-sm font-semibold tracking-[0.18em] uppercase">
          {title}
        </h2>
        {note ? <p className="text-ink-soft mt-2 max-w-2xl text-base">{note}</p> : null}
      </div>
      {children}
    </section>
  )
}

export default function StyleguidePage() {
  const [selectedRating, setSelectedRating] = useState<number | null>(4)
  const [chips, setChips] = useState<string[]>(['Waiting Time'])

  const toggleChip = (name: string) =>
    setChips((current) =>
      current.includes(name) ? current.filter((c) => c !== name) : [...current, name],
    )

  return (
    <main className="mx-auto max-w-6xl px-10 py-20">
      <header>
        <p className="text-accent font-sans text-sm font-semibold tracking-[0.18em] uppercase">
          All India Café · CXIS
        </p>
        <h1 className="font-display text-ink mt-4 text-6xl">Visual foundation</h1>
        <p className="text-ink-soft mt-4 max-w-2xl text-lg">
          Ivory ground, deep ink, one warm accent. The kiosk type scale is sized for a 1080×1920
          screen read standing up — H1 at 64px, body at 26px, nothing under 20px.
        </p>
      </header>

      <Section
        title="Type scale — kiosk"
        note="Two scales exist. This one is for the kiosk. The admin app uses ordinary desktop sizes: dense and information-first, the opposite brief."
      >
        <div className="space-y-10">
          {TYPE.map((row) => (
            <div key={row.label}>
              <p className="text-ink-muted mb-2 font-mono text-xs tracking-widest uppercase">
                {row.label}
              </p>
              <p className={`${row.cls} text-ink`}>{row.sample}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {TOKENS.map((token) => (
            <div key={token.name}>
              <div
                className="rounded-card border-line h-24 w-full border"
                style={{ backgroundColor: token.hex }}
              />
              <p className="text-ink mt-3 font-mono text-xs">{token.name}</p>
              <p className="text-ink-muted font-mono text-xs">{token.hex}</p>
              <p className="text-ink-muted mt-1 text-xs">{token.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Rating faces"
        note="Hand-drawn inline SVG, never Unicode emoji — the same five faces must render identically on every tablet. Features are white negative space cut out of a solid circle; eyebrows appear on the first two faces only. Colour must register before the label does."
      >
        <div className="rounded-card bg-surface p-12">
          <p className="font-display text-k-h3 text-ink mb-8">At rest</p>
          <div className="flex items-start justify-between gap-4">
            {SCALE.map((face) => (
              <div key={face.value} className="flex flex-col items-center gap-4">
                <FaceIcon faceKey={face.faceKey} colour={face.colour} size={132} />
                <span className="text-k-small text-ink-soft">{face.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-card bg-surface mt-8 p-12">
          <p className="font-display text-k-h3 text-ink mb-8">
            Selected — enlarged, ringed, unselected faces recede
          </p>
          <div
            className="flex items-start justify-between gap-4"
            role="radiogroup"
            aria-label="Rating preview"
          >
            {SCALE.map((face) => {
              const isSelected = selectedRating === face.value
              return (
                <button
                  key={face.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={face.label}
                  onClick={() => setSelectedRating(face.value)}
                  className="rounded-card focus-visible:outline-accent flex flex-col items-center gap-4 p-2 focus-visible:outline-4 focus-visible:outline-offset-2"
                >
                  <span
                    className="grid place-items-center rounded-full transition-[transform,box-shadow] duration-[--duration-kiosk] ease-[--ease-kiosk]"
                    style={{
                      transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                      boxShadow: isSelected ? `0 0 0 8px ${face.colour}33` : 'none',
                      opacity: selectedRating === null || isSelected ? 1 : 0.4,
                    }}
                  >
                    <FaceIcon faceKey={face.faceKey} colour={face.colour} size={132} />
                  </span>
                  <span
                    className="text-k-small"
                    style={{
                      color: isSelected ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {face.label}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-k-micro text-ink-muted mt-8">
            Prompt 09 turns this into FaceScale, driven by the rating_scale rows with radiogroup
            semantics and 140px tap targets. The drawing is what needs approving here.
          </p>
        </div>
      </Section>

      <Section
        title="Buttons"
        note="One obvious CTA per screen. 88px minimum tap target; SKIP is a real button, never a tiny grey link."
      >
        <div className="flex flex-wrap items-center gap-6">
          <BigButton variant="primary">SHARE YOUR FEEDBACK →</BigButton>
          <BigButton variant="secondary">NO, I&rsquo;M GOOD</BigButton>
          <BigButton variant="quiet">SKIP</BigButton>
          <BigButton variant="primary" disabled>
            CONTINUE →
          </BigButton>
        </div>
        <p className="text-ink-muted mt-6 text-sm">
          Disabled is the state of CONTINUE on the rate screen until every category is rated.
        </p>
      </Section>

      <Section title="Chips" note="Multi-select. Selection is filled, not merely outlined.">
        <div className="flex flex-wrap gap-5">
          {['Food', 'Service', 'Staff', 'Waiting Time', 'Cleanliness', 'Billing', 'Ambience'].map(
            (name) => (
              <Chip
                key={name}
                label={name}
                selected={chips.includes(name)}
                onToggle={() => toggleChip(name)}
              />
            ),
          )}
        </div>
      </Section>

      <Section title="Kiosk frame" note="Every screen is designed at 1080×1920, portrait only.">
        <div
          className="rounded-card border-line bg-surface border p-10"
          style={{ width: 270, height: 480 }}
        >
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-display text-ink text-2xl leading-tight">YOUR EXPERIENCE MATTERS.</p>
            <p className="text-ink-soft mt-3 text-sm">Tell us how we did.</p>
          </div>
        </div>
        <p className="text-ink-muted mt-4 text-sm">Shown at 25%.</p>
      </Section>
    </main>
  )
}
