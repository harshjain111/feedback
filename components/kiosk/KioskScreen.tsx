import { BrandMark } from './BrandMark'
import type { AppConfig } from '@/lib/config.types'

/**
 * The frame every kiosk screen sits in.
 *
 * The artwork is a full-bleed background rather than a strip along the bottom,
 * because the illustration IS a frame: ornament in the top corners, the India
 * Gate and the Taj across the base, and a clear centre column meant to be
 * written into. Cropping it to a band would throw away the half that makes the
 * screen feel like All India Café.
 *
 * Over it sits a scrim — opaque at the top where text lives, clearing to
 * nothing at the base so the illustration stays vivid where it matters. Without
 * it, body copy over a watercolour wash is a legibility problem on a screen
 * being read from two feet away in daylight.
 *
 * `density` controls how hard the scrim works. Dense screens (four rating cards,
 * a chip grid) need the background pushed further back than a welcome screen
 * with three lines of type on it.
 */

export type Tone = 'neutral' | 'positive' | 'negative'
export type Density = 'airy' | 'dense'

const TINT: Record<Tone, string> = {
  neutral: 'var(--color-tint-neutral)',
  positive: 'var(--color-tint-positive)',
  negative: 'var(--color-tint-negative)',
}

/** Surface colour with alpha, so the scrim tints with the pathway. */
const SCRIM: Record<Density, string> = {
  airy: `linear-gradient(to bottom,
    rgb(255 253 248 / 0.90) 0%,
    rgb(255 253 248 / 0.82) 38%,
    rgb(255 253 248 / 0.45) 66%,
    rgb(255 253 248 / 0.05) 100%)`,
  dense: `linear-gradient(to bottom,
    rgb(255 253 248 / 0.95) 0%,
    rgb(255 253 248 / 0.93) 55%,
    rgb(255 253 248 / 0.80) 80%,
    rgb(255 253 248 / 0.55) 100%)`,
}

export function KioskScreen({
  config,
  tone = 'neutral',
  density = 'airy',
  children,
}: {
  config: AppConfig
  tone?: Tone
  density?: Density
  children: React.ReactNode
}) {
  const artwork = config.branding.frame_image_url || '/artwork/frame-portrait.webp'

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ background: TINT[tone] }}
    >
      {/* Bottom-anchored so the Gate and the Taj stay on screen whatever the
          aspect ratio; the empty sky is what gets cropped on a shorter screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-bottom bg-no-repeat"
        style={{ backgroundImage: `url(${artwork})` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: SCRIM[density] }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <header
          className="text-accent flex shrink-0 justify-center"
          style={{ paddingTop: 'calc(18 * var(--kpx))' }}
        >
          <BrandMark logoUrl={config.branding.logo_url} name={config.branding.name} size={84} />
        </header>

        {/* min-h-0 is what lets this shrink rather than pushing content off. */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
