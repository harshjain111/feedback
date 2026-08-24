'use client'

import { useEffect } from 'react'
import { flush } from '@/lib/kiosk/queue'
import { getAgentStatus } from '@/lib/kiosk/print-agent'

/**
 * Tells the server this terminal is alive (§43), and drains the offline queue
 * whenever the connection returns.
 *
 * Two minutes is deliberate: often enough that "offline" in the admin means
 * something, rare enough that a tablet on a café's connection is not chattering
 * all day.
 *
 * It also carries the print agent's health (PHOTO_MODULE.md §6). The agent binds
 * 127.0.0.1, so nothing server-side can reach it — this browser is the only
 * thing that can, which makes the heartbeat the natural courier.
 */
const INTERVAL_MS = 120_000

/**
 * Whether this machine has a camera at all, and whether we are allowed it.
 *
 * Deliberately does NOT call getUserMedia: that would turn the camera LED on
 * every two minutes for a status check, which is exactly the kind of thing a
 * guest notices and rightly mistrusts. enumerateDevices and the Permissions API
 * answer the question without opening the lens.
 */
async function probeCamera(): Promise<'present' | 'absent' | 'denied' | 'unknown'> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return 'unknown'

    if (navigator.permissions) {
      try {
        const status = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        })
        if (status.state === 'denied') return 'denied'
      } catch {
        // Firefox and Safari do not expose the camera permission this way.
        // Fall through to device enumeration.
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.some((device) => device.kind === 'videoinput') ? 'present' : 'absent'
  } catch {
    return 'unknown'
  }
}

export function KioskHeartbeat() {
  useEffect(() => {
    const beat = async () => {
      // Both probes are local and both are allowed to fail. A missing agent is
      // the normal state on anything that is not the kiosk PC.
      const [agent, cameraStatus] = await Promise.all([getAgentStatus(), probeCamera()])

      try {
        await fetch('/api/kiosk/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cameraStatus,
            // No agent reachable is reported as offline rather than unknown:
            // on the kiosk that IS the printer being unavailable, and it is the
            // condition the badge exists to surface.
            printerStatus: agent ? agent.printer : 'offline',
            ...(agent ? { agentVersion: agent.version } : {}),
          }),
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
