import 'server-only'

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { PushPayload } from './push-copy'

export { lowRatingNotification } from './push-copy'
export type { PushPayload } from './push-copy'

/**
 * Web Push delivery for low ratings (client request, 14 Sep 2026).
 *
 * The detection already existed: evaluateAlerts() raises a LOW_RATING alert the
 * moment a submission lands (§27). But an alert is only seen by someone who
 * already has the dashboard open, and the whole point of the request was to
 * learn about a bad visit while the guest is still in the café. This is the
 * delivery half.
 *
 * Deliberately NOT throwing, ever. This runs after the feedback row is
 * committed, and a push service being slow or down must never cost a guest
 * their submission — the same rule the alert evaluator already follows.
 */

type Db = SupabaseClient<Database>

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  )
}

let configured = false
function ensureVapid(): boolean {
  if (!vapidConfigured()) return false
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )
    configured = true
  }
  return true
}

/**
 * Sends one payload to every live subscription in an outlet.
 *
 * Uses the service-role client: this runs on the kiosk's anonymous submit path,
 * where there is no signed-in user whose RLS could read the subscriptions.
 */
export async function pushToOutlet(db: Db, outletId: string, payload: PushPayload): Promise<void> {
  try {
    if (!ensureVapid()) {
      console.warn('[push] VAPID keys are not configured; skipping notification.')
      return
    }

    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('subscription_id, endpoint, p256dh, auth, failure_count')
      .eq('outlet_id', outletId)
      .lt('failure_count', 5)

    if (error) {
      console.error('[push] could not read subscriptions:', error.message)
      return
    }
    if (!subs || subs.length === 0) return

    const body = JSON.stringify(payload)
    const dead: string[] = []

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            { TTL: 60 * 30, urgency: 'high' },
          )
          await db
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString(), failure_count: 0 })
            .eq('subscription_id', sub.subscription_id)
        } catch (sendError) {
          const status = (sendError as { statusCode?: number }).statusCode
          // 404/410 mean the browser threw the subscription away — the user
          // cleared site data, uninstalled, or revoked permission. Keeping the
          // row would mean retrying a dead endpoint forever.
          if (status === 404 || status === 410) {
            dead.push(sub.subscription_id)
            return
          }

          // Anything else is a transient failure — a timeout, a 5xx from the
          // push service. Count it so a permanently sick endpoint eventually
          // drops out of the query above instead of being retried forever.
          console.error(`[push] send failed (${status ?? 'no status'})`)
          const { error: bumpError } = await db
            .from('push_subscriptions')
            .update({ failure_count: sub.failure_count + 1 })
            .eq('subscription_id', sub.subscription_id)
          if (bumpError) console.error('[push] could not record failure:', bumpError.message)
        }
      }),
    )

    if (dead.length > 0) {
      await db.from('push_subscriptions').delete().in('subscription_id', dead)
    }
  } catch (error) {
    console.error('[push] unexpected failure:', error)
  }
}
