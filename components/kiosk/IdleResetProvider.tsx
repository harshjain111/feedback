'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { clearDraft } from '@/lib/session'

/**
 * Returns the kiosk to Welcome and wipes the draft after a period of inactivity
 * (§4, default 90s, configurable).
 *
 * This is a privacy control as much as a UX one: a guest who walks off
 * mid-journey must not leave their half-finished answers on screen for the next
 * person, and the next person must not accidentally submit them.
 */
export function IdleResetProvider({
  idleSeconds,
  children,
}: {
  idleSeconds: number
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    clearDraft()
    router.replace('/')
    router.refresh()
  }, [router])

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    // On Welcome there is nothing to reset to and nothing to leak, so no timer.
    if (pathname === '/') return
    timer.current = setTimeout(reset, Math.max(10, idleSeconds) * 1000)
  }, [idleSeconds, pathname, reset])

  useEffect(() => {
    restart()

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'touchstart',
      'keydown',
      'wheel',
      'scroll',
    ]
    for (const event of events) {
      window.addEventListener(event, restart, { passive: true })
    }

    return () => {
      for (const event of events) window.removeEventListener(event, restart)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [restart])

  // Unattended-terminal hygiene (§6): no context menu, no pinch zoom, no
  // accidental text drag. Selection and overscroll are handled in CSS.
  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => event.preventDefault()
    const blockGesture = (event: Event) => event.preventDefault()

    document.addEventListener('contextmenu', blockContextMenu)
    document.addEventListener('gesturestart', blockGesture)
    document.addEventListener('dragstart', blockGesture)

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu)
      document.removeEventListener('gesturestart', blockGesture)
      document.removeEventListener('dragstart', blockGesture)
    }
  }, [])

  return <>{children}</>
}
