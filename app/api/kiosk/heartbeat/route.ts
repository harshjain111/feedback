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
 * Anonymous by design, like the rest of the kiosk. It now also carries the
 * device health the Memory Print Module needs (PHOTO_MODULE.md §6): the kiosk
 * polls the local agent's /status and forwards it here, because the agent binds
 * 127.0.0.1 and nothing on the internet can reach it — the browser sitting in
 * front of it is the only thing that can.
 *
 * The kiosk supplies `camera` itself rather than relaying the agent's answer.
 * The agent cannot see the camera; getUserMedia can. A green badge on a dead
 * camera would be worse than no badge.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  if (allowOfflineSeedFallback()) return NextResponse.json({ ok: true, simulated: true })

  type Body = {
    kioskId?: string
    printerStatus?: string
    cameraStatus?: string
    agentVersion?: string
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    body = {}
  }

  // Constrained to the CHECK constraints in 0014. An unrecognised value is
  // dropped rather than written: a badge that renders a typo as "everything is
  // fine" is worse than one that says nothing.
  const PRINTER = ['online', 'offline', 'out_of_paper', 'cover_open', 'unknown']
  const CAMERA = ['present', 'absent', 'denied', 'unknown']

  const db = createAdminClient()
  const outletId = await getOutletId()

  // With no kiosk id we touch the outlet's single kiosk, which is the shape
  // today; a multi-kiosk outlet must send one.
  const now = new Date().toISOString()
  const update: {
    last_seen_at: string
    printer_status?: string
    camera_status?: string
    agent_version?: string
    status_checked_at?: string
  } = { last_seen_at: now }

  if (body.printerStatus && PRINTER.includes(body.printerStatus)) {
    update.printer_status = body.printerStatus
    update.status_checked_at = now
  }
  if (body.cameraStatus && CAMERA.includes(body.cameraStatus)) {
    update.camera_status = body.cameraStatus
    update.status_checked_at = now
  }
  if (typeof body.agentVersion === 'string' && body.agentVersion.length <= 32) {
    update.agent_version = body.agentVersion
  }

  const query = db.from('kiosks').update(update)
  const { error } = body.kioskId
    ? await query.eq('kiosk_id', body.kioskId)
    : await query.eq('outlet_id', outletId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
