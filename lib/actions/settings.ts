'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { CONFIG_DEFAULTS } from '@/lib/config.defaults'
import { can } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * CMS mutations (§3, Prompts 35–38).
 *
 * Three things happen on every save, and all three matter:
 *
 *   1. the row is written through the RLS-bound client, so §8's "no CMS for
 *      MANAGER" is enforced by policy rather than by this file remembering
 *   2. an audit_log row records who changed what, from what, to what
 *   3. the `app-config` cache tag is revalidated, which is what makes an edit
 *      show up on the kiosk without a redeploy — the Prompt 35 checkpoint
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

const DENIED = 'You do not have permission to change settings.'

async function auditConfig(
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  await createAdminClient()
    .from('audit_log')
    .insert({
      outlet_id: user.outletId,
      user_id: user.userId,
      action,
      entity,
      entity_id: entityId,
      before: before as never,
      after: after as never,
    })
}

/** Anything the kiosk reads goes through getConfig(), which is tagged. */
function refreshKiosk(): void {
  revalidateTag('app-config')
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings', 'layout')
}

/** Look up a compiled-in seed default for a dotted config key. */
export async function defaultConfigValue(key: string): Promise<unknown> {
  const [section, ...rest] = key.split('.')
  const leaf = rest.join('.')
  const group = (CONFIG_DEFAULTS as unknown as Record<string, Record<string, unknown>>)[
    section ?? ''
  ]
  return group ? group[leaf] : undefined
}

export async function updateConfigValue(key: string, value: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:cms')) return { ok: false, error: DENIED }

  const client = await createClient()

  const { data: before } = await client
    .from('app_config')
    .select('value')
    .eq('outlet_id', user!.outletId)
    .eq('key', key)
    .maybeSingle()

  const { data: written, error } = await client
    .from('app_config')
    .update({ value: value as never, updated_by: user!.userId })
    .eq('outlet_id', user!.outletId)
    .eq('key', key)
    .select('key')

  if (error) return { ok: false, error: error.message }
  // Zero rows means RLS refused, not that the key is missing — an UPDATE
  // blocked by policy returns quietly.
  if (!written || written.length === 0) return { ok: false, error: DENIED }

  await auditConfig('CONFIG_UPDATE', 'app_config', key, before?.value ?? null, value)
  refreshKiosk()

  return { ok: true }
}

/** Put a single key back to the value 0002_seed.sql shipped. */
export async function resetConfigValue(key: string): Promise<ActionResult> {
  const fallback = await defaultConfigValue(key)
  if (fallback === undefined) {
    return { ok: false, error: `No seeded default exists for ${key}.` }
  }
  return updateConfigValue(key, fallback)
}

// -----------------------------------------------------------------------------
// Reference tables — categories, issues, themes, rating scale
// -----------------------------------------------------------------------------

type ReferenceTable = 'categories' | 'issues' | 'themes' | 'rating_scale'

export async function createReferenceRow(
  table: ReferenceTable,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:cms')) return { ok: false, error: DENIED }

  const client = await createClient()
  const { data, error } = await client
    .from(table)
    .insert({ ...values, outlet_id: user!.outletId } as never)
    .select('*')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: DENIED }

  await auditConfig(
    'REFERENCE_CREATE',
    table,
    String(Object.values(data[0] ?? {})[0]),
    null,
    values,
  )
  refreshKiosk()
  return { ok: true }
}

export async function updateReferenceRow(
  table: ReferenceTable,
  idColumn: string,
  id: string,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:cms')) return { ok: false, error: DENIED }

  const client = await createClient()

  const { data: before } = await client.from(table).select('*').eq(idColumn, id).maybeSingle()

  const { data: written, error } = await client
    .from(table)
    .update(values as never)
    .eq(idColumn, id)
    .eq('outlet_id', user!.outletId)
    .select(idColumn)

  if (error) return { ok: false, error: error.message }
  if (!written || written.length === 0) return { ok: false, error: DENIED }

  await auditConfig('REFERENCE_UPDATE', table, id, before, values)
  refreshKiosk()
  return { ok: true }
}

/**
 * Reorder by rewriting display_order across the whole list.
 *
 * Rows are never deleted from the CMS, only deactivated (§36): past feedback
 * references them, and losing the name of a category someone rated would make
 * historical analytics unreadable.
 */
export async function reorderReferenceRows(
  table: ReferenceTable,
  idColumn: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:cms')) return { ok: false, error: DENIED }

  const client = await createClient()

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await client
      .from(table)
      .update({ display_order: index + 1 } as never)
      .eq(idColumn, id)
      .eq('outlet_id', user!.outletId)

    if (error) return { ok: false, error: error.message }
  }

  await auditConfig('REFERENCE_REORDER', table, table, null, { order: orderedIds })
  refreshKiosk()
  return { ok: true }
}

export async function setReferenceActive(
  table: ReferenceTable,
  idColumn: string,
  id: string,
  active: boolean,
): Promise<ActionResult> {
  return updateReferenceRow(table, idColumn, id, { active })
}

// -----------------------------------------------------------------------------
// Theme keywords
// -----------------------------------------------------------------------------

export async function setThemeKeywords(themeId: string, keywords: string[]): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:cms')) return { ok: false, error: DENIED }

  const client = await createClient()

  const cleaned = [
    ...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)),
  ]

  const { data: before } = await client
    .from('theme_keywords')
    .select('keyword')
    .eq('theme_id', themeId)

  // Replace wholesale: a keyword the manager removed must stop matching, which
  // an upsert would never achieve.
  const { error: deleteError } = await client
    .from('theme_keywords')
    .delete()
    .eq('theme_id', themeId)
  if (deleteError) return { ok: false, error: deleteError.message }

  if (cleaned.length > 0) {
    const { error } = await client
      .from('theme_keywords')
      .insert(cleaned.map((keyword) => ({ theme_id: themeId, keyword })))
    if (error) return { ok: false, error: error.message }
  }

  await auditConfig(
    'THEME_KEYWORDS_SET',
    'theme_keywords',
    themeId,
    (before ?? []).map((row) => row.keyword),
    cleaned,
  )
  refreshKiosk()
  return { ok: true }
}
