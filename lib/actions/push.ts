'use server'

import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Subscribing and unsubscribing this browser from low-rating notifications.
 *
 * Writes through the CALLER's client, not the service role: RLS on
 * push_subscriptions restricts every row to its own user, and an endpoint plus
 * its keys is enough to push to somebody's phone. Using the admin client here
 * would quietly discard that boundary for no gain.
 */

export type PushResult = { ok: true } | { ok: false; error: string }

export async function savePushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
}): Promise<PushResult> {
  const user = await getCurrentUser()
  if (!user || !user.active) return { ok: false, error: 'Not signed in' }

  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { ok: false, error: 'The browser did not return a usable subscription' }
  }

  const supabase = await createClient()

  // onConflict on the endpoint: a browser re-subscribing hands back the same
  // endpoint, and the row should move to whoever is signed in now rather than
  // failing on the unique index or leaving it pointed at the previous user.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      outlet_id: user.outletId,
      user_id: user.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent.slice(0, 300),
      failure_count: 0,
    },
    { onConflict: 'endpoint' },
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<PushResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const supabase = await createClient()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
