import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Scheduled retention purge (§11, §45).
 *
 * §11 requires the retention setting AND the job to exist even though the
 * default is to keep everything — a policy nobody can enforce is not a policy.
 * With `privacy.retention_days` unset this runs and does nothing, which is the
 * point: the day someone sets it, the mechanism is already there and tested.
 *
 * It anonymises contact details, it does not delete feedback. A guest should be
 * able to stop being a person in this system without their rating of the food
 * disappearing from the café's history.
 *
 * Wire it up in vercel.json:
 *   { "crons": [{ "path": "/api/cron/purge", "schedule": "0 20 * * *" }] }
 * (20:00 UTC is 01:30 IST — after the café has closed.)
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  // Vercel sends this header on cron invocations. Without a configured secret
  // the endpoint refuses rather than defaulting open — an unauthenticated route
  // that mutates guest records is not something to leave ajar.
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured; refusing to run.' },
      { status: 503 },
    )
  }
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data, error } = await db.rpc('aic_purge_expired_contacts', { p_outlet: undefined })

  if (error) {
    console.error('[purge] failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, outlets: data ?? [] })
}
