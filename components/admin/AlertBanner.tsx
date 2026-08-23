'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertOctagon, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The live alert banner (§27).
 *
 * Polls every 60 seconds rather than opening a realtime socket: a café
 * dashboard left open on a back-office screen does not need sub-second
 * latency, and a poll survives a flaky connection without reconnect logic.
 *
 * Acknowledging removes it here and frees the dedupe key server-side, so the
 * same condition can raise a fresh alert if it happens again.
 */

const POLL_MS = 60_000

type Alert = {
  alert_id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string | null
  payload: { feedbackId?: string; categoryId?: string } | null
  last_fired_at: string
}

export function AlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts', { cache: 'no-store' })
      if (!response.ok) return
      const json = (await response.json()) as { alerts: Alert[] }
      setAlerts(json.alerts ?? [])
    } catch {
      // A failed poll is not worth telling anyone about; the next one is 60s away.
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(load, POLL_MS)
    // Catch up immediately when someone returns to the tab rather than waiting
    // out the remainder of an interval that was throttled while hidden.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const acknowledge = async (alertId: string) => {
    setBusy(alertId)
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      })
      setAlerts((current) => current.filter((alert) => alert.alert_id !== alertId))
    } finally {
      setBusy(null)
    }
  }

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2" role="region" aria-label="Active alerts">
      {alerts.map((alert) => (
        <div
          key={alert.alert_id}
          className={cn(
            'flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4',
            alert.severity === 'critical'
              ? 'border-[color:var(--color-bad)]/45 bg-[color:var(--color-bad)]/5'
              : 'border-[color:var(--color-warn)]/45 bg-[color:var(--color-warn)]/5',
          )}
        >
          <AlertOctagon
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className={
              alert.severity === 'critical'
                ? 'text-[color:var(--color-bad)]'
                : 'text-[color:var(--color-warn)]'
            }
          />

          <div className="min-w-0 flex-1">
            <p className="text-ink text-sm font-semibold">{alert.title}</p>
            {alert.body ? <p className="text-ink-soft text-xs">{alert.body}</p> : null}
          </div>

          <Link
            href={
              alert.payload?.feedbackId
                ? `/admin/feedback/${alert.payload.feedbackId}`
                : `/admin/feedback?ratingBand=negative`
            }
            className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-semibold"
          >
            VIEW FEEDBACK
            <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
          </Link>

          <button
            type="button"
            disabled={busy === alert.alert_id}
            onClick={() => acknowledge(alert.alert_id)}
            className="border-line text-ink-soft hover:bg-surface inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50"
          >
            <Check size={12} strokeWidth={2.4} aria-hidden="true" />
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  )
}
