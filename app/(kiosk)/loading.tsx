import { getConfig } from '@/lib/config'

/**
 * The kiosk loading state (§43-adjacent, client request).
 *
 * Every screen change is a server round trip. Without a visible response the
 * guest taps again — and the second tap is the one that makes the terminal feel
 * broken. This appears instantly on navigation and holds the frame's shape, so
 * the screen never collapses to white and then jumps back.
 *
 * The café's own mark rather than a drawn stand-in: this is the one screen a
 * guest sees with nothing else on it, and a generic spinner there is the moment
 * the kiosk stops feeling like All India Café and starts feeling like software.
 *
 * It breathes rather than spins. A spinner racing implies a measurable wait;
 * this is usually a few hundred milliseconds and should read as the screen
 * drawing breath, not as a process the guest is waiting on.
 */
export default async function KioskLoading() {
  const config = await getConfig()
  const px = (n: number) => `calc(${n} * var(--kpx))`
  const { logo_url: logoUrl, name } = config.branding

  return (
    <div className="bg-ground flex h-full flex-col items-center justify-center" role="status">
      <span className="sr-only">Loading</span>

      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element --
           Same reasoning as BrandMark: the URL is CMS input, and next/image
           would want a remote pattern configured per client for a small static
           asset. */
        <img
          src={logoUrl}
          alt={name}
          className="k-breathe object-contain"
          style={{ height: px(180), width: 'auto' }}
        />
      ) : (
        <svg
          viewBox="0 0 100 100"
          style={{ width: px(120), height: px(120) }}
          className="text-accent k-breathe"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M35 44 h26 v11 a13 13 0 0 1 -26 0 z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path
            d="M61 47 h4.5 a5 5 0 0 1 0 10 H61"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      )}

      <span
        className="bg-line relative overflow-hidden rounded-full"
        style={{ width: px(180), height: px(6), marginTop: px(40) }}
      >
        <span
          className="bg-accent k-sweep absolute inset-y-0 rounded-full"
          style={{ width: '30%' }}
        />
      </span>
    </div>
  )
}
