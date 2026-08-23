'use client'

import { useEffect } from 'react'
import { flush } from '@/lib/kiosk/queue'

/**
 * Tells the server this terminal is alive (§43), and drains the offline queue
 * whenever the connection returns.
 *
 * Two minutes is deliberate: often enough that "offline" in the admin means
 * something, rare enough that a tablet on a café's connection is not chattering
 * all day.
 */
const INTERVAL_MS = 120_000

export function KioskHeartbeat() {
  useEffect(() => {
    const beat = async () => {
      try {
        await fetch('/api/kiosk/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        // Reaching the server at all is the signal that anything queued during
        // an outage can go out now.
        void flush()
      } catch {
        // Offline. The next beat will try again.
      }
    }

    void beat()
    const timer = window.setInterval(beat, INTERVAL_MS)
    const onOnline = () => void beat()
    window.addEventListener('online', onOnline)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return null
}
