import 'server-only'

import { cache } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * The outlet's active kiosks, read once per request.
 *
 * The admin layout needs printer/camera status for the header and the dashboard
 * needs last-seen for its status pill, and each of them was issuing its own
 * query against the same table on the same render. `cache()` collapses them
 * into one: both callers are inside the same React render pass, which is
 * exactly the case it is for.
 */
export type KioskRow = {
  label: string
  lastSeenAt: string | null
  printerStatus: string | null
  cameraStatus: string | null
}

export const getKiosks = cache(async (): Promise<KioskRow[]> => {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('kiosks')
    .select('label, last_seen_at, printer_status, camera_status')
    .eq('outlet_id', user.outletId)
    .eq('active', true)

  return (data ?? []).map((row) => ({
    label: row.label,
    lastSeenAt: row.last_seen_at,
    printerStatus: row.printer_status,
    cameraStatus: row.camera_status,
  }))
})
