'use server'

import { revalidateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * The kill switch, from the admin side (PHOTO_MODULE.md §8b).
 *
 * revalidateTag('config') is not optional garnish. The kiosk reads config at
 * the start of every journey and the server caches it for 60s; without the
 * invalidation a manager watching a printer jam would toggle this and watch
 * the next three guests still be offered a print. With it, the change lands on
 * the next journey.
 *
 * Every toggle is audit-logged with whether it was a person or the system, so
 * "why was this off all Saturday?" has an answer.
 */

export type ToggleResult = { ok: true } | { ok: false; error: string }

export async function setMemoryEnabled(
  enabled: boolean,
  source: 'manual' | 'auto' = 'manual',
): Promise<ToggleResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:cms')) return { ok: false, error: 'Not permitted' }

  const client = await createClient()

  const { data: written, error } = await client
    .from('app_config')
    .update({ value: enabled, updated_by: user?.userId ?? null })
    .eq('outlet_id', user!.outletId)
    .eq('key', 'memory.enabled')
    .select('key')

  if (error) return { ok: false, error: error.message }
  // RLS refusals come back as zero rows and no error, so the count is the check.
  if (!written || written.length === 0) return { ok: false, error: 'Not permitted' }

  await client.from('audit_log').insert({
    outlet_id: user!.outletId,
    user_id: user!.userId,
    action: enabled ? 'memory.enable' : 'memory.disable',
    entity: 'app_config',
    entity_id: 'memory.enabled',
    after: { enabled, source },
  })

  revalidateTag('config')
  return { ok: true }
}
