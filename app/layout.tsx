import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'All India Café',
  description: 'Customer Experience Intelligence System',
}

/**
 * Root layout — deliberately bare.
 *
 * The kiosk and the admin app share nothing visually: chrome, fonts and layout
 * belong to `app/(kiosk)/layout.tsx` and `app/(admin)/admin/layout.tsx`.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
