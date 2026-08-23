import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'

/**
 * Kiosk headings: a warm display serif (§1). Fraunces at a low optical size and
 * modest softness reads warm and considered at 64px without turning decorative.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'All India Café',
  description: 'Customer Experience Intelligence System',
}

/**
 * Root layout — deliberately bare.
 *
 * The kiosk and the admin app share tokens and nothing else: chrome and layout
 * belong to `app/(kiosk)/layout.tsx` and `app/(admin)/admin/layout.tsx`.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
