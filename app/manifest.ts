import type { MetadataRoute } from 'next'

/**
 * PWA manifest — the kiosk installed as an app.
 *
 * The point on a kiosk is not the app-store veneer. It is that Chrome in
 * standalone mode has no address bar, no tabs and no back button for a guest to
 * find, and that Windows will relaunch it from a desktop shortcut after a
 * reboot. Everything a dedicated terminal wants and a browser window is bad at.
 *
 * `display: 'fullscreen'` rather than 'standalone': on a wall-mounted screen
 * even a status bar is chrome the café did not ask for. A browser that will not
 * honour fullscreen falls back through the display_override chain rather than
 * dropping straight to a tabbed window.
 *
 * Named for Vibrnd rather than the café because this is the product, not the
 * client's own app — the same terminal will carry another outlet's branding
 * inside it (§43) while remaining the same installed thing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vibrnd Feedback',
    short_name: 'Feedback',
    description: 'Customer Experience Intelligence System',

    // The journey, not the admin. An installed kiosk that opened on a login
    // screen would be a support call on the first reboot.
    start_url: '/',
    scope: '/',

    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone', 'minimal-ui'],

    // Portrait, and locked. The whole kiosk is designed at 1080×1920 (§6); a
    // rotation would not reflow, it would clip.
    orientation: 'portrait',

    // The ivory ground, so the splash screen is the app rather than a white
    // flash before it.
    background_color: '#fbf6ec',
    theme_color: '#0f5132',

    categories: ['business', 'productivity'],

    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Maskable needs its content inside the safe circle, so it is a
        // separate render with padding rather than the same file relabelled —
        // Android crops the corners off an 'any' icon used as maskable.
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
