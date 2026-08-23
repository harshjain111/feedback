import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/alerts — open alerts for the caller's outlet (§27).
 * PATCH /api/alerts — acknowledge one.
 *
 * Both go through the RLS-bound client, so the outlet scope and the §8 matrix
 * are enforced by policy rather than by this handler remembering to filter.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const user = await getCurrentUser()
  if (!can(user, 'view:alerts')) {
    // 200 with nothing, not 403: the dashboard polls this every 60 seconds and
    // a role without alerts is a normal state, not an error to log.
    return NextResponse.json({ alerts: [] })
  }

  const client = await createClient()
  const { data, error } = await client
    .from('alerts')
    .select('alert_id, type, severity, title, body, payload, first_fired_at, last_fired_at')
    .is('acknowledged_at', null)
    .order('last_fired_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alerts: data ?? [] })
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await getCurrentUser()
  if (!can(user, 'acknowledge:alerts')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  let body: { alertId?: string }
  try {
    body = (await request.json()) as { alertId?: string }
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  if (!body.alertId) {
    return NextResponse.json({ error: 'alertId is required' }, { status: 400 })
  }

  const client = await createClient()
  const { error } = await client
    .from('alerts')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: user!.userId,
    })
    .eq('alert_id', body.alertId)
    .is('acknowledged_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Acknowledging frees the dedupe key, so the same condition can raise a fresh
  // alert if it happens again (0001's partial unique index).
  return NextResponse.json({ ok: true })
}
