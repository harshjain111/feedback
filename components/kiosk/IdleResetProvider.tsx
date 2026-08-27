'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { getDraft, clearDraft, hasAnyRating } from '@/lib/session'
import { submitDraft } from '@/lib/kiosk/submit'

/**
 * Returns the kiosk to Welcome and wipes the draft after a period of inactivity
 * (§4, default 90s, configurable).
 *
 * This is a privacy control as much as a UX one: a guest who walks off
 * mid-journey must not leave their half-finished answers on screen for the next
 * person, and the next person must not accidentally submit them.
 *
 * IT ALSO RESCUES THE FEEDBACK, and that is load-bearing rather than tidy.
 *
 * Contact details are compulsory (`contact.required`), so a guest who will not
 * give a number has no way forward and simply leaves. The submit fires on
 * LEAVING the contact screen, so without this their ratings would walk out with
 * them — and the guests least willing to be identified are exactly the ones
 * whose feedback the café most needs. Anything already rated is committed here
 * before the draft is wiped.
 *
 * What gets committed is only what the guest freely gave. The contact details
 * they declined are simply absent; nothing is inferred and nothing is kept that
 * they did not type.
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
    const draft = getDraft()

    // Fire and forget, then wipe regardless. The next guest must not wait on a
    // network call, and submitDraft queues to IndexedDB if it cannot reach the
    // server (§43) — so an outage delays the write, it does not lose it.
    // Idempotent on submission_id, so a journey that already submitted at the
    // contact screen does not write a second row.
    if (hasAnyRating(draft) && draft.feedbackCode === null) {
      void submitDraft().finally(clearDraft)
    } else {
      clearDraft()
    }

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
