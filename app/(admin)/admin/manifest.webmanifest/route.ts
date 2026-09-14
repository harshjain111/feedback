import type { MetadataRoute } from 'next'

/**
 * A SECOND manifest, for the admin installed on a manager's phone.
 *
 * The kiosk manifest at /manifest.webmanifest cannot serve this: it is scoped
 * to '/', starts at the guest journey, and is fullscreen and portrait-LOCKED
 * because it runs on a bolted-down 1080×1920 panel (§6). Installing that on a
 * phone would give a manager the feedback form, with no address bar to escape
 * it and no rotation.
 *
 * So: separate scope, separate start_url, standalone rather than fullscreen —
 * a phone's status bar is information the holder wants — and no orientation
 * lock, because a person reads a comment thread however they are holding it.
 *
 * Installing this is also what makes push work on iOS at all: Safari delivers
 * Web Push only to a PWA added to the Home Screen (16.4+), never to a tab.
 */
export const dynamic = 'force-static'

export function GET(): Response {
  const manifest: MetadataRoute.Manifest = {
    id: '/admin',
    name: 'All India Café — Experience Intelligence',
    short_name: 'AIC Admin',
    description: 'Feedback, guests and alerts for All India Café',

    start_url: '/admin',
    scope: '/admin',

    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],

    // The admin canvas, so the splash is the app rather than a white flash.
    background_color: '#f6f4ef',
    theme_color: '#10261c',

    categories: ['business', 'productivity'],

    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],

    // Long-press the installed icon to land straight on the two screens that
    // matter when a notification has just arrived.
    shortcuts: [
      { name: 'Feedback', url: '/admin/feedback' },
      { name: 'Dashboard', url: '/admin' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}
