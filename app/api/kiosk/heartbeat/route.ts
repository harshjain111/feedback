import { NextResponse } from 'next/server'
import { getOutletId } from '@/lib/config'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowOfflineSeedFallback } from '@/lib/supabase/env'

/**
 * Kiosk heartbeat (§43).
 *
 * The tablet pings this so the admin can tell "nobody left feedback today"
 * apart from "the tablet has been off since Tuesday" — which look identical on
 * a dashboard and mean completely different things.
 *
 * Anonymous by design, like the rest of the kiosk, and it only ever touches
 * last_seen_at.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  if (allowOfflineSeedFallback()) return NextResponse.json({ ok: true, simulated: true })

  let body: { kioskId?: string }
  try {
    body = (await request.json()) as { kioskId?: string }
  } catch {
    body = {}
  }

  const db = createAdminClient()
  const outletId = await getOutletId()

  // With no kiosk id we touch the outlet's single kiosk, which is the shape
  // today; a multi-kiosk outlet must send one.
  const query = db.from('kiosks').update({ last_seen_at: new Date().toISOString() })
  const { error } = body.kioskId
    ? await query.eq('kiosk_id', body.kioskId)
    : await query.eq('outlet_id', outletId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
