'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { removePushSubscription, savePushSubscription } from '@/lib/actions/push'

/**
 * Turning low-rating notifications on for THIS device.
 *
 * Per device, not per account, and the copy says so — a manager who enables it
 * on their phone and then wonders why the office desktop stays silent has been
 * failed by the label, not the feature.
 *
 * Registers the service worker itself rather than relying on the kiosk's
 * registrar: that component is mounted from the kiosk layout only, on the
 * reasoning that the admin has no business being cached. Still true — the
 * fetch handler skips /admin — but push needs a worker registered, and this is
 * the one place in the admin that needs one.
 */

type State = 'checking' | 'unsupported' | 'denied' | 'off' | 'on'

function urlBase64ToBytes(base64: string): ArrayBuffer {
  // VAPID keys travel as URL-safe base64; PushManager wants raw bytes.
  //
  // Returns the ArrayBuffer rather than the view: under TS 5.7 a Uint8Array is
  // generic over its buffer, so a plain Uint8Array is not assignable to
  // BufferSource (it might be backed by a SharedArrayBuffer).
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalised)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

export function NotificationToggle({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

  const [state, setState] = useState<State>('checking')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        if (!cancelled) setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied')
        return
      }

      const registration = await navigator.serviceWorker.getRegistration('/')
      const existing = await registration?.pushManager.getSubscription()
      if (!cancelled) setState(existing ? 'on' : 'off')
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = () => {
    setError(null)
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setState(permission === 'denied' ? 'denied' : 'off')
          return
        }

        const registration =
          (await navigator.serviceWorker.getRegistration('/')) ??
          (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
        await navigator.serviceWorker.ready

        const subscription = await registration.pushManager.subscribe({
          // Chrome refuses a subscription without this, and a silent push is
          // not something this feature should ever be able to send anyway.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(publicKey),
        })

        const json = subscription.toJSON() as {
          endpoint?: string
          keys?: { p256dh?: string; auth?: string }
        }

        const result = await savePushSubscription({
          endpoint: json.endpoint ?? '',
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
          userAgent: navigator.userAgent,
        })

        if (!result.ok) {
          // Do not leave a live browser subscription pointing at a row that was
          // never stored — it would look enabled and never deliver.
          await subscription.unsubscribe().catch(() => {})
          setError(result.error)
          setState('off')
          return
        }
        setState('on')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not enable notifications')
        setState('off')
      }
    })
  }

  const disable = () => {
    setError(null)
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (subscription) {
          await removePushSubscription(subscription.endpoint)
          await subscription.unsubscribe()
        }
        setState('off')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not turn notifications off')
      }
    })
  }

  const dark = tone === 'dark'
  const muted = dark ? 'text-white/50' : 'text-ink-muted'
  const soft = dark ? 'text-white/70' : 'text-ink-soft'

  // Without a key there is nothing to subscribe to, and a button that always
  // fails is worse than no button.
  if (publicKey === '') return null

  if (state === 'checking') {
    return <p className={`${muted} text-xs`}>Checking this device…</p>
  }

  if (state === 'unsupported') {
    return (
      <p className={`${soft} text-xs`}>
        This browser cannot show notifications. On an iPhone, add the admin to your Home Screen
        first — Safari only delivers them to an installed app, never to a tab.
      </p>
    )
  }

  if (state === 'denied') {
    return (
      <p className={`${soft} text-xs`}>
        Notifications are blocked for this site. The browser will not ask again, so this has to be
        turned back on in its own site settings.
      </p>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={state === 'on' ? disable : enable}
        disabled={pending}
        className={
          dark
            ? 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white disabled:opacity-50'
            : 'border-line-strong text-ink hover:bg-ground-sunk inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50'
        }
      >
        {pending ? (
          <Loader2 size={15} strokeWidth={2.2} aria-hidden="true" className="animate-spin" />
        ) : state === 'on' ? (
          <BellOff size={15} strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <Bell size={15} strokeWidth={2.2} aria-hidden="true" />
        )}
        {state === 'on' ? 'Alerts on (this device)' : 'Alert me on this device'}
      </button>

      <p className={`${muted} mt-1 px-3 text-[11px]`}>
        {state === 'on'
          ? 'Buzzes the moment a guest rates below the alert threshold.'
          : 'Per device — turn it on separately on each phone you want alerted.'}
      </p>

      {error ? (
        <p role="alert" className="mt-1 px-3 text-[11px] text-[color:var(--color-bad)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
