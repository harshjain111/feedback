'use client'

import { useEffect } from 'react'

/**
 * Registers the kiosk service worker.
 *
 * Mounted from the kiosk layout only. The admin has no business being cached —
 * it is per-user, per-request and auth-scoped, and a stale dashboard is a
 * manager making decisions from yesterday.
 *
 * Registration failure is swallowed. The worker is a convenience: it makes the
 * installed app launch instantly and survives a wifi hiccup. A kiosk that
 * cannot register one works exactly as it did before PWA support existed, and
 * a console error on a café wall helps nobody.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // After load, not during: registration competes with the first paint, and
    // on a kiosk the first paint is the thing a guest is waiting for.
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
