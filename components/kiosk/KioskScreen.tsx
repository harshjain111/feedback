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

/**
 * Surface colour with alpha, so the scrim tints with the pathway.
 *
 * The stops hold near-opaque down to ~80% and only then clear. An earlier
 * version cleared from 66%, which is exactly where a centred content block puts
 * its supporting line and its CTA — the copy came out washed over the rickshaw
 * and the teacup. The illustration is still vivid across the bottom fifth,
 * which is where its best detail is; nothing worth seeing was above it.
 */
const SCRIM: Record<Density, string> = {
  airy: `linear-gradient(to bottom,
    rgb(255 253 248 / 0.92) 0%,
    rgb(255 253 248 / 0.90) 55%,
    rgb(255 253 248 / 0.76) 80%,
    rgb(255 253 248 / 0.10) 100%)`,
  dense: `linear-gradient(to bottom,
    rgb(255 253 248 / 0.96) 0%,
    rgb(255 253 248 / 0.95) 60%,
    rgb(255 253 248 / 0.88) 84%,
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
          {/*
            Sized by HEIGHT, and three things pull on it.

            The drawn fallback is a circular stamp, so 84 reads as a mark. The
            client's logo is a landscape plaque at about 1.6:1, so the same 84
            would be 134 wide on a 1080 screen and its two script lines would be
            a smudge — the one thing a mark on a kiosk must not be.

            But an airy screen can afford a brand moment and a dense one cannot:
            the rate screen carries four category cards and a CTA and has about
            a hundred design pixels of slack in total. So the mark follows the
            density the screen already declares, rather than a number chosen for
            the roomiest case and then regretted on the tightest.
          */}
          <BrandMark
            logoUrl={config.branding.logo_url}
            name={config.branding.name}
            size={config.branding.logo_url ? (density === 'airy' ? 152 : 104) : 84}
          />
        </header>

        {/* min-h-0 is what lets this shrink rather than pushing content off. */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
