'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Warms the next screen while the guest is still reading this one.
 *
 * Kiosk routes are force-dynamic, so each step is a server round trip. The
 * journey is deterministic though — from any screen we know where CONTINUE
 * goes — so the work can be done during the seconds the guest spends deciding
 * instead of the moment they tap.
 *
 * Pass every plausible next route; prefetch is cheap and the tablet is idle.
 */
export function PrefetchNext({ routes }: { routes: string[] }) {
  const router = useRouter()

  useEffect(() => {
    for (const route of routes) router.prefetch(route)
  }, [router, routes])

  return null
}
