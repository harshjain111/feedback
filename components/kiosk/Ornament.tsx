/**
 * The decorative band across the top of each kiosk screen, and the artwork
 * slot along the bottom.
 *
 * The ornament is drawn, not an image: it has to render instantly on a
 * mid-range tablet and tint itself per pathway, and a raster would do neither.
 * It is deliberately quiet — a hairline arch motif, not a border of paisley.
 *
 * The artwork band IS meant to be a real illustration, and takes one from
 * `branding.*_image_url` in Settings. Until the client supplies theirs it
 * renders as a soft wash, so the screen looks finished rather than broken.
 */

export function OrnamentBand({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1080 28"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ height: 'calc(28 * var(--kpx))', width: '100%' }}
    >
      <defs>
        {/* One repeating arch, the shape every doorway in the reference shares. */}
        <pattern id="aic-arches" width="60" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M6 26 V16 a24 24 0 0 1 48 0 V26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            opacity="0.5"
          />
          <circle cx="30" cy="7" r="1.6" fill="currentColor" opacity="0.45" />
        </pattern>
      </defs>
      <rect width="1080" height="28" fill="url(#aic-arches)" />
    </svg>
  )
}

/**
 * Bottom artwork. `src` comes from config; without one this is a warm gradient
 * wash so the screen still reads as designed.
 */
export function ArtworkBand({
  src,
  height = 260,
  tint = 'var(--color-ground-sunk)',
}: {
  src?: string
  height?: number
  tint?: string
}) {
  const h = `calc(${height} * var(--kpx))`

  if (src) {
    return (
      <div className="w-full shrink-0 overflow-hidden" style={{ height: h }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary CMS URL. */}
        <img src={src} alt="" aria-hidden="true" className="h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="w-full shrink-0"
      style={{
        height: h,
        background: `linear-gradient(to bottom, transparent, ${tint})`,
      }}
    >
      <svg
        viewBox="0 0 1080 260"
        preserveAspectRatio="xMidYMax slice"
        className="h-full w-full"
        aria-hidden="true"
      >
        {/* A skyline of arches and domes, in one flat tone. Placeholder for the
            client's illustration, but composed so it does not look like one. */}
        <g fill="none" stroke="currentColor" strokeWidth="2" opacity="0.16">
          <path d="M60 260 V170 a40 40 0 0 1 80 0 V260" />
          <path d="M100 130 v-16" />
          <path d="M170 260 V200 a26 26 0 0 1 52 0 V260" />
          <path d="M260 260 V150 a56 56 0 0 1 112 0 V260" />
          <path d="M316 94 v-18" />
          <path d="M400 260 V195 a30 30 0 0 1 60 0 V260" />
          <path d="M490 260 V165 a46 46 0 0 1 92 0 V260" />
          <path d="M536 119 v-16" />
          <path d="M610 260 V205 a24 24 0 0 1 48 0 V260" />
          <path d="M690 260 V160 a50 50 0 0 1 100 0 V260" />
          <path d="M740 110 v-18" />
          <path d="M820 260 V198 a28 28 0 0 1 56 0 V260" />
          <path d="M900 260 V175 a38 38 0 0 1 76 0 V260" />
          <path d="M938 137 v-15" />
          <path d="M1010 260 V210 a22 22 0 0 1 44 0 V260" />
        </g>
      </svg>
    </div>
  )
}
